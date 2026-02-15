// ============ WEEK TAB ============
function renderWeek() {
  const wk = weekId(); document.getElementById('wk-date').textContent = wk;
  const d = load(), days = d.days || {};
  let gym = 0, anki = 0, art = 0, convo = 0, refl = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(wk); dt.setDate(dt.getDate() + i); const key = dt.toISOString().slice(0, 10), day = days[key];
    if (day && day.habits) { if (day.habits.gym) gym++; if (day.habits.anki) anki++; if (day.habits.art1) art++; if (day.habits.art2) art++; if (day.habits.convo) convo++; }
    if (day && day.reflection && day.reflection.trim().split(/\s+/).filter(w => w).length >= 200) refl++;
  }
  const dissHrs = ((d.dissSessions || []).filter(s => { const sd = new Date(s.date), wkd = new Date(wk); return sd >= wkd && sd < new Date(wkd.getTime() + 7 * 86400000); }).reduce((a, s) => a + s.minutes, 0) / 60).toFixed(1);
  document.getElementById('wk-gym').textContent = gym; document.getElementById('wk-anki').textContent = anki;
  document.getElementById('wk-art').textContent = art; document.getElementById('wk-convo').textContent = convo;
  document.getElementById('wk-refl').textContent = refl; document.getElementById('wk-diss').textContent = dissHrs;
  renderCWG();
  renderDailySummaries();
  loadWeekGoals();
  switchWeekGoalTab('work');
}
function addCWG() { const v = document.getElementById('cw-in').value.trim(), cat = document.getElementById('cw-cat').value; if (!v) return; const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals.push({ text: v, cat, done: false }); save(wd); document.getElementById('cw-in').value = ''; renderCWG(); }
function renderDailySummaries() {
  const container = document.getElementById('daily-summaries');
  if (!container) return;
  const wk = weekId();
  const mon = new Date(wk);
  const d = load();
  let html = '';
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayKey = today();
  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    const key = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    if (key === todayKey) continue;
    const notes = d.days && d.days[key] && d.days[key].notes;
    if (!notes || !notes.replace(/<[^>]*>/g,'').trim()) continue;
    const label = days[dt.getDay()] + ', ' + dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    html += '<details class="card" style="margin-bottom:6px"><summary style="cursor:pointer;font-weight:600;font-size:13px">' + label + ' — Daily Notes</summary><div style="padding:8px;font-size:13px;line-height:1.6">' + notes + '</div></details>';
  }
  container.innerHTML = html || '<p style="font-size:12px;color:var(--muted);font-style:italic">No daily notes from this week yet.</p>';
}
function renderCWG() {
  const wk = weekId(), wd = weekData(wk), goals = wd.weeks[wk].goals || [];
  const catMap = { work: 'work', dissertation: 'diss', italian: 'ital', social: 'social', misc: 'misc' };
  document.getElementById('cw-goals').innerHTML = goals.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No custom goals.</p>' : goals.map((g, i) => '<div class="hrow"><input type="checkbox" class="hchk" ' + (g.done ? 'checked' : '') + ' onchange="toggleCWG(' + i + ')"><div class="hinfo"><span class="label l-' + (catMap[g.cat] || 'misc') + '">' + g.cat + '</span> <span style="' + (g.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + g.text + '</span></div><button class="btn" style="font-size:10px;padding:2px 6px" onclick="rmCWG(' + i + ')">✕</button></div>').join('');
}
function toggleCWG(i) { const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals[i].done = !wd.weeks[wk].goals[i].done; save(wd); renderCWG(); }
function rmCWG(i) { const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals.splice(i, 1); save(wd); renderCWG(); }
// ── Weekly Goals (Work / School / Life) ─────────────────────────
const DAY_COLORS = {mon:'#FFB3B3',tue:'#FFD9B3',wed:'#FFFFB3',thu:'#B3FFB3',fri:'#B3D9FF',sat:'#D9B3FF',sun:'#FFB3E6'};

function switchWeekGoalTab(cat) {
  ['work','school','life'].forEach(c => {
    const p = document.getElementById('wg-panel-'+c);
    const b = document.getElementById('wg-tab-btn-'+c);
    if (!p || !b) return;
    if (c === cat) { p.style.display=''; b.classList.add('active'); }
    else { p.style.display='none'; b.classList.remove('active'); }
  });
}

function saveWeekGoals(cat) {
  const el = document.getElementById('wg-'+cat);
  if (!el) return;
  const d = getGlobal();
  if (!d.weekGoals) d.weekGoals = {};
  if (!d.weekGoals[weekId()]) d.weekGoals[weekId()] = {};
  d.weekGoals[weekId()][cat] = el.innerHTML;
  save(d);
  if (cat === 'school' && typeof populateDissWeeklyGoals === 'function') populateDissWeeklyGoals();
}

function loadWeekGoals() {
  const d = getGlobal();
  const wk = d.weekGoals && d.weekGoals[weekId()] || {};
  ['work','school','life'].forEach(cat => {
    const el = document.getElementById('wg-'+cat);
    if (el) el.innerHTML = wk[cat] || '';
  });
}

function weekGoalAssignDay(cat, day) {
  const el = document.getElementById('wg-'+cat);
  if (!el) return;
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return;
  const span = document.createElement('span');
  span.setAttribute('data-day', day);
  span.style.background = DAY_COLORS[day] || '#eee';
  range.surroundContents(span);
  sel.removeAllRanges();
  saveWeekGoals(cat);
}

function weekGoalClearHighlights(cat) {
  const el = document.getElementById('wg-'+cat);
  if (!el) return;
  const sel = window.getSelection();
  if (sel.rangeCount && !sel.isCollapsed && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const range = sel.getRangeAt(0);
    el.querySelectorAll('[data-day]').forEach(sp => {
      if (range.intersectsNode(sp)) {
        const parent = sp.parentNode;
        while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
        parent.removeChild(sp);
      }
    });
    sel.removeAllRanges();
  } else {
    el.querySelectorAll('[data-day]').forEach(sp => {
      const parent = sp.parentNode;
      while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
      parent.removeChild(sp);
    });
  }
  saveWeekGoals(cat);
}

/* Auto-detect which wg-editor has the selection */
function _wgDetectCat() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  for (const cat of ['work','school','life']) {
    const el = document.getElementById('wg-'+cat);
    if (el && el.contains(node)) return cat;
  }
  return null;
}
function weekGoalAssignDayAuto(day) {
  const cat = _wgDetectCat();
  if (cat) { weekGoalAssignDay(cat, day); return; }
  // fallback: if no selection, try last focused editor
  const focused = document.activeElement;
  if (focused && focused.classList.contains('wg-editor')) {
    const id = focused.id.replace('wg-','');
    weekGoalAssignDay(id, day);
  }
}
function weekGoalClearHighlightsAuto() {
  const cat = _wgDetectCat();
  if (cat) { weekGoalClearHighlights(cat); return; }
  // no selection: clear all three
  ['work','school','life'].forEach(c => weekGoalClearHighlights(c));
}

function populateSchoolWeeklyGoals() {
  const d = getGlobal();
  const html = d.dissWeeklyGoals && d.dissWeeklyGoals[weekId()] || '';
  const el = document.getElementById('wg-school');
  if (el) el.innerHTML = html;
  if (!d.weekGoals) d.weekGoals = {};
  if (!d.weekGoals[weekId()]) d.weekGoals[weekId()] = {};
  d.weekGoals[weekId()].school = html;
  save(d);
}

function populateDissWeeklyGoals() {
  const d = getGlobal();
  const html = d.weekGoals && d.weekGoals[weekId()] && d.weekGoals[weekId()].school || '';
  const el = document.getElementById('diss-weekly-goals');
  if (el) el.innerHTML = html;
  if (!d.dissWeeklyGoals) d.dissWeeklyGoals = {};
  d.dissWeeklyGoals[weekId()] = html;
  save(d);
}

function submitWR() {
  const well = document.getElementById('wr-well').value.trim(), bad = document.getElementById('wr-bad').value.trim(), imp = document.getElementById('wr-imp').value.trim(), push = document.getElementById('wr-push').value.trim();
  if (!well || !bad || !imp) { alert('Complete all review prompts.'); return; }
  const wk = weekId(), wd = weekData(wk); wd.weeks[wk].review = { well, bad, imp, push, ts: new Date().toISOString() }; save(wd);
  document.getElementById('wr-res').style.display = 'block'; document.getElementById('wr-res').innerHTML = '<p style="color:var(--green);font-weight:600">✅ Weekly review submitted!</p>'; addLog('action', 'Weekly review: ' + wk);
}


