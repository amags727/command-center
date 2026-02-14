# Continuation: Weekly Goals Implementation (Part 2)

## What Was Done
1. **index.html** — COMMITTED. Replaced "Weekly Notes" section on the Week tab with:
   - "Weekly Goals" header with 3 sub-tab buttons (Work/School/Life) using `switchWeekGoalTab()`
   - Each panel has a contenteditable div (`#wg-work`, `#wg-school`, `#wg-life`) with `oninput="saveWeekGoals('work')"` etc.
   - Day-highlight buttons (MON–SUN) calling `weekGoalAssignDay(cat, day)` and a Clear button calling `weekGoalClearHighlights(cat)`
   - Daily Summaries moved to its own separate `<div class="card">` below
   - CSS added: `.wg-tab-btn.active`, `.wg-panel [data-day]`, per-panel `[data-day]` highlight styles

## What Remains

### 2. week.js — Add these functions (currently ~53 lines)

Replace `saveWeekNotes()` and `loadWeekNotes()` with the new weekly goals system. Here's the full implementation to add:

```javascript
// ── Weekly Goals (Work / School / Life) ─────────────────────────
const DAY_COLORS = {mon:'#FFB3B3',tue:'#FFD9B3',wed:'#FFFFB3',thu:'#B3FFB3',fri:'#B3D9FF',sat:'#D9B3FF',sun:'#FFB3E6'};

function switchWeekGoalTab(cat) {
  ['work','school','life'].forEach(c => {
    const p = document.getElementById('wg-panel-'+c);
    const b = document.getElementById('wg-tab-btn-'+c);
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
  // If school tab, also sync to dissertation
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
  // Check selection is inside the correct editor
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
  // If text is selected, only remove highlights touching the selection
  if (sel.rangeCount && !sel.isCollapsed && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const range = sel.getRangeAt(0);
    const spans = el.querySelectorAll('[data-day]');
    spans.forEach(sp => {
      if (range.intersectsNode(sp)) {
        const parent = sp.parentNode;
        while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
        parent.removeChild(sp);
      }
    });
    sel.removeAllRanges();
  } else {
    // No selection — clear all
    const spans = el.querySelectorAll('[data-day]');
    spans.forEach(sp => {
      const parent = sp.parentNode;
      while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
      parent.removeChild(sp);
    });
  }
  saveWeekGoals(cat);
}

// Populate School tab from Dissertation weekly goals (called by dissertation.js)
function populateSchoolWeeklyGoals() {
  const d = getGlobal();
  const html = d.dissWeeklyGoals && d.dissWeeklyGoals[weekId()] || '';
  const el = document.getElementById('wg-school');
  if (el) el.innerHTML = html;
  // Also save into weekGoals
  if (!d.weekGoals) d.weekGoals = {};
  if (!d.weekGoals[weekId()]) d.weekGoals[weekId()] = {};
  d.weekGoals[weekId()].school = html;
  save(d);
}

// Populate Dissertation weekly goals from School tab (called by week.js saveWeekGoals('school'))
function populateDissWeeklyGoals() {
  const d = getGlobal();
  const html = d.weekGoals && d.weekGoals[weekId()] && d.weekGoals[weekId()].school || '';
  const el = document.getElementById('diss-weekly-goals');
  if (el) el.innerHTML = html;
  if (!d.dissWeeklyGoals) d.dissWeeklyGoals = {};
  d.dissWeeklyGoals[weekId()] = html;
  save(d);
}
```

Also, in the existing `renderWeek()` function, replace the call to `loadWeekNotes()` with `loadWeekGoals()`.

Remove `saveWeekNotes()` and `loadWeekNotes()` functions if they exist.

### 3. today.js — Add auto-populate from weekly goals

In the `renderToday()` function (or wherever daily goals chips are populated), add logic to auto-populate daily goal chips from weekly goals. The approach:

```javascript
function getWeeklyGoalsForToday() {
  const d = getGlobal();
  const wk = d.weekGoals && d.weekGoals[weekId()] || {};
  const dayMap = {1:'mon',2:'tue',3:'wed',4:'thu',5:'fri',6:'sat',0:'sun'};
  const todayDay = dayMap[new Date().getDay()];
  const results = {work:[], school:[], life:[]};
  
  ['work','school','life'].forEach(cat => {
    const html = wk[cat] || '';
    if (!html) return;
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('[data-day="'+todayDay+'"]').forEach(span => {
      const text = span.textContent.trim();
      if (text) results[cat].push(text);
    });
  });
  return results;
}
```

Then in `_t3Render()` or `_t3LoadDay()`, check if there are no chips yet for today and auto-populate from weekly goals. Each auto-populated chip should get a `linked:true` property and show the `.linked` CSS class (blue left border).

### 4. dissertation.js — Bidirectional sync

The `saveDissWeeklyGoals()` already calls `populateSchoolWeeklyGoals()` (line 314). That function is defined in week.js above, so it will work once week.js is updated.

The reverse direction: `saveWeekGoals('school')` calls `populateDissWeeklyGoals()` which is also defined in week.js. That function updates `#diss-weekly-goals` innerHTML and saves to `dissWeeklyGoals`.

**No changes needed to dissertation.js** — it already has the hook. The new `populateSchoolWeeklyGoals()` and `populateDissWeeklyGoals()` functions just need to exist in week.js.

### 5. MODULARIZATION.md updates

Add to week.js entry:
- `switchWeekGoalTab`, `saveWeekGoals`, `loadWeekGoals`, `weekGoalAssignDay`, `weekGoalClearHighlights`, `populateSchoolWeeklyGoals`, `populateDissWeeklyGoals`

Remove from week.js entry:
- `saveWeekNotes`, `loadWeekNotes`

Add to today.js entry:
- `getWeeklyGoalsForToday`

## Implementation Order
1. Read week.js → apply the changes above (add new functions, replace loadWeekNotes call in renderWeek, remove old notes functions)
2. Read today.js → add `getWeeklyGoalsForToday()` and integrate into `_t3LoadDay()` 
3. Update MODULARIZATION.md
4. Git commit each file after successful change
5. Test via browser