# Command Center Cleanup — Continuation Prompt

> **How to use**: Paste "Read continuation.md and follow the instructions" into a fresh Cline task.

## Project Context
- This is a PWA ("Command Center") at `cline_5_to_9/`
- All JS is global functions loaded via `<script>` tags (no ES modules)
- `core.js` is the data layer (load, save, today, weekId, dayData, weekData, getGlobal, addLog, escHtml)
- `app.js` WAS a 2,643-line monolith. We are splitting it into proper module files.

## What We're Doing
1. Delete Habits, Inbox, Focus tabs (HTML + JS + nav + all references)
2. Complete the modularization: extract remaining functions from app.js into their module files, removing duplicates
3. Wire up all script tags in index.html in correct load order
4. Audit cross-references to deleted features
5. Trim dissertation.js (remove overall progress, chapter outline, deep work timer)
6. Final audit + browser test

## What STAYS
- Today (today.js + calendar.js)
- Week (week.js)
- Dissertation (dissertation.js) — minus overall progress, chapter outline, deep work timer
- Cards (anki.js)
- Read/Translate (translate.js)
- Claude (chat.js)
- Log (stays in slimmed app.js)
- Article of the Day (aotd.js)
- Flashcard Review (flashcard-review.js)
- Firebase Sync (firebase-sync.js)
- Core data layer (core.js)

## What GOES
- Habits (habits.js) — DELETED
- Inbox (inbox.js) — DELETED
- Focus (focus.js) — DELETED

## Current Status
- **Phase 0**: ✅ Created this file
- **Phase 1**: ⬜ Not started — Delete Habits/Inbox/Focus tabs
- **Phase 2**: ⬜ Not started — Extract functions from app.js into modules
- **Phase 3**: ⬜ Not started — Wire up script tags in index.html + sw.js
- **Phase 4**: ⬜ Not started — Audit cross-references to deleted features
- **Phase 5**: ⬜ Not started — Trim dissertation.js
- **Phase 6**: ⬜ Not started — Final audit + browser test

## Key Rules (for the AI continuing this work)
1. NEVER read all of app.js — use `grep -n` and `sed -n 'START,ENDp'` for targeted reads
2. NEVER read all of index.html — use grep to find section boundaries first
3. One module at a time during extraction
4. Git commit after every successful phase
5. If above 80% context: stop, update this file, commit, and generate a fresh-task handoff

## Script Load Order (target state)
```html
<script src="core.js"></script>
<script src="calendar.js"></script>
<script src="today.js"></script>
<script src="flashcard-review.js"></script>
<script src="week.js"></script>
<script src="dissertation.js"></script>
<script src="chat.js"></script>
<script src="anki.js"></script>
<script src="translate.js"></script>
<script src="aotd.js"></script>
<script src="app.js"></script>
<script src="firebase-sync.js"></script>
```

## Next Step
Start Phase 1: Delete Habits/Inbox/Focus. Specifically:
1. `grep -n 'tab-habits\|tab-inbox\|tab-focus' index.html` to find HTML section boundaries
2. Remove those tab `<div>` sections from index.html
3. Remove the nav buttons for those 3 tabs
4. Delete `habits.js`, `inbox.js`, `focus.js` files
5. In app.js, remove `renderHabits()`, `renderInbox()`, `renderFocus()` functions and their references in `loadAll()` and nav switching
6. Also remove `renderIFT()` (if-then habits), `renderCWG()` (current week goals tied to habits)
7. Git commit