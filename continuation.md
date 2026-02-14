# Continuation Prompt for Codebase Cleanup

## What Was Done (commit 53179ba)
1. Deleted `habits.js`, `inbox.js`, `focus.js` module files
2. Cleaned `app.js` tab switching:
   - Removed habits/inbox/focus from the `names` array in `switchTab()`
   - Removed `renderHabits()`, `renderInbox()`, `renderFocus()` calls from `switchTab()` and `loadAll()`

## What Still Needs To Be Done

### Phase 1 (continued): Remove HTML + nav + dead JS

**index.html** — use `grep -n` to find these sections, then remove them:
- Nav buttons for Habits, Inbox, Focus (search for `switchTab('habits')`, `switchTab('inbox')`, `switchTab('focus')`)
- The entire `<div id="tab-habits" class="tab">` section
- The entire `<div id="tab-inbox" class="tab">` section  
- The entire `<div id="tab-focus" class="tab">` section
- Remove `<script src="habits.js">`, `<script src="inbox.js">`, `<script src="focus.js">` tags

**app.js** — dead function bodies to remove (use `grep -n` to find line numbers, then `sed -n` to read just those functions):
- `renderHabits()` function and related: `addIFT()`, `renderIFT()`, `rmIFT()`
- `renderInbox()` function and related: `inboxItem()`, `addInbox()`, `moveInbox()`, `rmInbox()`
- `renderFocus()` function and related: `setFocus()`, `focusTimer()`, `updFocusDisplay()`, `addDist()`, `logEnergy()`
- Focus timer variables: `focusInt`, `focusSec`, `focusTotal`, `focusRunning`

**sw.js** — remove habits.js, inbox.js, focus.js from the service worker cache list

### Phase 2: Audit cross-references
- Search app.js for any remaining references to habits/inbox/focus functions
- Check `getGlobal()` — it initializes `d.inbox` and `d.ifthens` arrays; these can stay (data layer, harmless) or be removed
- Check `buildContext()` in Claude tab — references inbox items count
- Check `dayData()` — has habits object, this is used by Today tab too so KEEP it

### Phase 3: Trim dissertation.js
Per user request, remove from dissertation tab:
- Overall progress section
- Chapter outline section  
- Deep work timer section
Use `grep -n` on dissertation.js to find these, then `sed -n` to read targeted sections before removing.

### Phase 4: Final audit + test
- Run the site in browser to verify Today, Dissertation (minus removed features), Cards, Read/Translate, and Claude tabs all work
- Git commit and push

## Critical Rules (from .clinerules)
- NEVER read all of app.js (2600+ lines) — use grep/sed for targeted reads
- NEVER read all of index.html at once — use grep to find section boundaries
- If above 80% context: stop, commit, write continuation prompt
- One module at a time
- Always commit working states

## Architecture Notes
- Data layer functions (load, save, today, weekId, dayData, weekData, getGlobal, addLog, escHtml) are in lines 1-10 of app.js — always available globally
- Tab → File mapping: Today=today.js, Week=week.js, Dissertation=dissertation.js, Cards=anki.js, Translate=translate.js, Claude=chat.js, Calendar=calendar.js
- The `habits` object inside `dayData()` is shared between Today tab and the now-deleted Habits tab — Today tab uses it for daily checkboxes, so don't remove it from `dayData()`