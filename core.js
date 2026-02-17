// ============ CORE: DATA LAYER ============
const KEY = 'cmdcenter';
let _pendingDayMark = null;
let _pendingWeekMark = null;
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(d) {
  // Auto-stamp lastMod on any day/week that was opened via dayData()/weekData()
  if (_pendingDayMark && d.days && d.days[_pendingDayMark]) d.days[_pendingDayMark].lastMod = Date.now();
  if (_pendingWeekMark && d.weeks && d.weeks[_pendingWeekMark]) d.weeks[_pendingWeekMark].lastMod = Date.now();
  d._lastMod = Date.now();
  _pendingDayMark = null; _pendingWeekMark = null;
  localStorage.setItem(KEY, JSON.stringify(d));
  if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange();
}
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function weekId(d) { const raw = d || today(); const dt = new Date(raw.length > 10 ? raw : raw + 'T00:00:00'); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); const mon = new Date(dt.setDate(diff)); return mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0'); }
function dayData(date) { _pendingDayMark = date; const d = load(); if (!d.days) d.days = {}; if (!d.days[date]) d.days[date] = { habits: {}, blocks: [], top3: [], intentions: [], bundles: [], reflection: '', sealed: false, distractions: [], energy: [], dissTime: 0 }; return d; }
function weekData(wk) { _pendingWeekMark = wk; const d = load(); if (!d.weeks) d.weeks = {}; if (!d.weeks[wk]) d.weeks[wk] = { goals: [], review: null, pushGoal: '' }; return d; }
function getGlobal() { const d = load(); if (!d.chapters) d.chapters = []; if (!d.dissSessions) d.dissSessions = []; if (!d.log) d.log = []; if (!d.chatHistory) d.chatHistory = []; if (!d.ankiCards) d.ankiCards = []; if (!d.corrections) d.corrections = []; return d; }
function addLog(type, msg) { const d = load(); if (!d.log) d.log = []; d.log.unshift({ type, msg, ts: new Date().toISOString() }); if (d.log.length > 500) d.log = d.log.slice(0, 500); save(d); }
function markDay(d, date) { if (d.days && d.days[date]) d.days[date].lastMod = Date.now(); }
function markWeek(d, wk) { if (d.weeks && d.weeks[wk]) d.weeks[wk].lastMod = Date.now(); }
function markGlobal(d) { d._lastMod = Date.now(); }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function offsetWeekId(baseWeek, n) { const dt = new Date(baseWeek + 'T00:00:00'); dt.setDate(dt.getDate() + n * 7); return weekId(dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0') + 'T00:00:00'); }
function weekMonday(wk) { return new Date(wk + 'T00:00:00'); }
function weekDates(wk) { const mon = weekMonday(wk); return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }); }
function hasStretchGoals(wk) { const d = load(); return !!(d.weeks && d.weeks[wk] && d.weeks[wk].stretchGoals && d.weeks[wk].stretchGoals.submitted); }
function getStretchGoals(wk) { const d = load(); if (!d.weeks || !d.weeks[wk] || !d.weeks[wk].stretchGoals) return null; return d.weeks[wk].stretchGoals; }
function getStretchGoalHistory() { const d = load(); if (!d.weeks) return []; return Object.keys(d.weeks).filter(wk => d.weeks[wk].stretchGoals?.goals).map(wk => ({ week: wk, goals: d.weeks[wk].stretchGoals.goals.map(g => ({ text: g.text, type: g.type, completed: g.completed })) })).sort((a,b) => b.week.localeCompare(a.week)); }
