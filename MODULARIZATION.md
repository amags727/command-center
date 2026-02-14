# Modularization State — COMPLETE

## Overview
`app.js` has been fully modularized. It went from 2,568 lines to **241 lines** — a pure orchestration shell. All feature code lives in dedicated module files.

## Script Load Order (index.html)
```html
<script src="core.js"></script>           <!-- data layer -->
<script src="calendar.js"></script>       <!-- day calendar rendering -->
<script src="flashcard-review.js"></script><!-- shared card review UI -->
<script src="today.js"></script>          <!-- Today tab -->
<script src="week.js"></script>           <!-- Week tab -->
<script src="dissertation.js"></script>   <!-- Dissertation tab -->
<script src="chat.js"></script>           <!-- Claude tab -->
<script src="anki.js"></script>           <!-- Cards/SM-2 tab -->
<script src="translate.js"></script>      <!-- Read/Translate tab -->
<script src="aotd.js"></script>           <!-- Article of the Day -->
<script src="app.js"></script>            <!-- orchestration: nav, notes, keyboard, init -->
<script src="firebase-sync.js"></script>  <!-- sync layer (last) -->
```

## Module → Function Map

### core.js (~10 lines)
Data layer used by everything:
`load()`, `save()`, `today()`, `weekId()`, `dayData()`, `weekData()`, `getGlobal()`, `addLog()`, `escHtml()`

### calendar.js (~520 lines)
Day calendar rendering + goal management:
`renderCalendar()`, `toggleGoal()`, `addGoal()`, `removeGoal()`, `moveGoal()`, `editGoal()`, `toggleDayGoalCategory()`, `renderItalianWork()`, `submitReflection()`, `renderReflection()`

### flashcard-review.js (~228 lines)
Shared flashcard review modal used by Cards, Translate, and Claude tabs:
`startReview()`, `showCard()`, `flipCard()`, `rateCard()`, `endReview()`

### today.js (~120 lines)
Today tab orchestration:
`renderToday()`, `initToday()`

### week.js (~53 lines)
Week tab:
`renderWeek()`, `addCWG()`, `submitWR()`

### dissertation.js (~200 lines)
Dissertation tab:
`renderDissertation()`, `toggleChapter()`, `saveDissSection()`, `initDissertation()`

### chat.js (~66 lines)
Claude chat integration:
`sendChat()`, `initClaude()`

### anki.js (~607 lines)
SM-2 flashcard engine (Cards tab):
`renderAnki()`, `studyNow()`, `addManualCard()`, `addVocabList()`, `addPreMade()`, `browseDeck()`, `editCard()`, `deleteCard()`, `seedAnkiCards()`

### translate.js (~294 lines)
Italian reading & translation (Read tab):
`renderTranslate()`, `fetchAndTranslate()`, `pasteText()`, `collectWord()`, `renderReadingHistory()`

### aotd.js (~412 lines)
Article of the Day:
`renderAOTD()`, `fetchArticle()`, `generateQuestions()`, `submitAnswers()`

### app.js (~241 lines)
Orchestration shell:
- `switchTab()` + NAV array
- `loadAll()` — refresh dispatcher
- `saveTodayNotes()`, `loadTodayNotes()`, `saveWeekNotes()`, `loadWeekNotes()`
- Keyboard shortcuts + auto-numbered list
- Auto-seal midnight check
- `doSyncConnect()`, `doSyncDisconnect()`, `initSyncUI()`
- `DOMContentLoaded` init handler

### firebase-sync.js (~150 lines)
Firebase sync layer (loaded last):
`initSync()`, `pushData()`, `pullData()`

## Tab → File Mapping
| Tab | JS Source | HTML id |
|-----|-----------|---------|
| Today | today.js + calendar.js + aotd.js | tab-today |
| Week | week.js | tab-week |
| Dissertation | dissertation.js | tab-dissertation |
| Cards | anki.js + flashcard-review.js | tab-cards |
| Read | translate.js + flashcard-review.js | tab-translate |
| Claude | chat.js + flashcard-review.js | tab-claude |
| Log | app.js (renderLog, addConfession, export/import) | tab-log |

## Backup
`app.js.bak` contains the original 2,568-line monolith. Safe to delete once satisfied with the modularization.