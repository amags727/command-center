// ============ WEEK TAB ============
let _weekGoalOffset = 0;
function _activeWeekId() { return _weekGoalOffset === 0 ? weekId() : offsetWeekId(weekId(), _weekGoalOffset); }
function shiftWeekGoals(dir) {
  const newOff = _weekGoalOffset + dir;
  if (newOff < 0 || newOff > 1) return;
  _weekGoalOffset = newOff;
  loadWeekGoals();
  const label = document.getElementById('wk-goal-label');
  if (label) label.textContent = _weekGoalOffset === 0 ? 'This Week' : 'Next Week (' + _activeWeekId() + ')';
  const indicator = document.getElementById('wk-goal-indicator');
  if (indicator) indicator.style.display = _weekGoalOffset === 0 ? 'none' : 'inline';
}
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
  syncWeekGoalsDoneState();
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

/* Save helper: dispatches to the correct save function for any wg-editor */
function _saveActiveEditor(el) {
  if (!el) return;
  if (el.id === 'today-notes' && typeof saveTodayNotes === 'function') { saveTodayNotes(); return; }
  if (el.id === 'diss-weekly-goals' && typeof saveDissWeeklyGoals === 'function') { saveDissWeeklyGoals(); return; }
  const cat = el.id.replace('wg-', '');
  saveWeekGoals(cat);
}


function saveWeekGoals(cat) {
  const el = document.getElementById('wg-'+cat);
  if (!el) return;
  // Clone and strip visual-only done markers before saving
  const clone = el.cloneNode(true);
  clone.querySelectorAll('[data-wg-done]').forEach(sp => sp.removeAttribute('data-wg-done'));
  const d = getGlobal();
  const targetWk = _activeWeekId();
  if (!d.weekGoals) d.weekGoals = {};
  if (!d.weekGoals[targetWk]) d.weekGoals[targetWk] = {};
  d.weekGoals[targetWk][cat] = clone.innerHTML;
  // Always sync school goals to dissWeeklyGoals for the target week
  if (cat === 'school') {
    if (!d.dissWeeklyGoals) d.dissWeeklyGoals = {};
    d.dissWeeklyGoals[targetWk] = clone.innerHTML;
  }
  save(d);
  // If editing current week, also update the visible Dissertation tab element
  if (cat === 'school' && _weekGoalOffset === 0) {
    const dissEl = document.getElementById('diss-weekly-goals');
    if (dissEl) dissEl.innerHTML = el.innerHTML;
  }
}

function loadWeekGoals() {
  const d = getGlobal();
  const targetWk = _activeWeekId();
  const wk = d.weekGoals && d.weekGoals[targetWk] || {};
  ['work','school','life'].forEach(cat => {
    const el = document.getElementById('wg-'+cat);
    if (!el) return;
    let html = wk[cat] || '';
    // Fallback: if school is empty, check dissWeeklyGoals
    if (cat === 'school' && !html && d.dissWeeklyGoals && d.dissWeeklyGoals[targetWk]) {
      html = d.dissWeeklyGoals[targetWk];
      // Heal the split: persist into weekGoals too
      if (!d.weekGoals) d.weekGoals = {};
      if (!d.weekGoals[targetWk]) d.weekGoals[targetWk] = {};
      d.weekGoals[targetWk].school = html;
      save(d);
    }
    el.innerHTML = html;
  });
}

/* Strip all [data-day] spans inside a range, keeping text content */
function _stripHighlightsInRange(container, range) {
  container.querySelectorAll('[data-day]').forEach(sp => {
    if (range.intersectsNode(sp)) {
      const parent = sp.parentNode;
      while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
      parent.removeChild(sp);
    }
  });
  container.normalize(); // merge adjacent text nodes
}

function weekGoalAssignDay(cat, day) {
  const el = document.getElementById('wg-'+cat);
  if (!el) return;
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return;

  // 1) Strip any existing day-highlights in the selection first
  _stripHighlightsInRange(el, range);

  // 2) Re-acquire selection (stripping may have shifted nodes)
  const sel2 = window.getSelection();
  if (!sel2.rangeCount || sel2.isCollapsed) { saveWeekGoals(cat); return; }
  const range2 = sel2.getRangeAt(0);

  // 3) Robust wrap: extract → wrap in span → re-insert (avoids surroundContents failures)
  const frag = range2.extractContents();
  const span = document.createElement('span');
  span.setAttribute('data-day', day);
  span.style.background = DAY_COLORS[day] || '#eee';
  span.appendChild(frag);
  range2.insertNode(span);

  sel2.removeAllRanges();
  saveWeekGoals(cat);
}

function weekGoalClearHighlights(cat) {
  const el = document.getElementById('wg-'+cat);
  if (!el) return;
  const sel = window.getSelection();
  if (sel.rangeCount && !sel.isCollapsed && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    _stripHighlightsInRange(el, sel.getRangeAt(0));
    sel.removeAllRanges();
  } else {
    // No selection: clear ALL highlights in this editor
    el.querySelectorAll('[data-day]').forEach(sp => {
      const parent = sp.parentNode;
      while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
      parent.removeChild(sp);
    });
    el.normalize();
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

/* Shift+Tab → split into columns (max 3); Backspace at col start → merge back */
document.addEventListener('keydown', function(e) {
  const el = document.activeElement;
  if (!el || !el.classList.contains('wg-editor')) return;

  // ── Shift+Tab: create / add column ──
  if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    let colsWrap = el.querySelector('.wg-columns');
    const colCount = colsWrap ? colsWrap.querySelectorAll(':scope > .wg-col').length : 1;
    if (colCount >= 3) return; // max 3

    if (!colsWrap) {
      // First split: wrap all existing content into a columns container
      const beforeRange = document.createRange();
      beforeRange.setStart(el, 0);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const beforeFrag = beforeRange.extractContents();

      const afterFrag = document.createRange();
      afterFrag.selectNodeContents(el);
      const afterContent = afterFrag.extractContents();

      colsWrap = document.createElement('div');
      colsWrap.className = 'wg-columns';

      const col1 = document.createElement('div');
      col1.className = 'wg-col';
      col1.appendChild(beforeFrag);
      if (!col1.innerHTML.trim()) col1.innerHTML = '<br>';

      const col2 = document.createElement('div');
      col2.className = 'wg-col';
      col2.appendChild(afterContent);
      if (!col2.innerHTML.trim()) col2.innerHTML = '<br>';

      colsWrap.appendChild(col1);
      colsWrap.appendChild(col2);
      el.innerHTML = '';
      el.appendChild(colsWrap);

      // Place cursor at start of col2
      const newRange = document.createRange();
      newRange.setStart(col2, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      // Already have columns — split the current column at cursor
      let curCol = range.startContainer;
      while (curCol && !curCol.classList?.contains('wg-col')) curCol = curCol.parentNode;
      if (!curCol || !colsWrap.contains(curCol)) return;

      const beforeRange = document.createRange();
      beforeRange.setStart(curCol, 0);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const beforeFrag = beforeRange.extractContents();

      const afterRange = document.createRange();
      afterRange.selectNodeContents(curCol);
      const afterFrag = afterRange.extractContents();

      curCol.innerHTML = '';
      curCol.appendChild(beforeFrag);
      if (!curCol.innerHTML.trim()) curCol.innerHTML = '<br>';

      const newCol = document.createElement('div');
      newCol.className = 'wg-col';
      newCol.appendChild(afterFrag);
      if (!newCol.innerHTML.trim()) newCol.innerHTML = '<br>';

      curCol.after(newCol);

      const newRange = document.createRange();
      newRange.setStart(newCol, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    _saveActiveEditor(el);
    return;
  }

  // ── Backspace at start of a non-first column → merge into previous ──
  if (e.key === 'Backspace') {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);

    let curCol = range.startContainer;
    while (curCol && !curCol.classList?.contains('wg-col')) curCol = curCol.parentNode;
    if (!curCol) return;

    const colsWrap = curCol.parentElement;
    if (!colsWrap || !colsWrap.classList.contains('wg-columns')) return;

    // Check cursor is at very start of this column
    const testRange = document.createRange();
    testRange.setStart(curCol, 0);
    testRange.setEnd(range.startContainer, range.startOffset);
    if (testRange.toString().length > 0) return; // not at start

    const cols = Array.from(colsWrap.querySelectorAll(':scope > .wg-col'));
    const idx = cols.indexOf(curCol);
    if (idx <= 0) return; // first column, nothing to merge into

    e.preventDefault();
    const prevCol = cols[idx - 1];

    // Remove trailing <br> from prev col before merging
    if (prevCol.lastChild && prevCol.lastChild.nodeName === 'BR' && prevCol.childNodes.length > 0) {
      // only remove if there's other content
      if (prevCol.textContent.trim()) prevCol.lastChild.remove();
    }

    // Mark merge point for cursor placement
    const marker = document.createTextNode('\u200B');
    prevCol.appendChild(marker);

    // Move all children from current col to prev col
    while (curCol.firstChild) {
      prevCol.appendChild(curCol.firstChild);
    }
    curCol.remove();

    // If only 1 column left, unwrap the columns structure
    const remaining = colsWrap.querySelectorAll(':scope > .wg-col');
    if (remaining.length <= 1) {
      const lastCol = remaining[0];
      while (lastCol.firstChild) colsWrap.before(lastCol.firstChild);
      colsWrap.remove();
    }

    // Place cursor at merge point
    const newRange = document.createRange();
    newRange.setStartAfter(marker);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    // Clean up zero-width space after a tick
    setTimeout(() => { if (marker.parentNode) marker.remove(); }, 50);

    _saveActiveEditor(el);
    return;
  }
});

/* Enter handler: strip inherited strikethrough + day-highlight on new lines */
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const el = document.activeElement;
  if (!el || !el.classList.contains('wg-editor')) return;

  // If cursor is inside a .wg-col but NOT inside a list, force <br> insertion
  // to prevent the browser from creating a sibling div that looks like a new column.
  // If inside a list (ul/ol/li), let the browser handle Enter normally to create new <li>.
  const sel0 = window.getSelection();
  if (sel0.rangeCount) {
    let n = sel0.getRangeAt(0).startContainer;
    let inCol = false, inList = false;
    while (n && n !== el) {
      if (n.nodeType === 1) {
        if (n.classList && n.classList.contains('wg-col')) inCol = true;
        const tag = n.nodeName;
        if (tag === 'LI' || tag === 'UL' || tag === 'OL') inList = true;
      }
      n = n.parentNode;
    }
    if (inCol && !inList) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      _saveActiveEditor(el);
      return;
    }
  }
  // Let default Enter happen first, then clean up the new line
  setTimeout(function() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.anchorNode;
    // Walk up to check for strikethrough or highlight wrappers
    let cursor = node;
    while (cursor && cursor !== el) {
      // Strip strikethrough
      if (cursor.nodeName === 'S' || cursor.nodeName === 'DEL' ||
          (cursor.style && cursor.style.textDecoration && cursor.style.textDecoration.includes('line-through'))) {
        document.execCommand('strikethrough');
        break;
      }
      cursor = cursor.parentNode;
    }
    // Strip day-highlight spans wrapping the new empty line
    cursor = node;
    while (cursor && cursor !== el) {
      if (cursor.nodeType === 1 && cursor.hasAttribute('data-day')) {
        // If span is empty or just has a BR, unwrap it
        const txt = cursor.textContent.trim();
        if (txt === '' || txt === '\n') {
          const parent = cursor.parentNode;
          while (cursor.firstChild) parent.insertBefore(cursor.firstChild, cursor);
          parent.removeChild(cursor);
          break;
        }
      }
      cursor = cursor.parentNode;
    }
    _saveActiveEditor(el);
  }, 0);
});

/* Sync done state: scan this week's daily chips, mark matching weekly goal spans */
function syncWeekGoalsDoneState() {
  const d = load();
  const wk = weekId();
  const days = d.days || {};
  // Collect all done chip texts per category across the week
  const doneTexts = { work: new Set(), school: new Set(), life: new Set() };
  for (let i = 0; i < 7; i++) {
    const dt = new Date(wk);
    dt.setDate(dt.getDate() + i);
    const key = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    const day = days[key];
    if (!day || !day.t3intentions) continue;
    const t3 = day.t3intentions;
    ['work','school','life'].forEach(cat => {
      (t3[cat] || []).forEach(chip => {
        if (chip.done && chip.text && chip.text.trim()) {
          doneTexts[cat].add(chip.text.trim());
        }
      });
    });
  }
  // Apply/remove data-wg-done on [data-day] spans in each editor
  ['work','school','life'].forEach(cat => {
    const el = document.getElementById('wg-'+cat);
    if (!el) return;
    el.querySelectorAll('[data-day]').forEach(span => {
      const text = span.textContent.trim();
      if (doneTexts[cat].has(text)) {
        span.setAttribute('data-wg-done', 'true');
      } else {
        span.removeAttribute('data-wg-done');
      }
    });
  });
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


