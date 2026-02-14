# Continuation Prompt — Codebase Cleanup

## What's Done
- **Phase 0**: Created this continuation doc
- **Phase 1**: Removed Habits/Inbox/Focus tabs entirely — deleted `habits.js`, `inbox.js`, `focus.js` files, removed nav buttons + HTML sections from `index.html`, cleaned tab-switching array in `app.js` (names array is now `['today','week','dissertation','cards','translate','claude','log']`)
- **Phase 2**: Removed all cross-references — cleaned `getGlobal()` (removed `d.inbox` and `d.ifthens` init), removed inbox count from `buildContext()`, confirmed `sw.js` was already clean. Dead function bodies (lines 964-1031 old numbering) deleted from `app.js`.
- All committed: `27029e5`

## What's Next

### Phase 3: Trim dissertation.js
User wants to KEEP dissertation page EXCEPT:
- Overall progress section (remove)
- Chapter outline section (remove)  
- Deep work timer (remove)

To do this:
1. `grep -n "overall\|chapter\|deep.work\|timer" dissertation.js` to find the sections
2. Also check `index.html` for the corresponding HTML sections in `tab-dissertation`
3. Remove the JS functions and HTML for those three features
4. Keep everything else on the dissertation page

### Phase 4: Final Audit
1. Search for any remaining references to deleted features across ALL files: `grep -rn "renderHabits\|renderInbox\|renderFocus\|habits\.js\|inbox\.js\|focus\.js\|tab-habits\|tab-inbox\|tab-focus" *.js *.html`
2. Check `sw.js` cache list for deleted files
3. Check `manifest.json` if it references deleted files
4. Browser test the site — load index.html, click through every tab, verify no console errors
5. Git commit final state
6. Push to remote

### Important Context
- `app.js` is the monolith (~1900 lines post-cleanup). Don't read it all — use grep/sed.
- `day.habits` object on Today tab is KEPT — it tracks anki, articles, gym, convo. Don't touch those.
- The `week.js` file exists but week rendering is actually in `app.js` (renderWeek function around line 910+).
- `dissertation.js` is a separate module loaded by index.html.
- `today.js` has chip-based T3/intentions logic. Keep as-is.
- `core.js` has shared utilities. Keep as-is.
- Nav order: today, week, dissertation, cards, translate, claude, log

### Files That Should Exist Post-Cleanup
- `index.html`, `app.js`, `core.js`, `today.js`, `dissertation.js`, `anki.js`, `translate.js`, `chat.js`, `calendar.js`, `week.js`, `aotd.js`, `firebase-sync.js`, `flashcard-review.js`, `sw.js`, `manifest.json`
- DELETED: `habits.js`, `inbox.js`, `focus.js`