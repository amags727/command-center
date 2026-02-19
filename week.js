// ============ WEEK TAB ============
let _weekGoalOffset = 0;
function _activeWeekId() { return _weekGoalOffset === 0 ? weekId() : offsetWeekId(weekId(), _weekGoalOffset); }
function shiftWeekGoals(dir) {
  const newOff = _weekGoalOffset + dir;
  if (newOff < 0 || newOff > 1) return;
  _weekGoalOffset = newOff;
  loadWeekGoals();
  const label = document.getElementById('week-goal-label');
  if (label) label.textContent = _weekGoalOffset === 0 ? 'This Week' : 'Next Week (' + _activeWeekId() + ')';
  const indicator = document.getElementById('week-goal-indicator');
  if (indicator) indicator.style.display = _weekGoalOffset === 0 ? 'none' : 'inline';
}
function renderWeek() {
  const wk = weekId(); document.getElementById('week-date').textContent = wk;
  renderStretchGoals();
  renderDailySummaries();
  loadWeekGoals();
  syncWeekGoalsDoneState();
}
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
// ── Weekly Goals (Work / School / Life) ─────────────────────────
const DAY_COLORS = {mon:'#FFB3B3',tue:'#FFD9B3',wed:'#FFFFB3',thu:'#B3FFB3',fri:'#B3D9FF',sat:'#D9B3FF',sun:'#FFB3E6'};

/* Save helper: dispatches to the correct save function for any wg-editor */
function _saveActiveEditor(el) {
  if (!el) return;
  if (el.id === 'today-notes' && typeof saveTodayNotes === 'function') { saveTodayNotes(); return; }
  if (el.id === 'diss-weekly-goals' && typeof saveDissWeeklyGoals === 'function') { saveDissWeeklyGoals(); return; }
  const cat = el.id.replace('week-goals-', '');
  saveWeekGoals(cat);
}


function saveWeekGoals(cat) {
  const el = document.getElementById('week-goals-'+cat);
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
    const el = document.getElementById('week-goals-'+cat);
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
  const el = document.getElementById('week-goals-'+cat);
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
  const el = document.getElementById('week-goals-'+cat);
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
    const el = document.getElementById('week-goals-'+cat);
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
    const id = focused.id.replace('week-goals-','');
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
    const el = document.getElementById('week-goals-'+cat);
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
  const el = document.getElementById('week-goals-school');
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
  const well = document.getElementById('weekly-review-well').value.trim(), bad = document.getElementById('weekly-review-bad').value.trim(), imp = document.getElementById('weekly-review-improve').value.trim(), push = document.getElementById('weekly-review-push').value.trim();
  if (!well || !bad || !imp) { alert('Complete all review prompts.'); return; }
  const wk = weekId(), wd = weekData(wk); wd.weeks[wk].review = { well, bad, imp, push, ts: new Date().toISOString() }; save(wd);
  document.getElementById('weekly-review-result').style.display = 'block'; document.getElementById('weekly-review-result').innerHTML = '<p style="color:var(--green);font-weight:600">✅ Weekly review submitted!</p>'; addLog('action', 'Weekly review: ' + wk);
}

// ============ STRETCH GOALS SYSTEM ============
const STRETCH_GOAL_EVALUATOR_PROMPT = `You are evaluating three weekly stretch goals for someone who wants to build a year of memorable experiences. Your role is to push back on comfort-zone goals and prioritize experiences that create lasting positive memories.

CONTEXT: The user already has a rigorous daily tracking system covering:
- Italian language learning (flashcards, reading, composition)
- Academic/dissertation work
- Gym and nutrition tracking  
- Article reading with reflections
- Productivity systems

These are ALREADY optimized. Stretch goals must push AWAY from these quantified patterns.

AUTOMATIC REJECTION:
❌ More language learning tasks (already doing 300 cards/day + daily language practice + composition)
❌ More academic/dissertation work (already tracked weekly)
❌ More gym sessions (already tracked)
❌ Short-form reading for language learning (already doing 2 articles/day with reflections)
❌ Productivity meta-work (tracking systems, optimization)
❌ Generic social ("get dinner with X")
❌ More than ONE Italian media consumption goal

IMPORTANT DISTINCTION - Reading Types:
- ❌ REJECT: Short Italian articles for vocabulary building (user already does this daily)
- ✅ APPROVE: Italian narrative books/novels read for enjoyment and sustained engagement (this is the ONE Italian media exception)

EVALUATION CRITERIA (in priority order):
1. **Untrackable Over Measurable**: Would this feel stupid to put in a spreadsheet?
2. **Experiential Over Achievement**: Memory-making > accomplishment
3. **In-Person Over Digital**: Real world > screen
4. **Novel Over Optimized**: First time doing X > getting better at X
5. **Social Beyond Default**: Meaningful connection > routine hangout
6. **Physical World**: Leaving your usual environments

AUTOMATIC APPROVAL (1 per week max):
✅ ONE Italian media goal: watching an Italian film OR reading an Italian book (novels, fiction, etc.)
   - This includes chapter-based goals (e.g., "read 3 chapters of Il cimitero di Praga")
   - This is an EXCEPTION to the reading rule because it supports sustained engagement with narrative media
   - NOT study materials, textbooks, or language learning articles

SCORING SYSTEM:
For each goal:
- **VERDICT**: APPROVED / CONDITIONAL / REJECTED  
- **Memory Score**: 1-10 (smile-worthy in December?)
- **Anti-Optimization Score**: 1-10 (how resistant to tracking/metrics?)
- **Specific Feedback**: Why it works/fails
- **Improvement**: If rejected, propose stronger alternative

GOALS TO EVALUATE:
[Goal 1]: {goal1}
[Goal 2]: {goal2}
[Goal 3]: {goal3}

PREVIOUS WEEKS' GOALS (check for repetition):
{history}

FINAL RECOMMENDATION:
- Count of Italian media goals (flag if >1)
- Overall "unquantifiable experience" potential  
- Warning if goals drift into already-tracked domains
- Flag any repetitive patterns from previous weeks

Be ruthlessly honest. These goals should make you feel slightly uncomfortable because they're NOT your normal optimization patterns. The bar is: "Would this make a good story at a dinner party, or would it sound like homework?"

Return your response in this exact format:
GOAL 1: [APPROVED/CONDITIONAL/REJECTED]
Memory Score: X/10
Anti-Optimization Score: X/10
Feedback: ...

GOAL 2: ...

GOAL 3: ...

FINAL: [APPROVED/NEEDS_REVISION]
Summary: ...`;

const ITALIAN_MEDIA_KEYWORDS = ['watch', 'film', 'movie', 'read', 'libro', 'legger', 'cinema', 'vedere'];

let _sgPendingImage = null;
let _sgCompletingGoalId = null;

function renderStretchGoals() {
  // Don't nuke an active completion form during background sync/re-render
  if (_sgCompletingGoalId) return;
  const wk = weekId();
  const sg = getStretchGoals(wk);
  const container = document.getElementById('stretch-goals-container');
  if (!container) return;
  
  if (!sg || !sg.submitted) {
    // Show compact submission form
    container.innerHTML = `
      <div style="padding:10px 0;border-bottom:1px dashed var(--border);margin-bottom:12px">
        <h4 style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:8px">💫 Memory <span style="color:var(--muted);font-weight:400;font-size:12px">(Required to unlock site)</span></h4>
        <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Set three memory-making experiences for this week.</p>
        <div style="margin-bottom:8px">
          <input type="text" id="sg-goal-1" placeholder="Goal 1: Try a pottery class..." maxlength="200" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;margin-bottom:4px">
          <input type="text" id="sg-goal-2" placeholder="Goal 2: Attend a local theater show..." maxlength="200" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px;margin-bottom:4px">
          <input type="text" id="sg-goal-3" placeholder="Goal 3: Watch Cinema Paradiso..." maxlength="200" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:13px">
        </div>
        <button id="sg-submit-btn" class="btn btn-s" onclick="submitStretchGoals()" style="font-size:12px">Submit for AI Approval</button>
        <div id="sg-eval-result" style="margin-top:10px"></div>
      </div>
    `;
  } else {
    // Show approved goals as chips
    const chipsHtml = sg.goals.map(g => {
      const typeIcon = g.type === 'italian-media' ? '📚' : '🎯';
      const completedClass = g.completed ? ' memory-chip-done' : ' memory-chip-active';
      const checkmark = g.completed ? ' ✓' : '';
      const clickHandler = g.completed ? '' : ` onclick="openCompleteGoalModal('${g.id}', '${g.type}')"`;
      const tooltip = `💭 ${g.memoryScore}/10 memory · 🎨 ${g.comfortZoneScore}/10 comfort`;
      const cursorStyle = g.completed ? 'cursor:default' : 'cursor:pointer';
      
      return `<span class="goal-chip${completedClass}" ${clickHandler} title="${tooltip}" style="${cursorStyle}">${typeIcon} ${escHtml(g.text)}${checkmark}</span>`;
    }).join(' ');
    
    container.innerHTML = `
      <div style="padding:10px 0;border-bottom:1px dashed var(--border);margin-bottom:12px">
        <h4 style="font-size:13px;font-weight:600;margin-bottom:8px">💫 Memory</h4>
        <div class="chip-container">${chipsHtml}</div>
      </div>
    `;
  }
}

async function submitStretchGoals() {
  const goal1 = document.getElementById('sg-goal-1').value.trim();
  const goal2 = document.getElementById('sg-goal-2').value.trim();
  const goal3 = document.getElementById('sg-goal-3').value.trim();
  
  if (!goal1 || !goal2 || !goal3) {
    alert('All three goals are required.');
    return;
  }
  
  const key = localStorage.getItem('cc_apikey');
  if (!key) {
    alert('Set your Anthropic API key in the Claude tab first.');
    switchTab('claude');
    return;
  }
  
  const btn = document.getElementById('sg-submit-btn');
  const result = document.getElementById('sg-eval-result');
  btn.textContent = '⏳ Evaluating with Claude...';
  btn.disabled = true;
  
  try {
    // Get history for repetition check
    const history = getStretchGoalHistory().map(h => 
      `Week ${h.week}: ${h.goals.map(g => `"${g.text}" (${g.type}, ${g.completed ? 'completed' : 'incomplete'})`).join(', ')}`
    ).join('\n');
    
    const prompt = STRETCH_GOAL_EVALUATOR_PROMPT
      .replace('{goal1}', goal1)
      .replace('{goal2}', goal2)
      .replace('{goal3}', goal3)
      .replace('{history}', history || 'No previous stretch goals.');
    
    const response = await callClaude(key, prompt);
    result.style.display = 'block';
    result.innerHTML = `<div style="background:var(--bg);padding:12px;border-radius:6px;font-size:13px;white-space:pre-wrap;border:1px solid var(--border);max-height:400px;overflow-y:auto">${escHtml(response)}</div>`;
    
    // Parse response for approval
    const finalMatch = response.match(/FINAL:\s*(APPROVED|NEEDS_REVISION)/i);
    if (finalMatch && finalMatch[1].toUpperCase() === 'APPROVED') {
      // Extract scores and save goals
      const goals = [goal1, goal2, goal3].map((text, idx) => {
        const goalNum = idx + 1;
        const verdictMatch = response.match(new RegExp(`GOAL ${goalNum}:\\s*(APPROVED|CONDITIONAL|REJECTED)`, 'i'));
        const memoryMatch = response.match(new RegExp(`Memory Score:\\s*(\\d+)/10`, 'i'));
        const antiOptMatch = response.match(new RegExp(`Anti-Optimization Score:\\s*(\\d+)/10`, 'i'));
        
        const type = _detectGoalType(text);
        
        return {
          id: 'sg_' + Date.now() + '_' + idx,
          text: text,
          type: type,
          approved: verdictMatch ? verdictMatch[1].toUpperCase() === 'APPROVED' : true,
          approvalResponse: response,
          memoryScore: memoryMatch ? parseInt(memoryMatch[1]) : 7,
          comfortZoneScore: antiOptMatch ? parseInt(antiOptMatch[1]) : 7,
          completed: false,
          completionDate: null,
          completionEvidence: null
        };
      });
      
      // Save to weekData
      const wk = weekId();
      const wd = weekData(wk);
      wd.weeks[wk].stretchGoals = {
        goals: goals,
        submitted: true,
        submittedDate: new Date().toISOString()
      };
      save(wd);
      
      result.innerHTML += '<p style="color:var(--green);font-weight:600;margin-top:12px">✅ Goals approved! Site unlocked.</p>';
      addLog('action', 'Stretch goals submitted for ' + wk);
      
      // Re-enable button so it stays available
      btn.textContent = 'Submit for AI Approval';
      btn.disabled = false;
      
      setTimeout(() => {
        renderStretchGoals();
        if (typeof checkSiteLock === 'function') checkSiteLock();
      }, 2000);
    } else {
      // Goals need revision - keep feedback visible and form editable
      result.innerHTML += '<p style="color:var(--orange);font-weight:600;margin-top:12px">⚠️ Goals need revision. Adjust the goals above based on Claude\'s feedback, then resubmit.</p>';
      // Re-enable button immediately for resubmission
      btn.textContent = 'Resubmit for AI Approval';
      btn.disabled = false;
    }
  } catch (e) {
    result.style.display = 'block';
    result.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>';
    btn.textContent = 'Submit for AI Approval';
    btn.disabled = false;
  }
}

function _detectGoalType(text) {
  const lower = text.toLowerCase();
  for (const keyword of ITALIAN_MEDIA_KEYWORDS) {
    if (lower.includes(keyword)) return 'italian-media';
  }
  return 'experiential';
}

let _sgPendingImages = [];

function openCompleteGoalModal(goalId, type) {
  _sgCompletingGoalId = goalId;
  _sgPendingImages = [];
  
  // Find chip and insert form below it
  const container = document.getElementById('stretch-goals-container');
  if (!container) return;
  
  // Remove any existing completion form
  const existing = document.getElementById('sg-complete-form');
  if (existing) existing.remove();
  
  const form = document.createElement('div');
  form.id = 'sg-complete-form';
  form.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-top:8px';
  
  if (type === 'experiential') {
    form.innerHTML = `
      <h4 style="font-size:13px;font-weight:600;margin-bottom:8px">Complete Goal - Upload Evidence</h4>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Upload photos: tickets, programs, venue photos, etc.</p>
      <input type="file" id="sg-photo-input" accept="image/*" multiple onchange="sgPhotosSelected(this)" style="margin-bottom:8px;font-size:12px">
      <div id="sg-photo-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>
      <div style="margin-bottom:10px">
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--muted)">Reflection (optional):</label>
        <textarea id="sg-reflection" rows="4" placeholder="Any thoughts about this experience..." style="width:100%;font-size:13px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;resize:vertical"></textarea>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-s" onclick="submitExperientialCompletion()">Submit for Validation</button>
        <button class="btn btn-s" onclick="cancelSGCompletion()">Cancel</button>
      </div>
      <div id="sg-complete-result" style="margin-top:10px"></div>
    `;
  } else {
    form.innerHTML = `
      <h4 style="font-size:13px;font-weight:600;margin-bottom:8px">Complete Goal - Write Reflection</h4>
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Write a 400+ word composition about the film/book</p>
      <textarea id="sg-composition" rows="10" style="width:100%;font-size:13px;padding:8px;border:1px solid var(--border);border-radius:4px;font-family:inherit;resize:vertical"></textarea>
      <div id="sg-word-count" style="font-size:12px;color:var(--muted);margin:4px 0">0 / 400 words</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-s" onclick="submitMediaCompletion()">Submit for Validation</button>
        <button class="btn btn-s" onclick="cancelSGCompletion()">Cancel</button>
      </div>
      <div id="sg-complete-result" style="margin-top:10px"></div>
    `;
    
    // Word counter
    setTimeout(() => {
      const textarea = document.getElementById('sg-composition');
      if (textarea) {
        textarea.addEventListener('input', function() {
          const words = this.value.trim().split(/\s+/).filter(w => w).length;
          const counter = document.getElementById('sg-word-count');
          if (counter) {
            counter.textContent = words + ' / 400 words';
            counter.style.color = words >= 400 ? 'var(--green)' : 'var(--muted)';
          }
        });
      }
    }, 100);
  }
  
  // Insert form after the chip container
  const chipContainer = container.querySelector('.chip-container');
  if (chipContainer) {
    chipContainer.after(form);
  } else {
    container.appendChild(form);
  }
}

function _resizeImage(dataUrl, maxDim, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = function() {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

let _sgProofIndexes = new Set([0]); // first photo is proof by default

function _renderSGPhotoPreview() {
  const preview = document.getElementById('sg-photo-preview');
  if (!preview) return;
  const proofCount = Array.from(_sgProofIndexes).filter(i => i < _sgPendingImages.length).length;
  preview.innerHTML = _sgPendingImages.map((img, i) => {
    const isProof = _sgProofIndexes.has(i);
    const border = isProof ? '3px solid var(--blue)' : '1px solid var(--border)';
    const badge = isProof ? '<span style="position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);background:var(--blue);color:#fff;font-size:9px;padding:1px 5px;border-radius:8px;white-space:nowrap">📎 Proof</span>' : '';
    return `
      <div style="position:relative;display:inline-block;margin-bottom:14px" onclick="toggleSGProof(${i})">
        <img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:${border};cursor:pointer" title="${isProof ? 'Proof photo (sent to AI)' : 'Vibes photo (saved only)'}">
        <button onclick="event.stopPropagation();removeSGPhoto(${i})" style="position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;line-height:1;cursor:pointer">×</button>
        ${badge}
      </div>
    `;
  }).join('') + `<p style="font-size:11px;color:var(--muted);margin-top:4px">${_sgPendingImages.length} photo(s) · ${proofCount} marked as proof (tap to toggle)</p>`;
}

function toggleSGProof(idx) {
  if (_sgProofIndexes.has(idx)) _sgProofIndexes.delete(idx);
  else _sgProofIndexes.add(idx);
  _renderSGPhotoPreview();
}

function sgPhotosSelected(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const preview = document.getElementById('sg-photo-preview');
  _sgPendingImages = [];
  _sgProofIndexes = new Set([0]); // auto-mark first as proof
  preview.innerHTML = '<p style="font-size:11px;color:var(--muted)">⏳ Compressing...</p>';

  let processed = 0;
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = async function(e) {
      const compressed = await _resizeImage(e.target.result, 1024, 0.7);
      _sgPendingImages.push(compressed);
      processed++;
      if (processed === files.length) _renderSGPhotoPreview();
    };
    reader.readAsDataURL(file);
  });
}

function removeSGPhoto(idx) {
  _sgPendingImages.splice(idx, 1);
  // Rebuild proof indexes: remove this index, shift higher ones down
  const newProof = new Set();
  _sgProofIndexes.forEach(i => { if (i < idx) newProof.add(i); else if (i > idx) newProof.add(i - 1); });
  _sgProofIndexes = newProof;
  _renderSGPhotoPreview();
}

function cancelSGCompletion() {
  const form = document.getElementById('sg-complete-form');
  if (form) form.remove();
  _sgCompletingGoalId = null;
  _sgPendingImages = [];
}

async function submitExperientialCompletion() {
  if (!_sgPendingImages.length) {
    alert('Please upload at least one photo.');
    return;
  }
  
  // Require at least one proof photo
  const proofImages = _sgPendingImages.filter((_, i) => _sgProofIndexes.has(i));
  if (!proofImages.length) {
    alert('Mark at least one photo as proof (tap a photo to toggle).');
    return;
  }
  
  const key = localStorage.getItem('cc_apikey');
  if (!key) {
    alert('Set your API key in the Claude tab first.');
    return;
  }
  
  const reflection = document.getElementById('sg-reflection')?.value.trim() || '';
  const result = document.getElementById('sg-complete-result');
  result.innerHTML = '<p style="font-size:13px">⏳ Validating ' + proofImages.length + ' proof photo(s) with Claude...</p>';
  
  try {
    // Only send proof-marked photos to the API
    const content = [];
    proofImages.forEach(imgData => {
      const base64 = imgData.split(',')[1];
      const mediaType = imgData.split(';')[0].split(':')[1] || 'image/jpeg';
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 }
      });
    });
    
    const promptText = `Analyze these ${proofImages.length} image(s) as evidence of completing an experiential stretch goal. Look for: tickets, programs, photos showing the person at an event/location, or other proof of participation in a memorable experience. If these appear to be genuine evidence of an experience (not just screenshots or random photos), respond with "APPROVED: [brief description of what you see]". If they do not appear to be valid evidence, respond with "REJECTED: [reason]". Be reasonable - tickets, wristbands, photos at venues, program booklets, etc. all count as valid evidence.`;
    
    content.push({ type: 'text', text: promptText });
    
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: content }]
      })
    });
    
    if (!resp.ok) throw new Error('API error: ' + resp.status);
    const data = await resp.json();
    const validation = data.content[0].text;
    
    if (validation.toUpperCase().includes('APPROVED')) {
      // Mark goal complete — save ALL photos (proof + vibes)
      const wk = weekId();
      const wd = weekData(wk);
      const goal = wd.weeks[wk].stretchGoals.goals.find(g => g.id === _sgCompletingGoalId);
      if (goal) {
        goal.completed = true;
        goal.completionDate = new Date().toISOString();
        goal.completionEvidence = {
          images: _sgPendingImages,
          proofIndexes: Array.from(_sgProofIndexes),
          reflection: reflection,
          validationResponse: validation
        };
        save(wd);
        
        result.innerHTML = '<p style="color:var(--green);font-weight:600">✅ Goal completed! ' + escHtml(validation) + '</p>';
        addLog('milestone', 'Stretch goal completed: ' + goal.text);
        
        setTimeout(() => {
          cancelSGCompletion();
          celebrateGoalCompletion();
          renderStretchGoals();
        }, 2000);
      }
    } else {
      result.innerHTML = '<p style="color:var(--red)">❌ ' + escHtml(validation) + '</p>';
    }
  } catch (e) {
    result.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>';
  }
}

async function submitMediaCompletion() {
  const text = document.getElementById('sg-composition').value.trim();
  const words = text.split(/\s+/).filter(w => w).length;
  
  if (words < 400) {
    alert('Minimum 400 words required. Currently: ' + words);
    return;
  }
  
  const key = localStorage.getItem('cc_apikey');
  if (!key) {
    alert('Set your API key in the Claude tab first.');
    return;
  }
  
  const result = document.getElementById('sg-complete-result');
  result.innerHTML = '<p style="font-size:13px">⏳ Validating with Claude...</p>';
  
  try {
    const prompt = `Analyze this composition about Italian media (film or book). Determine if this is a genuine reflection showing the person actually engaged with and thought about the work, or if it's superficial/copied. Respond with "APPROVED: [brief feedback]" if genuine, or "REJECTED: [reason]" if not.

Composition:
${text}`;
    
    const validation = await callClaude(key, prompt);
    
    if (validation.toUpperCase().includes('APPROVED')) {
      // Mark goal complete
      const wk = weekId();
      const wd = weekData(wk);
      const goal = wd.weeks[wk].stretchGoals.goals.find(g => g.id === _sgCompletingGoalId);
      if (goal) {
        goal.completed = true;
        goal.completionDate = new Date().toISOString();
        goal.completionEvidence = {
          composition: text,
          validationResponse: validation
        };
        save(wd);
        
        result.innerHTML = '<p style="color:var(--green);font-weight:600">✅ Goal completed! ' + escHtml(validation) + '</p>';
        addLog('milestone', 'Stretch goal completed: ' + goal.text);
        
        setTimeout(() => {
          cancelSGCompletion();
          celebrateGoalCompletion();
          renderStretchGoals();
        }, 2000);
      }
    } else {
      result.innerHTML = '<p style="color:var(--red)">❌ ' + escHtml(validation) + '</p>';
    }
  } catch (e) {
    result.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>';
  }
}

function celebrateGoalCompletion() {
  // Confetti celebration
  if (typeof confetti !== 'undefined') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
  
  // Encouraging message
  const messages = [
    '🎉 Another memory in the books!',
    '✨ You\'re building a life worth remembering!',
    '🌟 That\'s one for the highlight reel!',
    '🎊 Living, not optimizing!',
    '💫 December-you will thank you for this!'
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  // Show temporary overlay message
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--green);color:#fff;padding:24px 48px;border-radius:12px;font-size:24px;font-weight:600;z-index:10000;box-shadow:0 8px 24px rgba(0,0,0,0.3);animation:sgFadeOut 3s forwards';
  overlay.textContent = msg;
  document.body.appendChild(overlay);
  
  setTimeout(() => overlay.remove(), 3000);
}


