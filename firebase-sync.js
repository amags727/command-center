// Firebase Sync Layer — passphrase-based, real-time
// Uses SHA-256 hash of passphrase as user path in Realtime Database
// Card-level merge: never lose review progress on device switch

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
  let _importing = false;
  let _importCooldown = 0;
  let _lastPushTs = 0;
  let _lastPushFingerprint = '';
  let _initialPullDone = false;
  let _cachedAuthToken = null; // cached for beforeunload

  // ---- Per-card merge for the cmdcenter blob ----
  // Merges remote cards into local cards by ID, keeping whichever has higher lastMod.
  // New cards from either side are always kept.
  function mergeCards(localCards, remoteCards) {
    const localMap = new Map();
    (localCards || []).forEach(c => localMap.set(c.id, c));
    const remoteMap = new Map();
    (remoteCards || []).forEach(c => remoteMap.set(c.id, c));

    // Start with all local cards
    const merged = new Map(localMap);

    // Merge remote cards in
    for (const [id, remoteCard] of remoteMap) {
      const localCard = merged.get(id);
      if (!localCard) {
        // New card from remote — keep it
        merged.set(id, remoteCard);
      } else {
        // Both sides have this card — keep the one with higher lastMod
        const localMod = localCard.lastMod || 0;
        const remoteMod = remoteCard.lastMod || 0;
        if (remoteMod > localMod) {
          merged.set(id, remoteCard);
        }
        // If equal or local is newer, keep local (already in merged)
      }
    }
    return Array.from(merged.values());
  }

  // Merge the cmdcenter key specifically, card-by-card
  function mergeCmdCenter(localRaw, remoteRaw) {
    let local, remote;
    try { local = typeof localRaw === 'string' ? JSON.parse(localRaw) : (localRaw || {}); } catch { local = {}; }
    try { remote = typeof remoteRaw === 'string' ? JSON.parse(remoteRaw) : (remoteRaw || {}); } catch { remote = {}; }

    // Merge cards array per-card
    const mergedCards = mergeCards(local.cards, remote.cards);

    // For all other fields, use remote (newer) as base, but preserve card merge
    const result = Object.assign({}, local, remote);
    result.cards = mergedCards;

    // Merge days per-date: keep whichever has higher lastMod
    if (local.days || remote.days) {
      const localDays = local.days || {};
      const remoteDays = remote.days || {};
      const mergedDays = Object.assign({}, localDays);
      for (const date of Object.keys(remoteDays)) {
        const ld = mergedDays[date];
        const rd = remoteDays[date];
        if (!ld) {
          mergedDays[date] = rd;
        } else {
          const lm = ld.lastMod || 0;
          const rm = rd.lastMod || 0;
          if (rm > lm) mergedDays[date] = rd;
          // else keep local (already in mergedDays)
        }
      }
      result.days = mergedDays;
    }

    // Merge weeks per-weekId: keep whichever has higher lastMod
    if (local.weeks || remote.weeks) {
      const localWeeks = local.weeks || {};
      const remoteWeeks = remote.weeks || {};
      const mergedWeeks = Object.assign({}, localWeeks);
      for (const wk of Object.keys(remoteWeeks)) {
        const lw = mergedWeeks[wk];
        const rw = remoteWeeks[wk];
        if (!lw) {
          mergedWeeks[wk] = rw;
        } else {
          const lm = lw.lastMod || 0;
          const rm = rw.lastMod || 0;
          if (rm > lm) mergedWeeks[wk] = rw;
        }
      }
      result.weeks = mergedWeeks;
    }

    // Merge cardSettings: keep whichever has a dailyBonusNew entry for today
    if (local.cardSettings && remote.cardSettings) {
      result.cardSettings = Object.assign({}, local.cardSettings, remote.cardSettings);
      // Merge dailyBonusNew maps
      if (local.cardSettings.dailyBonusNew || remote.cardSettings.dailyBonusNew) {
        result.cardSettings.dailyBonusNew = Object.assign({}, local.cardSettings.dailyBonusNew || {}, remote.cardSettings.dailyBonusNew || {});
      }
    }

    // Merge log: union by timestamp, keep most recent 500
    if (local.log || remote.log) {
      const seen = new Set();
      const merged = [];
      for (const entry of [...(local.log || []), ...(remote.log || [])]) {
        const key = entry.ts + '|' + entry.type + '|' + (entry.msg || '').slice(0, 50);
        if (!seen.has(key)) { seen.add(key); merged.push(entry); }
      }
      merged.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
      result.log = merged.slice(0, 500);
    }

    // Merge chatHistory: union by content hash, preserve order
    if (local.chatHistory || remote.chatHistory) {
      const seen = new Set();
      const merged = [];
      for (const entry of [...(remote.chatHistory || []), ...(local.chatHistory || [])]) {
        const key = entry.role + '|' + (entry.content || '').slice(0, 80);
        if (!seen.has(key)) { seen.add(key); merged.push(entry); }
      }
      result.chatHistory = merged;
    }

    return result;
  }

  // Import remote data into localStorage with per-card merge for cmdcenter
  function importRemoteData(remote) {
    const CMD_KEY = 'cmdcenter';
    const encodedCmdKey = encodeKey(CMD_KEY);

    Object.keys(remote).forEach(k => {
      if (k === '_lastSync') return;
      const localKey = decodeKey(k);

      if (localKey === CMD_KEY) {
        // Per-card merge for cmdcenter
        const localRaw = localStorage.getItem(CMD_KEY);
        const merged = mergeCmdCenter(localRaw, remote[k]);
        localStorage.setItem(CMD_KEY, JSON.stringify(merged));
      } else {
        // All other keys: remote wins (last-write-wins)
        localStorage.setItem(localKey, typeof remote[k] === 'string' ? remote[k] : JSON.stringify(remote[k]));
      }
    });
  }

  // SHA-256 hash
  async function hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Firebase key sanitization
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

  // Cache auth token for synchronous beforeunload use
  async function refreshAuthToken() {
    try {
      const user = firebase.auth().currentUser;
      if (user) {
        _cachedAuthToken = await user.getIdToken();
      }
    } catch (e) { /* ignore */ }
  }

  async function init() {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded');
      setStatus('off');
      return;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.database();

    try {
      await firebase.auth().signInAnonymously();
      await refreshAuthToken();
    } catch (e) {
      console.warn('Anonymous auth failed:', e.message);
    }

    const saved = localStorage.getItem('sync_passphrase');
    if (saved) {
      await connect(saved);
    } else {
      _initialPullDone = true;
      setStatus('off');
    }

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

      const snap = await db.ref(userPath + '/data').once('value');
      const remote = snap.val();
      if (remote) {
        const remoteTs = remote._lastSync || 0;
        const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
        if (remoteTs > localTs) {
          // Remote is newer — merge (per-card for cmdcenter)
          _importing = true;
          importRemoteData(remote);
          localStorage.setItem('_lastSync', String(remoteTs));
          if (typeof loadAll === 'function') loadAll();
          _importing = false;
          clearTimeout(debounceTimer);
          _importCooldown = Date.now() + 2000;
          // Push merged result back so both sides converge
          setTimeout(() => pushAll(), 2500);
        } else {
          // Local is newer — push to remote
          pushAll();
        }
      } else {
        pushAll();
      }

      // Listen for remote changes
      if (!listening) {
        listening = true;
        db.ref(userPath + '/data').on('value', (snap) => {
          const remote = snap.val();
          if (!remote) return;
          const remoteTs = remote._lastSync || 0;
          if (remoteTs === _lastPushTs) {
            setStatus(navigator.onLine ? 'synced' : 'offline');
            return;
          }
          const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
          if (remoteTs > localTs) {
            _importing = true;
            importRemoteData(remote);
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
      _initialPullDone = true;
      setStatus('error');
      return false;
    }
  }

  function isInitialPullDone() {
    return _initialPullDone;
  }

  function _buildPayload() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === 'sync_passphrase' || k === '_lastSync') continue;
      data[encodeKey(k)] = localStorage.getItem(k);
    }
    return data;
  }

  function pushAll() {
    if (!syncEnabled || !db || !userPath || _importing) return;
    if (!_initialPullDone) return;
    if (Date.now() < _importCooldown) return;
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      _doPush();
    }, 1000);
  }

  // Immediate push — no debounce. Used after card reviews.
  function pushImmediate() {
    if (!syncEnabled || !db || !userPath || _importing) return;
    if (!_initialPullDone) return;
    if (Date.now() < _importCooldown) return;
    clearTimeout(debounceTimer);
    _doPush();
  }

  function _doPush() {
    if (Date.now() < _importCooldown || _importing) return;
    const data = _buildPayload();
    // Fingerprint check
    const sortedKeys = Object.keys(data).sort();
    const fingerprint = sortedKeys.map(k => k + '=' + data[k]).join('\n');
    if (fingerprint === _lastPushFingerprint) return;
    
    const ts = Date.now();
    data._lastSync = ts;
    _lastPushTs = ts;
    _lastPushFingerprint = fingerprint;
    localStorage.setItem('_lastSync', String(ts));
    
    db.ref(userPath + '/data').set(data)
      .then(() => {
        setStatus(navigator.onLine ? 'synced' : 'offline');
        refreshAuthToken(); // keep token fresh
      })
      .catch(e => { console.error('Push error:', e); setStatus('error'); });
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

  async function pullLatest() {
    if (!syncEnabled || !db || !userPath || _importing) return;
    try {
      const snap = await db.ref(userPath + '/data').once('value');
      const remote = snap.val();
      if (!remote) return;
      const remoteTs = remote._lastSync || 0;
      const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
      if (remoteTs > localTs) {
        _importing = true;
        importRemoteData(remote);
        localStorage.setItem('_lastSync', String(remoteTs));
        if (typeof loadAll === 'function') loadAll();
        _importing = false;
        clearTimeout(debounceTimer);
        _importCooldown = Date.now() + 2000;
        setStatus(navigator.onLine ? 'synced' : 'offline');
        // Push merged result back
        setTimeout(() => pushAll(), 2500);
      }
    } catch (e) {
      console.error('Pull latest error:', e);
    }
  }

  function onChange() {
    if (syncEnabled) pushAll();
  }

  // --- Automatic sync triggers ---

  // 1. Visibility change: pull on focus, push on blur
  document.addEventListener('visibilitychange', () => {
    if (!syncEnabled) return;
    if (document.visibilityState === 'visible') {
      pullLatest();
    } else {
      // Tab hidden — push immediately (no debounce)
      if (_initialPullDone) pushImmediate();
    }
  });

  // 2. Periodic auto-push every 30s
  setInterval(() => {
    if (syncEnabled && _initialPullDone) pushAll();
  }, 30000);

  // 3. Periodic auth token refresh every 10 min
  setInterval(() => {
    if (syncEnabled) refreshAuthToken();
  }, 600000);

  // 4. Before unload — last-resort save using synchronous XHR with auth token
  window.addEventListener('beforeunload', () => {
    if (!syncEnabled || !db || !userPath || !_initialPullDone || _importing) return;
    const data = _buildPayload();
    const ts = Date.now();
    data._lastSync = ts;
    localStorage.setItem('_lastSync', String(ts));

    const url = FIREBASE_CONFIG.databaseURL + '/' + userPath + '/data.json' +
      (_cachedAuthToken ? '?auth=' + _cachedAuthToken : '');
    try {
      // Synchronous XHR with PUT (correct method for Firebase overwrite)
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, false); // synchronous
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(data));
    } catch (e) {
      // Last resort: try sendBeacon (will create child node, but better than nothing)
      try { navigator.sendBeacon(url, JSON.stringify(data)); } catch (e2) { /* give up */ }
    }
  });

  return { init, connect, disconnect, onChange, isConnected, isInitialPullDone, pushAll, pushImmediate };
})();