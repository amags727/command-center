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

  // SHA-256 hash
  async function hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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
      connect(saved);
    } else {
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
          // Remote is newer — import it
          _importing = true;
          Object.keys(remote).forEach(k => {
            if (k !== '_lastSync') {
              localStorage.setItem(k, typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]));
            }
          });
          localStorage.setItem('_lastSync', String(remoteTs));
          // Reload UI
          if (typeof loadAll === 'function') loadAll();
          _importing = false;
          clearTimeout(debounceTimer);  // cancel any push queued during import
          _importCooldown = Date.now() + 2000;  // suppress pushes for 2s after import
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
            _importing = true;
            Object.keys(remote).forEach(k => {
              if (k !== '_lastSync') {
                localStorage.setItem(k, typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]));
              }
            });
            localStorage.setItem('_lastSync', String(remoteTs));
            if (typeof loadAll === 'function') loadAll();
            _importing = false;
            clearTimeout(debounceTimer);  // cancel any push queued during import
            _importCooldown = Date.now() + 2000;  // suppress pushes for 2s after import
          }
          setStatus(navigator.onLine ? 'synced' : 'offline');
        });
      }

      setStatus(navigator.onLine ? 'synced' : 'offline');
      return true;
    } catch (e) {
      console.error('Sync connect error:', e);
      setStatus('error');
      return false;
    }
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
        data[k] = localStorage.getItem(k);
      }
      // Fingerprint check — skip push if data unchanged
      const fingerprint = JSON.stringify(data);
      if (fingerprint === _lastPushFingerprint) return;  // nothing changed
      
      setStatus('syncing');
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

  return { init, connect, disconnect, onChange, isConnected, pushAll };
})();
