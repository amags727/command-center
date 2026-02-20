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

  // Per-card merge: keep whichever card has higher lastMod, new cards from either side kept
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

  // Field-level merge for a single day: never lose user content
  function mergeDayFields(localDay, remoteDay) {
    if (!localDay) return remoteDay;
    if (!remoteDay) return localDay;

    // Start with both sides, then override with smart merges
    const merged = Object.assign({}, localDay, remoteDay);

    // String fields with per-field timestamps: use *Mod as authority,
    // fall back to keep-longer for pre-migration data
    for (const field of ['reflection', 'notes']) {
      const modKey = field === 'reflection' ? 'reflectionMod' : 'notesMod';
      const lMod = localDay[modKey] || 0;
      const rMod = remoteDay[modKey] || 0;
      const l = (localDay[field] || '').toString();
      const r = (remoteDay[field] || '').toString();
      if (lMod || rMod) {
        // At least one side has a per-field timestamp — use it
        merged[field] = lMod >= rMod ? l : r;
        merged[modKey] = Math.max(lMod, rMod);
      } else {
        // Pre-migration fallback: keep the longer one
        merged[field] = l.length >= r.length ? l : r;
      }
    }

    // sealed: logical OR — once sealed, stays sealed
    merged.sealed = !!(localDay.sealed || remoteDay.sealed);

    // habits: per-habit OR — once checked, stays checked
    // BUT preserve non-boolean habit values (ankiCount, art1Title, etc.) from the checked side
    const lh = localDay.habits || {};
    const rh = remoteDay.habits || {};
    merged.habits = Object.assign({}, lh, rh);
    for (const key of Object.keys(merged.habits)) {
      if (typeof lh[key] === 'boolean' || typeof rh[key] === 'boolean') {
        merged.habits[key] = !!(lh[key] || rh[key]);
      }
    }

    // calBlocks: merge by ID, keep higher lastMod per block
    if (localDay.calBlocks || remoteDay.calBlocks) {
      const lBlocks = new Map((localDay.calBlocks || []).map(b => [b.id, b]));
      const rBlocks = new Map((remoteDay.calBlocks || []).map(b => [b.id, b]));
      const allIds = new Set([...lBlocks.keys(), ...rBlocks.keys()]);
      merged.calBlocks = [];
      for (const id of allIds) {
        const lb = lBlocks.get(id);
        const rb = rBlocks.get(id);
        if (!lb) merged.calBlocks.push(rb);
        else if (!rb) merged.calBlocks.push(lb);
        else merged.calBlocks.push((rb.lastMod || 0) > (lb.lastMod || 0) ? rb : lb);
      }
    }

    // t3intentions: per-chip merge by ID, OR for done state
    if (localDay.t3intentions || remoteDay.t3intentions) {
      const lt = localDay.t3intentions || {};
      const rt = remoteDay.t3intentions || {};
      merged.t3intentions = {};
      for (const cat of ['work', 'school', 'life']) {
        const lArr = lt[cat] || [];
        const rArr = rt[cat] || [];
        const lMap = new Map(lArr.map(c => [c.id || c.text, c]));
        const rMap = new Map(rArr.map(c => [c.id || c.text, c]));
        const allIds = new Set([...lMap.keys(), ...rMap.keys()]);
        merged.t3intentions[cat] = [];
        for (const cid of allIds) {
          const lc = lMap.get(cid);
          const rc = rMap.get(cid);
          if (!lc) merged.t3intentions[cat].push(rc);
          else if (!rc) merged.t3intentions[cat].push(lc);
          else {
            // Both sides have this chip — merge: OR for done, keep longer text
            const m = Object.assign({}, lc, rc);
            m.done = !!(lc.done || rc.done);
            if ((lc.text || '').length > (rc.text || '').length) m.text = lc.text;
            merged.t3intentions[cat].push(m);
          }
        }
      }
    }

    // meals: last-write-wins — take whichever side has the higher lastMod timestamp
    // This prevents deleted items from reappearing and edited quantities from reverting
    if (localDay.meals || remoteDay.meals) {
      const lm = localDay.meals || {};
      const rm = remoteDay.meals || {};
      const lMod = lm.lastMod || 0;
      const rMod = rm.lastMod || 0;
      merged.meals = lMod >= rMod ? JSON.parse(JSON.stringify(lm)) : JSON.parse(JSON.stringify(rm));
    }

    // italian: per-field OR for boolean checkboxes, keep longer for strings
    if (localDay.italian || remoteDay.italian) {
      const li = localDay.italian || {};
      const ri = remoteDay.italian || {};
      merged.italian = Object.assign({}, li, ri);
      for (const key of Object.keys(merged.italian)) {
        if (typeof li[key] === 'boolean' || typeof ri[key] === 'boolean') {
          merged.italian[key] = !!(li[key] || ri[key]);
        }
      }
    }

    // lastMod: keep the higher value
    merged.lastMod = Math.max(localDay.lastMod || 0, remoteDay.lastMod || 0);

    return merged;
  }

  // Field-level merge for a single week: never lose user content
  function mergeWeekFields(localWeek, remoteWeek) {
    if (!localWeek) return remoteWeek;
    if (!remoteWeek) return localWeek;

    const merged = Object.assign({}, localWeek, remoteWeek);

    // goals: merge by ID, keep higher lastMod per goal
    if (localWeek.goals || remoteWeek.goals) {
      const lGoals = new Map((localWeek.goals || []).map(g => [g.id || g.text, g]));
      const rGoals = new Map((remoteWeek.goals || []).map(g => [g.id || g.text, g]));
      const allIds = new Set([...lGoals.keys(), ...rGoals.keys()]);
      merged.goals = [];
      for (const id of allIds) {
        const lg = lGoals.get(id);
        const rg = rGoals.get(id);
        if (!lg) merged.goals.push(rg);
        else if (!rg) merged.goals.push(lg);
        else merged.goals.push((rg.lastMod || 0) > (lg.lastMod || 0) ? rg : lg);
      }
    }

    // review: keep the non-null / more complete one
    if (localWeek.review || remoteWeek.review) {
      if (!localWeek.review) merged.review = remoteWeek.review;
      else if (!remoteWeek.review) merged.review = localWeek.review;
      else {
        const lLen = JSON.stringify(localWeek.review).length;
        const rLen = JSON.stringify(remoteWeek.review).length;
        merged.review = lLen >= rLen ? localWeek.review : remoteWeek.review;
      }
    }

    // String fields: keep the longer one
    for (const field of ['notes', 'pushGoal']) {
      const l = (localWeek[field] || '').toString();
      const r = (remoteWeek[field] || '').toString();
      merged[field] = l.length >= r.length ? l : r;
    }

    // stretchGoals: keep the submitted one, or the one with more content
    if (localWeek.stretchGoals || remoteWeek.stretchGoals) {
      const ls = localWeek.stretchGoals;
      const rs = remoteWeek.stretchGoals;
      if (!ls) merged.stretchGoals = rs;
      else if (!rs) merged.stretchGoals = ls;
      else if (rs.submitted && !ls.submitted) merged.stretchGoals = rs;
      else if (ls.submitted && !rs.submitted) merged.stretchGoals = ls;
      else merged.stretchGoals = (JSON.stringify(ls).length >= JSON.stringify(rs).length) ? ls : rs;
    }

    // lastMod: keep the higher value
    merged.lastMod = Math.max(localWeek.lastMod || 0, remoteWeek.lastMod || 0);

    return merged;
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

    // Merge days per-date: FIELD-LEVEL merge (never lose content)
    if (local.days || remote.days) {
      const localDays = local.days || {};
      const remoteDays = remote.days || {};
      const mergedDays = Object.assign({}, localDays);
      for (const date of Object.keys(remoteDays)) {
        mergedDays[date] = mergeDayFields(mergedDays[date], remoteDays[date]);
      }
      result.days = mergedDays;
    }

    // Merge weeks per-weekId: FIELD-LEVEL merge (never lose content)
    if (local.weeks || remote.weeks) {
      const localWeeks = local.weeks || {};
      const remoteWeeks = remote.weeks || {};
      const mergedWeeks = Object.assign({}, localWeeks);
      for (const wk of Object.keys(remoteWeeks)) {
        mergedWeeks[wk] = mergeWeekFields(mergedWeeks[wk], remoteWeeks[wk]);
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

    // Merge weekGoals: per-week, per-category, keep longer HTML
    if (local.weekGoals || remote.weekGoals) {
      const lw = local.weekGoals || {};
      const rw = remote.weekGoals || {};
      const mergedWG = Object.assign({}, lw);
      for (const wk of Object.keys(rw)) {
        if (!mergedWG[wk]) { mergedWG[wk] = rw[wk]; continue; }
        const lWeek = mergedWG[wk];
        const rWeek = rw[wk];
        for (const cat of ['work', 'school', 'life']) {
          const l = (lWeek[cat] || '').toString();
          const r = (rWeek[cat] || '').toString();
          lWeek[cat] = l.length >= r.length ? l : r;
        }
      }
      result.weekGoals = mergedWG;
    }

    // Merge dissWeeklyGoals: per-week, keep longer HTML
    if (local.dissWeeklyGoals || remote.dissWeeklyGoals) {
      const ld = local.dissWeeklyGoals || {};
      const rd = remote.dissWeeklyGoals || {};
      const mergedDWG = Object.assign({}, ld);
      for (const wk of Object.keys(rd)) {
        const l = (mergedDWG[wk] || '').toString();
        const r = (rd[wk] || '').toString();
        mergedDWG[wk] = l.length >= r.length ? l : r;
      }
      result.dissWeeklyGoals = mergedDWG;
    }

    // Merge mealLibrary: per-ID, keep higher usageCount, new meals from either side kept
    if (local.mealLibrary || remote.mealLibrary) {
      const lMap = new Map((local.mealLibrary || []).map(m => [m.id, m]));
      const rMap = new Map((remote.mealLibrary || []).map(m => [m.id, m]));
      const allIds = new Set([...lMap.keys(), ...rMap.keys()]);
      result.mealLibrary = [];
      for (const id of allIds) {
        const lm = lMap.get(id);
        const rm = rMap.get(id);
        if (!lm) result.mealLibrary.push(rm);
        else if (!rm) result.mealLibrary.push(lm);
        else result.mealLibrary.push((rm.usageCount || 0) > (lm.usageCount || 0) ? rm : lm);
      }
    }

    // Merge readingHistory: union by date+title
    if (local.readingHistory || remote.readingHistory) {
      const seen = new Set();
      const merged = [];
      for (const entry of [...(local.readingHistory || []), ...(remote.readingHistory || [])]) {
        const key = (entry.date || '') + '|' + (entry.title || '').slice(0, 60);
        if (!seen.has(key)) { seen.add(key); merged.push(entry); }
      }
      merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      result.readingHistory = merged;
    }

    // Merge corrections: union by date, keep longer response
    if (local.corrections || remote.corrections) {
      const byDate = new Map();
      for (const entry of [...(local.corrections || []), ...(remote.corrections || [])]) {
        const existing = byDate.get(entry.date);
        if (!existing) { byDate.set(entry.date, entry); }
        else {
          const eLen = (existing.response || '').length + (existing.text || '').length;
          const nLen = (entry.response || '').length + (entry.text || '').length;
          if (nLen > eLen) byDate.set(entry.date, entry);
        }
      }
      result.corrections = Array.from(byDate.values());
    }

    // Merge dissSessions: union by date+minutes dedup
    if (local.dissSessions || remote.dissSessions) {
      const seen = new Set();
      const merged = [];
      for (const entry of [...(local.dissSessions || []), ...(remote.dissSessions || [])]) {
        const key = (entry.date || '') + '|' + (entry.minutes || 0) + '|' + (entry.ts || '');
        if (!seen.has(key)) { seen.add(key); merged.push(entry); }
      }
      merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      result.dissSessions = merged;
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
        // Always merge — field-level merge is idempotent and safe in both directions
        _importing = true;
        importRemoteData(remote);
        const remoteTs = remote._lastSync || 0;
        localStorage.setItem('_lastSync', String(Math.max(remoteTs, parseInt(localStorage.getItem('_lastSync') || '0'))));
        if (typeof loadAll === 'function') loadAll();
        _importing = false;
        clearTimeout(debounceTimer);
        _importCooldown = Date.now() + 2000;
        // Push merged result back so both sides converge
        setTimeout(() => pushAll(), 2500);
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
          // Always merge — field-level merge is idempotent
          _importing = true;
          importRemoteData(remote);
          const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
          localStorage.setItem('_lastSync', String(Math.max(remoteTs, localTs)));
          if (typeof loadAll === 'function') loadAll();
          _importing = false;
          clearTimeout(debounceTimer);
          _importCooldown = Date.now() + 2000;
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
      if (remoteTs === _lastPushTs) return; // our own echo
      // Always merge — field-level merge is idempotent
      _importing = true;
      importRemoteData(remote);
      const localTs = parseInt(localStorage.getItem('_lastSync') || '0');
      localStorage.setItem('_lastSync', String(Math.max(remoteTs, localTs)));
      if (typeof loadAll === 'function') loadAll();
      _importing = false;
      clearTimeout(debounceTimer);
      _importCooldown = Date.now() + 2000;
      setStatus(navigator.onLine ? 'synced' : 'offline');
      // Push merged result back so both sides converge
      setTimeout(() => pushAll(), 2500);
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