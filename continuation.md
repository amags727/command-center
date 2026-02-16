# Continuation: Weekly Transition System

## What Was Done
1. **Log tab updated in `index.html`**: Added "Weekly Archives" section with `manualArchiveWeek()` button and `#week-archives` container div. Also added the `📋 Log` nav button.

## What Remains

### Task 1: Week Archive System (new module: `week-archive.js`)
Create `week-archive.js` (~300 lines estimated) that handles:

#### A. Snapshot/Freeze a Week
- `archiveWeek(weekKey)` — takes a weekId like `2026-W07` and:
  - Reads `weekData(wk)` for targets (gym, anki, articles, convo, refl, diss hours, social)
  - Reads `weekGoals[wk]` for work/school/life rich-text goals
  - Reads `dissWeeklyGoals[wk]` for dissertation weekly goals
  - Reads `weeks[wk].goals` for custom weekly goals
  - Reads `weeks[wk].review` for weekly review answers
  - Reads daily summaries for each day of the week
  - Stores all this as `d.weekArchives[wk] = { ...snapshot, archivedAt: ISO timestamp }`
  - Calls `save(d)`

#### B. Email Summary
- `emailWeekSummary(weekKey)` — generates HTML email and opens `mailto:` link or uses a simple email API
  - **Recommended approach**: Generate the HTML summary, then open `mailto:xmagnuson@gmail.com?subject=...&body=...` (but mailto has body length limits)
  - **Better approach**: Use the existing Claude/Anthropic API key to format, then use a mailto with plain text, OR use EmailJS (free tier) or similar
  - **Simplest approach**: Generate a nicely formatted plain-text summary and open mailto link. Gmail handles plain text well.
  - Content: week targets vs actuals, weekly goals, review answers, daily summaries

#### C. Log Page Rendering
- `renderWeekArchives()` — renders into `#week-archives` div
  - Collapsible hierarchy: Year → Month → Week
  - Each year is a collapsible section (default collapsed)
  - Each month within a year is collapsible (default collapsed)
  - Each week shows the frozen snapshot when expanded
  - Parse weekId `2026-W07` to determine year and month (use the Monday of that week)
- `manualArchiveWeek()` — called from the button, archives current week + triggers email

#### D. Auto-archive on Week Transition
- In `app.js` or `week-archive.js`, on app init, check if the current weekId differs from `d.lastActiveWeek`
  - If so, auto-archive the previous week (if not already archived)
  - Update `d.lastActiveWeek = weekId()`
  - This handles the "freeze in place" requirement

### Task 2: Arrow Navigation for Weekly Goals (next-week planning)

#### In `week.js`:
- The weekly goals header currently shows `📊 Week of <span id="wk-date"></span>`
- Add left/right arrow buttons: `◀ ▶` next to the week date
- Track a `_weekGoalOffset` variable (0 = current week, 1 = next week, -1 would show previous but we only need +1)
- `saveWeekGoals(cat)` currently keys on `weekId()` — needs to key on `weekId() + offset`
- `loadWeekGoals()` needs the same offset awareness
- Helper: `offsetWeekId(weekId, offset)` — returns the weekId N weeks ahead/behind
  - Parse `2026-W07`, add offset to week number, handle year boundaries

#### In `dissertation.js`:
- Same pattern: `dissWeeklyGoals` already keys on `weekId()`
- Add arrows to the dissertation weekly goals header
- `saveDissWeeklyGoals()` and the load in `renderDiss()` need offset awareness
- Since diss weekly goals sync to week.js school goals, the offset logic must be consistent

#### Implementation Notes:
- `weekId()` in `core.js` returns current week. We need an `offsetWeekId(base, n)` utility.
- The simplest implementation of `offsetWeekId`: parse the ISO week, create a Date for Monday of that week, add `n*7` days, then recalculate weekId from that date.
- Both tabs should show a visual indicator when viewing next week (e.g., "(Next Week)" label, different background)
- Only allow offset 0 (current) and +1 (next week). Don't allow browsing arbitrarily far ahead.

### Task 3: Wire Everything Together
- Add `week-archive.js` to `index.html` script tags (before `app.js`)
- Add to `sw.js` ASSETS array
- Update `MODULARIZATION.md`
- In `app.js` init, call the auto-archive check
- Test the full flow

## Key Data Structures (from what I learned)

### In `core.js`:
- `weekId()` returns e.g. `"2026-W07"`
- `weekData(wk)` returns `d.weeks[wk]` ensuring it exists with `{goals:[], days:{}}`
- `dayData()` returns today's data
- `load()` / `save()` for localStorage

### Weekly goals storage:
- `d.weekGoals[weekId()] = { work: html, school: html, life: html }`
- `d.dissWeeklyGoals[weekId()] = html` (this syncs to/from weekGoals.school)
- `d.weeks[weekId()].goals` = array of custom goals `{text, cat, done}`
- `d.weeks[weekId()].review` = `{well, bad, imp, push, ts}`

### Week tab rendering:
- `renderWeek()` in week.js line 2 — sets wk-date, computes targets
- `loadWeekGoals()` in week.js line 72 — loads rich-text into wg-work/school/life editors
- `saveWeekGoals(cat)` in week.js line 61 — saves from editors to data

### Dissertation weekly goals:
- Rendered in `renderDiss()` in dissertation.js around line 362
- `saveDissWeeklyGoals()` saves to `d.dissWeeklyGoals[weekId()]`

## Files to Create/Modify
| File | Action |
|------|--------|
| `week-archive.js` | CREATE — archive, email, log rendering |
| `week.js` | MODIFY — add arrow nav for goals offset |
| `dissertation.js` | MODIFY — add arrow nav for diss goals offset |
| `core.js` | MODIFY — add `offsetWeekId()` utility |
| `index.html` | MODIFY — add arrow buttons to week/diss headers (already has archive section) |
| `app.js` | MODIFY — call auto-archive check on init, add week-archive to render pipeline |
| `sw.js` | MODIFY — add week-archive.js to ASSETS |
| `MODULARIZATION.md` | MODIFY — document new module |