# Modularization Task Prompts

Run these as separate Cline tasks, in order. Each extracts one module from app.js.

---

## Task 1: core.js
```
Read MODULARIZATION.md for context. Extract core.js from app.js.
- Copy lines 1-10 (the KEY constant and all data-layer functions: load, save, today, weekId, dayData, weekData, getGlobal, addLog) into a new file core.js
- Also move the escHtml function (line 2040) into core.js
- Delete those exact lines from app.js (leave everything else untouched)
- Do NOT touch index.html or sw.js yet
- Git commit: "Extract core.js data layer"
```

## Task 2: calendar.js
```
Read MODULARIZATION.md for context. Extract calendar.js from app.js.
- Copy lines 108-627 (the CAL object, all cal* functions, getCalBlocks, renderCal, ICS export/import) into calendar.js
- Delete those lines from app.js
- Git commit: "Extract calendar.js"
```

## Task 3: today.js
```
Read MODULARIZATION.md for context. Extract today.js from app.js.
- Copy lines 32-106 (initToday, lockToday, gateHabit, valArt) AND lines 629-669 (addBlock stubs, saveT3Intentions, loadT3Intentions, updRC, sealDay) into today.js
- Delete those lines from app.js
- Git commit: "Extract today.js"
```

## Task 4: flashcard-review.js
```
Read MODULARIZATION.md for context. Extract flashcard-review.js from app.js.
- Copy lines 671-928 (FLASHCARD REVIEW SHARED INFRASTRUCTURE + REFLECTION SUBMIT sections) into flashcard-review.js
- Delete those lines from app.js
- Git commit: "Extract flashcard-review.js"
```

## Task 5: week.js + habits.js + dissertation.js + focus.js
```
Read MODULARIZATION.md for context. Extract these small modules from app.js (they're short enough to do together):
- week.js: lines 929-980 (renderWeek, addCWG, renderDailySummaries, renderCWG, toggleCWG, rmCWG, submitWR)
- habits.js: lines 982-1006 (renderHabits, addIFT, renderIFT, rmIFT)
- dissertation.js: lines 1008-1057 (renderDiss, addCh, renderChapters, updChW, rmCh, updateDissChapterSelect, dissTimer, renderDissLog)
- focus.js: lines 1058-1091 (renderFocus, logDistraction, logEnergy)
- Delete all those lines from app.js
- Git commit: "Extract week, habits, dissertation, focus modules"
```

## Task 6: chat.js
```
Read MODULARIZATION.md for context. Extract chat.js from app.js.
- Copy lines 1093-1158 (initClaude, saveKey, sendChat, buildContext, renderChat, copyAnki, dlAnki) into chat.js
- Delete those lines from app.js
- Git commit: "Extract chat.js"
```

## Task 7: anki.js
```
Read MODULARIZATION.md for context. Extract anki.js from app.js.
- Copy lines 1160-1728 (CARDS TAB with SM-2, all study/add/import/browse functions, ADD CARDS MODE SWITCHER, VOCAB LIST, CSV/TSV IMPORT) into anki.js
- Delete those lines from app.js
- Git commit: "Extract anki.js"
```

## Task 8: translate.js
```
Read MODULARIZATION.md for context. Extract translate.js from app.js.
- Copy lines 1730-2014 (TRANSLATE TAB - renderTranslate through trSubmitReflectionAuto) into translate.js
- Delete those lines from app.js
- Git commit: "Extract translate.js"
```

## Task 9: aotd.js
```
Read MODULARIZATION.md for context. Extract aotd.js from app.js.
- Copy lines 2191-2602 (ARTICLE OF THE DAY - fetchArticleOfTheDay through forceNewArticle) into aotd.js
- Delete those lines from app.js
- Git commit: "Extract aotd.js"
```

## Task 10: Finalize
```
Read MODULARIZATION.md for context. Finalize the modularization:
1. Verify app.js now only contains: NAV (switchTab), LOG (renderLog, addConfession, exportData, importData), AUTO-SEAL, LOADALL, NOTES, KEYBOARD SHORTCUTS, SYNC UI, and INIT
2. Update index.html to add script tags in this order BEFORE the existing app.js tag:
   core.js, calendar.js, today.js, flashcard-review.js, week.js, habits.js, dissertation.js, focus.js, chat.js, anki.js, translate.js, aotd.js
3. Update sw.js ASSETS array to include all new .js files
4. Git commit: "Complete modularization - wire up script tags"
```

---

## After modularization: the original Daily Summaries task
```
Read MODULARIZATION.md for context. The app is now modularized.

Change Daily Summaries (in week.js, ~52 lines) so that:
- It shows as ONE cell with day-name buttons (Mon-Sun) across the top
- Clicking a button populates the cell with that day's saved entries
- Days not yet logged show "No entries logged yet"  
- Future days show "—"
- Only read week.js and the week tab HTML section in index.html — you don't need the rest