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
<script src="meals.js"></script>          <!-- Meal Planning tab -->
<script src="progress.js"></script>       <!-- Progress charts tab -->
<script src="week-archive.js"></script>   <!-- Weekly archive snapshots + log view -->
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

### flashcard-review.js (~365 lines)
Shared flashcard review modal, card rules constants, correction prompts:
`FLASH_CARD_RULES`, `COMPOSITION_EXTRACTION_RULES`, `CORRECTION_PROMPT_DAILY()`, `CORRECTION_PROMPT_ARTICLE()`, `CORRECTION_PROMPT_REPRODUCTION()`, `renderFlashcardReview()`, `fcSubmitAll()`, `fcChat()`, `_parseCardsJSON()`, `_parseReflectionScore()`, `submitRefl()`

### today.js (~170 lines)
Today tab orchestration:
`renderToday()`, `initToday()`, `getWeeklyGoalsForToday()`, `populateFromWeeklyGoals()`

### week.js (~150 lines)
Week tab + Weekly Goals (Work/School/Life):
`renderWeek()`, `addCWG()`, `submitWR()`, `switchWeekGoalTab()`, `saveWeekGoals()`, `loadWeekGoals()`, `weekGoalAssignDay()`, `weekGoalClearHighlights()`, `populateSchoolWeeklyGoals()`, `populateDissWeeklyGoals()`

### dissertation.js (~200 lines)
Dissertation tab:
`renderDissertation()`, `toggleChapter()`, `saveDissSection()`, `initDissertation()`

### chat.js (~66 lines)
Claude chat integration:
`sendChat()`, `initClaude()`

### anki.js (~607 lines)
SM-2 flashcard engine (Cards tab):
`renderAnki()`, `studyNow()`, `addManualCard()`, `addVocabList()`, `addPreMade()`, `browseDeck()`, `editCard()`, `deleteCard()`, `seedAnkiCards()`

### translate.js (~481 lines)
Italian reading, translation, reflection & prose reproduction (Read tab — article mode):
`renderTranslate()`, `trFetchURL()`, `trTranslateText()`, `trBindSelection()`, `trHandleSelection()`, `trCollectedWords`, `trSubmitWords()`, `trSubmitReflection()`, `trSwitchMode()`, `trStartRepro()`, `trLockPara()`, `trSubmitRepro()`, `trUpdateReproProgress()`

### book-translate.js (~259 lines)
Book mode translation (Read tab — book mode):
`bkSetDir()`, `bkImagesSelected()`, `bkRenderThumbs()`, `bkProcessNext()`, `bkClearAll()`, `bkBindSelection()`, `bkHandleSelection()`, `bkSubmitWords()`, `_callClaudeVision()`

### aotd.js (~412 lines)
Article of the Day:
`renderAOTD()`, `fetchArticle()`, `generateQuestions()`, `submitAnswers()`

### week-archive.js (~200 lines)
- `archiveWeek(wid)` — snapshot week data into `d.weekArchives[wid]`
- `buildArchiveEmail(wid, archive)` — generate Gmail-friendly HTML summary
- `sendArchiveEmail(wid)` — send via EmailJS
- `manualArchiveWeek()` — button handler for manual archive+email
- `renderWeekArchives()` — collapsible Year→Month→Week tree on Log tab
- `checkWeekTransition()` — auto-archive on week rollover

### progress.js (~440 lines)
Progress tab with Chart.js graphs (Anki, Italian scores incl. green reproduction line, nutrition, weight):
`renderProgress()`, `setProgressRange()`, `_getAllDatesInRange()`, `_getCardsData()`, `_renderAnkiChart()`, `_renderItalianChart()`, `_renderNutritionChart()`, `_renderWeightChart()`

### meals.js (~407 lines)
Meal Planning tab — day type toggle, food submission (photo/text/stored), Claude macro analysis, circular progress rings, stored meal library:
`renderMeals()`, `setDayType()`, `renderMacroRings()`, `renderMealLog()`, `removeMealEntry()`, `renderStoredMeals()`, `toggleMealLibrary()`, `filterMealLibrary()`, `quickAddStoredMeal()`, `deleteStoredMeal()`, `editStoredMeal()`, `mealNameInput()`, `selectAutocomplete()`, `mealImageSelected()`, `clearMealImage()`, `initMealPasteHandler()`, `submitFood()`, `analyzeFoodWithClaude()`

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
| Read | translate.js + book-translate.js + flashcard-review.js | tab-translate |
| Claude | chat.js + flashcard-review.js | tab-claude |
| Meals | meals.js | tab-meals |
| Progress | progress.js | tab-progress |
| Log | app.js (renderLog, addConfession, export/import), week-archive.js (renderWeekArchives) | tab-log |

## Backup
`app.js.bak` contains the original 2,568-line monolith. Safe to delete once satisfied with the modularization.