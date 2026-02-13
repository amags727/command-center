# app.js Modularization Plan

## Problem
`app.js` is 2,655 lines. Any task touching it consumes most of the context window just reading the file. The fix: split into ~13 files by the existing section markers.

## Architecture
All functions are global (plain `<script>` tags, no ES modules). The data layer must load first; everything else is order-independent.

## Extraction Map (line ranges from commit da0142f)

| File | Lines | Size | Section(s) |
|------|-------|------|------------|
| `core.js` | 1-10, 2039-2040 | ~12 lines | DATA LAYER + escHtml util |
| `calendar.js` | 108-627 | ~520 lines | DAY CALENDAR + ICS export/import |
| `today.js` | 32-106, 629-669 | ~115 lines | TODAY TAB + T3/intentions/seal |
| `flashcard-review.js` | 671-928 | ~258 lines | FLASHCARD REVIEW SHARED + REFLECTION SUBMIT |
| `week.js` | 929-980 | ~52 lines | WEEK TAB + daily summaries |
| `habits.js` | 982-1006 | ~25 lines | HABITS TAB + if-thens |
| `dissertation.js` | 1008-1091 | ~84 lines | DISSERTATION TAB + energy log |
| `focus.js` | 1058-1091 | ~34 lines | FOCUS TAB (distraction/energy) |
| `chat.js` | 1093-1158 | ~66 lines | CLAUDE TAB |
| `anki.js` | 1160-1728 | ~569 lines | CARDS TAB (SM-2, bulk import, CSV, vocab, browse) |
| `translate.js` | 1730-2014 | ~285 lines | TRANSLATE TAB |
| `aotd.js` | 2191-2602 | ~412 lines | ARTICLE OF THE DAY |
| `app.js` (slimmed) | 12-30, 2016-2037, 2042-2189, 2604-2655 | ~250 lines | NAV + LOG + AUTO-SEAL + LOAD ALL + NOTES + KEYBOARD + SYNC UI + INIT |

## Script Load Order in index.html
```html
<script src="core.js"></script>
<script src="calendar.js"></script>
<script src="today.js"></script>
<script src="flashcard-review.js"></script>
<script src="week.js"></script>
<script src="habits.js"></script>
<script src="dissertation.js"></script>
<script src="focus.js"></script>
<script src="chat.js"></script>
<script src="anki.js"></script>
<script src="translate.js"></script>
<script src="aotd.js"></script>
<script src="app.js"></script>
<script src="firebase-sync.js"></script>
```

## Key Dependencies
- **Everything** depends on `core.js` (load, save, today, weekId, dayData, weekData, getGlobal, addLog, escHtml)
- `today.js` calls `renderCal()` from `calendar.js`
- `flashcard-review.js` is used by both `chat.js` and `translate.js`
- `anki.js` uses `updateAnkiHabitFromCards()` which touches today's habit data
- `app.js` must be last (it has `DOMContentLoaded` init that calls into all modules)
- `firebase-sync.js` must be after `app.js` (it calls `loadAll()`)

## sw.js Cache List
Update the ASSETS array to include all new files.

## Extraction Steps (for a task runner)
1. Create `core.js` — copy lines 1-10 + line 2040 (escHtml)
2. For each module file: copy the exact line range, verify no stray dependencies
3. Build slimmed `app.js` from remaining sections (NAV, LOG, AUTO-SEAL, LOADALL, NOTES, KEYBOARD, SYNC UI, INIT)
4. Update `index.html` `<script>` tags
5. Update `sw.js` ASSETS array
6. Test in browser — every tab should still work
7. Git commit

## How to Use This in a Task
Tell the AI: "Read MODULARIZATION.md, then extract [specific file] from app.js using the line ranges listed. Do ONE file at a time."

This way each extraction task reads only ~500 lines instead of 2,655.