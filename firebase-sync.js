// Firebase Sync Layer — passphrase-based, real-time
// Uses SHA-256 hash of passphrase as user path in Realtime Database

const FirebaseSync = (() => {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBw0PSQwY48Vx7SjygXu4MEwt5lLJOyshw",
    authDomain: "planner-2026-92aee.firebaseapp.com",
    databaseURL: "https://planner-2026-92aee-default-rtdb.firebaseio.com",
    projectId: "planner-2026-92aee",
    storageBucket: "planner-2026-92aee.firebasestorage.app",
    messagingSenderId: "118229149026",
    appId: "1:118229149026:web:762b7efb7983186feab83b"
  };

  let db = null;
  let userPath = null;
  let syncEnabled = false;
  let debounceTimer = null;
  let statusEl = null;
  let listening = false;
  let _importing = false;  // guard: true while importing remote data (suppresses push-back)
  let _importCooldown = 0; // timestamp: suppress pushes until this time
  let _lastPushTs = 0;     // track last push timestamp to ignore self-triggered listener
  let _lastPushFingerprint = ''; // fingerprint of last pushed data — skip if unchanged
  let _initialPullDone = false; // true once the first pull (or no-remote-data) has resolved

  // Conflict guard — detect if remote data would regress local progress
  function detectRegression(remoteData) {
    // 1. Compare reviewed flashcard counts
    let localReviewed = 0, remoteReviewed = 0;
    try {
      const localCards = JSON.parse(localStorage.getItem('cc_data') || '{}');
      const localCardArr = (localCards && localCards.cards) ? localCards.cards : [];
      localReviewed = localCardArr.filter(c => c.reps > 0 || c.queue !== 0).length;
    } catch(e) { /* ignore parse errors */ }
    try {
      const remoteRaw = remoteData[encodeKey('cc_data')] || remoteData['cc_data'];
      if (remoteRaw) {
        const remoteCards = typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : remoteRaw;
        const remoteCardArr = (remoteCards && remoteCards.cards) ? remoteCards.cards : [];
        remoteReviewed = remoteCardArr.filter(c => c.reps > 0 || c.queue !== 0).length;
      }
    } catch(e) { /* ignore parse errors */ }

    // 2. Compare total key counts (goals, notes, etc.)
    const remoteKeyCount = Object.keys(remoteData).filter(k => k !== '_lastSync').length;
    let localKeyCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== 'sync_passphrase' && k !== '_lastSync') localKeyCount++;
    }

    // Flag regression if local has meaningfully more reviewed cards
    if (localReviewed > 10 && remoteReviewed < localReviewed * 0.5) {
      return { regressed: true, localReviewed, remoteReviewed, localKeyCount, remoteKeyCount };
    }
    // Flag regression if local has substantially more data keys
    if (localKeyCount > 20 && remoteKeyCount < localKeyCount * 0.5) {
      return { regressed: true, localReviewed, remoteReviewed, localKeyCount, remoteKeyCount };
    }
    return { regressed: false };
  }

  // SHA-256 hash
  async function hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Firebase key sanitization — encode/decode chars forbidden in RTDB keys: . # $ / [ ]
  function encodeKey(k) {
    return k.replace(/%/g, '%25')
            .replace(/\./g, '%2E')
            .replace(/#/g, '%23')
            .replace(/\$/g, '%24')
            .replace(/\//g, '%2F')
            .replace(/\[/g, '%5B')
            .replace(/\]/g, '%5D');
  }
  function decodeKey(k) {
    return k.replace(/%2E/g, '.')
            .replace(/%23/g, '#')
            .replace(/%24/g, '$')
            .replace(/%2F/g, '/')
            .replace(/%5B/g, '[')
            .replace(/%5D/g, ']')
            .replace(/%25/g, '%');
  }

  function setStatus(state) {
    if (!statusEl) statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    const map = {
      synced: { icon: '🟢', text: 'Synced' },
      syncing: { icon: '🟡', text: 'Syncing...' },
      offline: { icon: '🟡', text: 'Offline' },
      error: { icon: '🔴', text: 'Error' },
      off: { icon: '⚪', text: 'Local only' }
    };
    const s = map[state] || map.off;
    statusEl.innerHTML = `${s.icon} <span style="font-size:11px">${s.text}</span>`;
  }

  async function init() {
    // Check if Firebase SDK loaded
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded');
      setStatus('off');
      return;
    }
    // Initialize Firebase app (only once)
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.database();

    // Sign in anonymously so database rules allow read/write
    try {
      await firebase.auth().signInAnonymously();
    } catch (e) {
      console.warn('Anonymous auth failed:', e.message);
    }

    // Check saved passphrase
    const saved = localStorage.getItem('sync_passphrase');
    if (saved) {
      await connect(saved);
    } else {
      _initialPullDone = true; // no sync configured — safe to proceed
      setStatus('off');
    }

    // Online/offline detection
    window.addEventListener('online', () => { if (syncEnabled) setStatus('synced'); });
    window.addEventListener('offline', () => { if (syncEnabled) setStatus('offline'); });
  }

  async function connect(passphrase) {
    if (!db) {
      console.warn('Firebase not initialized');
      return false;
    }
    try {
      const h = await hash(passphrase);
      userPath = 'users/' + h;
      localStorage.setItem('sync_passphrase', passphrase);
      syncEnabled = true;
      setStatus('syncing');

      // Pull remote data first (merge strategy: remote wins if newer)
      const snap = await db.ref(userPath + '/data').once('value');
      const remote = snap.val();
      if (remote) {
        const remoteTs = remote._lastSync || 0;
        const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
        if (remoteTs > localTs) {
          // Conflict guard — check if remote would regress local progress
          const check = detectRegression(remote);
          if (check.regressed) {
            const keepLocal = confirm(
              `⚠️ Sync conflict detected!\n\n` +
              `Local: ${check.localReviewed} reviewed cards, ${check.localKeyCount} data keys\n` +
              `Remote: ${check.remoteReviewed} reviewed cards, ${check.remoteKeyCount} data keys\n\n` +
              `Remote appears to have less progress. Keep LOCAL data and push it to sync?\n\n` +
              `OK = Keep local (recommended)\nCancel = Accept remote (overwrites local)`
            );
            if (keepLocal) {
              // Push local to remote instead
              pushAll();
            } else {
              // User chose to accept remote — import it
              _importing = true;
              Object.keys(remote).forEach(k => {
                if (k !== '_lastSync') {
                  localStorage.setItem(decodeKey(k), typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]));
                }
              });
              localStorage.setItem('_lastSync', String(remoteTs));
              if (typeof loadAll === 'function') loadAll();
              _importing = false;
              clearTimeout(debounceTimer);
              _importCooldown = Date.now() + 2000;
            }
          } else {
            // No regression — import normally
            _importing = true;
            Object.keys(remote).forEach(k => {
              if (k !== '_lastSync') {
                localStorage.setItem(decodeKey(k), typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]));
              }
            });
            localStorage.setItem('_lastSync', String(remoteTs));
            if (typeof loadAll === 'function') loadAll();
            _importing = false;
            clearTimeout(debounceTimer);
            _importCooldown = Date.now() + 2000;
          }
        } else {
          // Local is newer — push to remote
          pushAll();
        }
      } else {
        // No remote data — push local
        pushAll();
      }

      // Listen for remote changes
      if (!listening) {
        listening = true;
        db.ref(userPath + '/data').on('value', (snap) => {
          const remote = snap.val();
          if (!remote) return;
          const remoteTs = remote._lastSync || 0;
          // Ignore events triggered by our own push
          if (remoteTs === _lastPushTs) {
            setStatus(navigator.onLine ? 'synced' : 'offline');
            return;
          }
          const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
          if (remoteTs > localTs) {
            // Conflict guard on real-time updates too
            const check = detectRegression(remote);
            if (check.regressed) {
              const keepLocal = confirm(
                `⚠️ Sync conflict detected!\n\n` +
                `Local: ${check.localReviewed} reviewed cards, ${check.localKeyCount} data keys\n` +
                `Remote: ${check.remoteReviewed} reviewed cards, ${check.remoteKeyCount} data keys\n\n` +
                `Incoming sync appears to have less progress. Keep LOCAL data?\n\n` +
                `OK = Keep local (recommended)\nCancel = Accept remote (overwrites local)`
              );
              if (keepLocal) {
                pushAll();
                setStatus(navigator.onLine ? 'synced' : 'offline');
                return;
              }
            }
            _importing = true;
            Object.keys(remote).forEach(k => {
              if (k !== '_lastSync') {
                localStorage.setItem(decodeKey(k), typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]));
              }
            });
            localStorage.setItem('_lastSync', String(remoteTs));
            if (typeof loadAll === 'function') loadAll();
            _importing = false;
            clearTimeout(debounceTimer);
            _importCooldown = Date.now() + 2000;
          }
          setStatus(navigator.onLine ? 'synced' : 'offline');
        });
      }

      _initialPullDone = true;
      setStatus(navigator.onLine ? 'synced' : 'offline');
      return true;
    } catch (e) {
      console.error('Sync connect error:', e);
      _initialPullDone = true; // mark done even on error so UI isn't stuck
      setStatus('error');
      return false;
    }
  }

  function isInitialPullDone() {
    return _initialPullDone;
  }

  function pushAll() {
    if (!syncEnabled || !db || !userPath || _importing) return;
    if (Date.now() < _importCooldown) return;  // still in post-import cooldown
    
    // Debounce — don't push more than once per second
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (Date.now() < _importCooldown || _importing) return;  // re-check at fire time
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // Skip internal keys
        if (k === 'sync_passphrase' || k === '_lastSync') continue;
        data[encodeKey(k)] = localStorage.getItem(k);
      }
      // Fingerprint check — sort keys for stable comparison, skip if unchanged
      const sortedKeys = Object.keys(data).sort();
      const fingerprint = sortedKeys.map(k => k + '=' + data[k]).join('\n');
      if (fingerprint === _lastPushFingerprint) return;  // nothing changed
      
      // Don't flash "Syncing..." for background saves — keep status as-is
      const ts = Date.now();
      data._lastSync = ts;
      _lastPushTs = ts;
      _lastPushFingerprint = fingerprint;
      localStorage.setItem('_lastSync', String(ts));
      
      db.ref(userPath + '/data').set(data)
        .then(() => setStatus(navigator.onLine ? 'synced' : 'offline'))
        .catch(e => { console.error('Push error:', e); setStatus('error'); });
    }, 1000);
  }

  function disconnect() {
    if (db && userPath && listening) {
      db.ref(userPath + '/data').off();
      listening = false;
    }
    syncEnabled = false;
    userPath = null;
    localStorage.removeItem('sync_passphrase');
    setStatus('off');
  }

  function isConnected() {
    return syncEnabled;
  }

  // Call this after any localStorage write to trigger sync
  function onChange() {
    if (syncEnabled) pushAll();
  }

  return { init, connect, disconnect, onChange, isConnected, isInitialPullDone, pushAll };
})();
