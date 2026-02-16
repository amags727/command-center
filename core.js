// ============ CORE: DATA LAYER ============
const KEY = 'cmdcenter';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange(); }
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function weekId(d) { const dt = new Date(d || today()); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); const mon = new Date(dt.setDate(diff)); return mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0'); }
function dayData(date) { const d = load(); if (!d.days) d.days = {}; if (!d.days[date]) d.days[date] = { habits: {}, blocks: [], top3: [], intentions: [], bundles: [], reflection: '', sealed: false, distractions: [], energy: [], dissTime: 0 }; return d; }
function weekData(wk) { const d = load(); if (!d.weeks) d.weeks = {}; if (!d.weeks[wk]) d.weeks[wk] = { goals: [], review: null, pushGoal: '' }; return d; }
function getGlobal() { const d = load(); if (!d.chapters) d.chapters = []; if (!d.dissSessions) d.dissSessions = []; if (!d.log) d.log = []; if (!d.chatHistory) d.chatHistory = []; if (!d.ankiCards) d.ankiCards = []; if (!d.corrections) d.corrections = []; return d; }
function addLog(type, msg) { const d = load(); if (!d.log) d.log = []; d.log.unshift({ type, msg, ts: new Date().toISOString() }); if (d.log.length > 500) d.log = d.log.slice(0, 500); save(d); }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function offsetWeekId(baseWeek, n) { const dt = new Date(baseWeek + 'T00:00:00'); dt.setDate(dt.getDate() + n * 7); return weekId(dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0') + 'T00:00:00'); }
function weekMonday(wk) { return new Date(wk + 'T00:00:00'); }
function weekDates(wk) { const mon = weekMonday(wk); return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }); }
