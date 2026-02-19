# UI Element Map & Style Guide

> **Purpose**: Shared vocabulary between user and developer for every visible element in the Command Center app. When you say "make the fine print bigger" or "change the Life subtitle on the Today page," this document maps that to exact code references.

---

## Style Guide — Typography Tiers

All text sizing is controlled by CSS custom properties defined in `index.html <style>`. To change a tier's size globally, edit the one variable.

| Your name | CSS Variable | CSS Class | Current Size | Where it's used |
|---|---|---|---|---|
| **Fine print** | `--font-xs` | `.text-xs` | 11px | Hints ("tap to flip"), timestamps, countdown text, word counts, status messages, tiny labels |
| **Helper text** | `--font-sm` | `.text-sm` | 13px | Muted descriptions under headings, form labels, captions, placeholder instructions, filter labels |
| **Body text** | `--font-md` | `.text-md` | 15px | Default content, input fields, notes editors, card body copy, textarea content |
| **Emphasis text** | `--font-lg` | `.text-lg` | 18px | Italian checklist items, flashcard display text, feedback content, reflection results |
| **Display text** | `--font-xl` | `.text-xl` | 20px | Sub-result headings ("Claude's Feedback", "Review Flashcards", "Reproduction Evaluation") |

### Heading Hierarchy

| Your name | HTML tag | CSS class (if any) | Current Size | Where it's used |
|---|---|---|---|---|
| **Tab page title** | `<h1>` | — | ~28px (CSS) | One per tab: "📅 Today", "📊 Week of…", "📝 Dissertation", etc. |
| **Tab page title (alt)** | `<h2>` | — | ~24px (CSS) | Meals ("🍽️ Meal Planning"), Progress ("📈 Progress") |
| **Card section title** | `<h3>` | — | CSS default | Every card header: "🎯 Daily Goals", "📝 Notes", "🇮🇹 Italian Work", etc. |
| **Card subtitle** | `<h4>` | `.card-subtitle` | 20px | Category labels within a card: "💼 Work", "🎓 School", "🌱 Life" |
| **Collapsible heading** | `<summary>` | `.card-subtitle` | inherits h4 | Week tab Work/School/Life (inside `<details>` elements) |

### Button Sizes

| Your name | CSS class | Notes |
|---|---|---|
| **Standard button** | `.btn` | Regular actions |
| **Small button** | `.btn btn-s` | Secondary actions, filters |
| **Primary button** | `.btn btn-p` | Main submit actions (green) |
| **Danger button** | `.btn btn-d` | Destructive actions (red) |

---

## Element Map — Per Tab

Legend:
- **What you'd call it** = natural language description
- **Code ref** = HTML id, tag, or class to search for
- **Heading level** = h1/h2/h3/h4/summary/none
- **Text tier** = which typography tier (fine-print, helper, body, emphasis, display)

---

### Global Elements

- **Sync bar** — `id="sync-bar"` — the bar at the very top with sync status
  - Sync status text — `id="sync-status"` — fine-print
  - Sync passphrase input — `id="sync-pass"`
  - Disconnect button — `id="sync-disc-btn"`
- **Navigation bar** — `id="nav"` — bottom tab bar with all tab buttons
  - Each nav button has `.nav-icon` (emoji) and `.nav-label` (text)
  - Force update button — the ⟳ at the end of nav

---

### 📅 Today Tab (`id="tab-today"`)

- **Page title** (today's date) — `<h1 id="today-date">` — h1
- **Day label** (day of week / status) — `id="today-label"` — fine-print

- **Push Goal banner** — `id="push-goal-banner"` (currently `pgb`) — conditionally shown card
  - Banner title "🎯 Push Goal This Week" — `<h3>` — h3
  - Push goal text — `id="push-goal-text"` (currently `pg-text`) — body
  - Push goal countdown — `id="push-goal-countdown"` (currently `pg-countdown`) — fine-print

- **Article of the Day card** — `id="aotd-card"` — card
  - Card title "🗞️ Article of the Day" — `<h3>` — h3
  - Loading skeleton — `id="aotd-loading"`
  - Result container — `id="aotd-result"`
    - Article icon — `id="aotd-icon"`
    - Article title link — `id="aotd-link"` inside `.aotd-title`
    - Article category badge — `id="aotd-cat"` inside `.aotd-meta`
    - Article source — `id="aotd-source"` inside `.aotd-meta`
    - Article blurb — `id="aotd-blurb"` — helper
    - Article claim — `id="aotd-claim"` — helper
    - "Read →" button — `id="aotd-read-link"`
    - "Archive" button — `id="aotd-archive-link"`
  - No-key message — `id="aotd-nokey"`
  - Error message — `id="aotd-error"` / `id="aotd-error-msg"` — helper

- **Daily Goals card** — card (no id on wrapper)
  - Card title "🎯 Daily Goals" — `<h3>` — h3
  - Goals grid — `id="daily-goals-grid"` (currently `t3-grid`)
    - **Work subtitle** "💼 Work" — `<h4>` — card-subtitle, blue
      - Work chips container — `id="daily-goals-work"` (currently `t3-work`)
      - "+ Add" button — `.chip-add`
    - **School subtitle** "🎓 School" — `<h4>` — card-subtitle, purple
      - School chips container — `id="daily-goals-school"` (currently `t3-school`)
    - **Life subtitle** "🌱 Life" — `<h4>` — card-subtitle, green
      - Life chips container — `id="daily-goals-life"` (currently `t3-life`)

- **Notes card** — card (no id on wrapper)
  - Card title "📝 Notes" — `<h3>` — h3
  - Notes editor — `id="today-notes"` — body, contenteditable div

- **Calendar card** — card (no id on wrapper)
  - Calendar container — `id="cal-container"` — rendered by calendar.js
  - Zoom in/out buttons, Export/Import buttons — `.btn btn-s`

- **Italian Work card** — card (no id on wrapper)
  - Card title "🇮🇹 Italian Work" — `<h3>` — h3
  - **Anki checkbox row** — `id="italian-check-anki"` (currently `h-anki`) — emphasis
    - Anki count — `id="anki-ct"` / target — `id="anki-target"`
  - **Article 1 checkbox row** — `id="italian-check-art1"` (currently `h-art1`) — emphasis
  - **Article 2 checkbox row** — `id="italian-check-art2"` (currently `h-art2`) — emphasis
  - **Reflection checkbox row** — `id="italian-check-refl"` (currently `h-refl`) — emphasis
  - Anki warning — `id="anki-w"` — fine-print
  - Hidden fields: `anki-ct-val`, `art1-t`, `art1-th`, `art2-t`, `art2-th`, `art1-status`, `art2-status`

- **Daily Reflection sub-section** (inside Italian Work card)
  - Sub-title "📝 Riflessione Giornaliera" — `<h3>` — h3
  - Reflection textarea — `id="reflection-text"` (currently `refl-txt`) — body
  - Word count — `id="reflection-wordcount"` (currently `refl-wc`) — fine-print
  - Reflection result — `id="reflection-result"` (currently `refl-res`)
  - Flashcard review sub-card — `id="refl-card-review"`
    - Sub-title "🎴 Review Flashcards" — `<h3>` — display

- **Seal Day card** — card (no id)
  - "🔒 Seal Today" button — `.btn btn-d`
  - Description text — fine-print

---

### 📊 Week Tab (`id="tab-week"`)

- **Page title** "📊 Week of [date]" — `<h1>` with `<span id="week-date">` (currently `wk-date`) — h1

- **Weekly Goals card** — card (no id on wrapper)
  - Card title "🎯 Weekly Goals" — `<h3>` — h3
  - Week navigator label — `id="week-goal-label"` (currently `wk-goal-label`) — helper
  - Prev/Next week buttons — `.btn`
  - Stretch goals container — `id="stretch-goals-container"` — dynamic content
  - **Work collapsible** — `<details>` → `<summary>` "💼 Work" — card-subtitle, blue
    - Work goals editor — `id="week-goals-work"` (currently `wg-work`) — body, contenteditable
  - **School collapsible** — `<details>` → `<summary>` "🎓 School" — card-subtitle, purple
    - School goals editor — `id="week-goals-school"` (currently `wg-school`) — body, contenteditable
  - **Life collapsible** — `<details>` → `<summary>` "🌿 Life" — card-subtitle, green
    - Life goals editor — `id="week-goals-life"` (currently `wg-life`) — body, contenteditable
  - Day highlight buttons (MON–SUN) — `.wg-day-btn` — fine-print
  - Clear highlights button — fine-print

- **Daily Summaries card** — card
  - Card title "📋 Daily Summaries" — `<h3>` — h3
  - Day buttons — `id="daily-summary-buttons"` (currently `ds-buttons`)
  - Summary content — `id="daily-summary-content"` (currently `ds-content`) — helper

- **Weekly Review card** — card
  - Card title "🔍 Weekly Review" — `<h3>` — h3
  - Description text — helper
  - "What went well?" prompt — `id="weekly-review-well"` (currently `wr-well`) — body
  - "What didn't go as planned?" prompt — `id="weekly-review-bad"` (currently `wr-bad`) — body
  - "What's the #1 thing to improve?" prompt — `id="weekly-review-improve"` (currently `wr-imp`) — body
  - "Push Goal result" prompt — `id="weekly-review-push"` (currently `wr-push`) — body
  - Submit button — `.btn btn-p`
  - Review result — `id="weekly-review-result"` (currently `wr-res`)

---

### 📝 Dissertation Tab (`id="tab-dissertation"`)

- **Page title** "📝 Dissertation" — `<h1>` — h1

- **Weekly Goals card** — card
  - Card title "🎯 Weekly Goals" — `<h3>` with `<span id="diss-week-label">` — h3
  - Prev/Next buttons — `.btn`
  - Week indicator — `id="diss-week-indicator"` — fine-print
  - Goals editor — `id="diss-weekly-goals"` — body, contenteditable
  - Highlight buttons (same pattern as Week tab)

- **Chapter cards** — `id="diss-chapter-cards"`
  - **Chapter 1: Migration** — `.diss-ch-card` `data-ch="ch1"`
    - Chapter header — `.diss-ch-header` — clickable toggle
    - Arrow icon — `id="diss-arrow-ch1"`
    - Sync status — `id="diss-sync-ch1"`
    - Chapter body — `id="diss-body-ch1"`
      - Markdown editor — `id="diss-edit-ch1"` — body
      - Rendered markdown — `id="diss-render-ch1"`
  - **Chapter 2: Data Economy (Closed)** — same pattern, `ch2`
  - **Chapter 3: Data Economy (Open)** — same pattern, `ch3`

---

### 🤖 Claude Tab (`id="tab-claude"`)

- **Page title** "🤖 Claude Integration" — `<h1>` — h1

- **API Key section** — `.apikey`
  - Label "Anthropic API Key" — `<b>` — emphasis
  - Key input — `id="api-key"`

- **Chat card** — card
  - Card title "💬 Chat" — `<h3>` — h3
  - Description — helper
  - Chat messages area — `id="chat-msgs"`
  - Chat input — `id="chat-in"` — body
  - Send button

- **Italian Corrections card** — card
  - Card title "📝 Italian Corrections" — `<h3>` — h3
  - Description — helper
  - Corrections display — `id="corrections-area"` — emphasis

- **Generated Anki Cards card** — card
  - Card title "🃏 Generated Anki Cards" — `<h3>` — h3
  - Description — helper
  - Cards display — `id="anki-area"`
  - Copy All / Download buttons — `.btn btn-s`

---

### 🃏 Cards Tab (`id="tab-cards"`)

- **Page title** "🃏 Flashcards" — `<h1>` — h1

- **Stats summary bar** — `id="cards-summary"` — card
  - New remaining — `id="cards-new-remaining"` — emphasis (blue)
  - Learning count — `id="cards-learning-ct"` — emphasis (red)
  - Review remaining — `id="cards-review-remaining"` — emphasis (green)
  - Reviewed today — `id="cards-reviewed-today"` — emphasis (purple)
  - Stat labels — `.cards-stat-label` — fine-print
  - New/day input — `id="cards-new-limit"` — helper
  - Review cap input — `id="cards-review-cap"` — helper
  - Limit status — `id="cards-limit-status"` — helper
  - "Add 5 more" button — `id="cards-add-more-btn"` — `.btn btn-s`

- **Study area** (shown during study session) — `id="study-area"`
  - Card front — `id="study-front"` — display
  - Card back content — `id="study-back-content"` — display
  - Rating buttons: Hard (`id="hard-ivl"`), Good (`id="good-ivl"`), Easy (`id="easy-ivl"`)
  - "Tap to flip" hint — `id="study-hint"` — fine-print
  - Undo button — `id="undo-card-btn"` — `.btn btn-s`
  - End Session button — `.btn btn-s`

- **Add Cards card** — card
  - Card title "➕ Add Cards" — `<h3>` — h3
  - Mode buttons: Manual (`id="add-mode-manual-btn"`), Vocab (`id="add-mode-vocab-btn"`), Pre-Made (`id="add-mode-premade-btn"`)
  - **Manual Entry** panel — `id="add-mode-manual"`
    - Front input — `id="card-front"` — body
    - Back input — `id="card-back"` — body
  - **Vocab List** panel — `id="add-mode-vocab"`
    - Description — helper
    - Vocab textarea — `id="vocab-list-text"` — body
    - Generate button — `.btn btn-p`
    - Status — `id="vocab-list-status"` — helper
  - **Pre-Made** panel — `id="add-mode-premade"`
    - Description — helper
    - File chooser — `id="csv-file-input"`
    - Preview table — `id="csv-preview-table"`
    - Column selectors — `id="csv-front-col"`, `id="csv-back-col"` — helper
    - Import button — `.btn btn-p`

- **Browse Deck card** — card
  - Collapsible details — `id="browse-deck-details"`
  - Search input — `id="card-search"` — body
  - Filter dropdown — `id="card-filter"` — body
  - Card browse list — `id="card-browse"`

---

### 🇮🇹 Read/Translate Tab (`id="tab-translate"`)

- **Page title** "🇮🇹 Italian Reading" — `<h1>` — h1

- **Mode toggle** — card (no id)
  - Article mode button — `id="tr-mode-article"`
  - Book mode button — `id="tr-mode-book"`

#### Article Mode (`id="tr-article-mode"`)

- **Fetch & Translate card** — card
  - Card title "📰 Fetch & Translate Article" — `<h3>` — h3
  - URL input — `id="tr-url"` — body
  - Raw text textarea — `id="tr-raw"` — body
  - Status — `id="tr-status"` — helper

- **Translation result card** — `id="tr-result-card"`
  - Article title — `<h3 id="tr-title">` — h3
  - Article meta — `id="tr-meta"` — fine-print
  - Translation table — `id="tr-table"` / `id="tr-tbody"`

- **Article Reflection card** — `id="tr-reflection-card"`
  - Card title "✍️ Reflection (in Italian)" — `<h3>` — h3
  - Reflection textarea — `id="tr-refl-txt"` — body
  - Word count — `id="tr-refl-wc"` — fine-print
  - Submit button — `id="tr-refl-submit-btn"` — `.btn btn-p`
  - Status — `id="tr-refl-status"` — helper
  - **Claude's Feedback sub-card** — `id="tr-refl-result"`
    - Sub-title "📝 Claude's Feedback" — `<h4>` — display
    - Feedback content — `id="tr-refl-feedback"` — emphasis
  - Flashcard review — `id="tr-refl-card-review"`

- **Prose Reproduction card** — `id="tr-repro-card"`
  - Card title "✍️ Prose Reproduction Exercise" — `<h3>` — h3
  - Start button — `id="tr-repro-start-btn"` — `.btn btn-p`
  - Progress — `id="tr-repro-progress"`
  - Status — `id="tr-repro-status"` — helper
  - **Reproduction Evaluation sub-card** — `id="tr-repro-result"`
    - Sub-title "📝 Reproduction Evaluation" — `<h4>` — display
    - Feedback content — `id="tr-repro-feedback"` — emphasis
  - Flashcard review — `id="tr-repro-card-review"`

- **Collected Words card** — `id="tr-collected-card"`
  - Card title "🃏 Collected Words (N)" — `<h3>` with `<span id="tr-coll-ct">` — h3
  - Words status — `id="tr-words-status"` — helper
  - Words list — `id="tr-collected-list"`
  - Flashcard review — `id="tr-words-card-review"`

- **Reading History card** — card
  - Card title "📚 Reading History" — `<h3>` — h3
  - History list — `id="tr-history"`

#### Book Mode (`id="tr-book-mode"`)

- **Book Translation card** — card
  - Card title "📖 Book Translation" — `<h3>` — h3
  - Direction buttons: IT→EN (`id="bk-dir-it2en"`), EN→IT (`id="bk-dir-en2it"`)
  - Upload button / file input — `id="bk-img-input"`
  - Upload status — `id="bk-upload-status"` — helper

- **Pages thumbnail card** — `id="bk-thumbs-card"`
  - Card title "📑 Pages (N)" — `<h3>` with `<span id="bk-page-total">` — h3
  - Thumbnails strip — `id="bk-thumbs"`

- **Book Reader card** — `id="bk-reader-card"`
  - Prev/Next buttons — `id="bk-prev-btn"` / `id="bk-next-btn"`
  - Page label — `id="bk-page-label"` — body
  - Page status — `id="bk-page-status"` — helper
  - Translation table — `id="bk-table"` / `id="bk-tbody"`
  - Source header — `id="bk-th-src"` / Target header — `id="bk-th-tgt"`

- **Book Collected Words card** — `id="bk-collected-card"`
  - Card title "🃏 Collected Words (N)" — `<h3>` with `<span id="bk-coll-ct">` — h3
  - Generate button — `.btn btn-p`
  - Words status — `id="bk-words-status"` — helper
  - Words list — `id="bk-collected-list"`
  - Flashcard review — `id="bk-words-card-review"`

---

### 🍽️ Meals Tab (`id="tab-meals"`)

- **Page title** "🍽️ Meal Planning" — `<h2>` — h2 (should be h1 for consistency)

- **Day Type & Targets card** — card (no id)
  - "Day Type:" label — `<b>` — helper
  - Workout button — `id="meal-day-workout"`
  - Rest button — `id="meal-day-rest"`
  - Targets display — `id="meal-targets-display"` — helper
  - "⚖️ Weight:" label — `<b>` — helper
  - Weight input — `id="meal-weight-in"` — helper

- **Macro rings** — `id="meal-rings"` — `.meal-rings`
  - Ring items — `.meal-ring-item` with `.meal-ring-label` — fine-print

- **Add Food card** — card
  - Card title "Add Food" — `<h3>` — h3
  - Photo upload — `id="meal-img-input"` / preview — `id="meal-img-preview"`
  - Food name input — `id="meal-name-in"` — helper
  - Autocomplete dropdown — `id="meal-autocomplete"`
  - Description textarea — `id="meal-desc-in"` — helper
  - Macro inputs: Calories (`id="meal-cal-in"`), Protein (`id="meal-prot-in"`), Carbs (`id="meal-carb-in"`), Fat (`id="meal-fat-in"`) — helper
  - Submit button — `id="meal-submit-btn"`

- **Food Diary card** — card
  - Card title "Food Diary" — `<h3>` — h3
  - Diary entries — `id="meal-log"`

- **Stored Meals card** — card (collapsible)
  - Chevron — `id="meal-lib-chevron"` — helper
  - Card title "Stored Meals" — `<h3>` — h3
  - Library body — `id="meal-library-body"`
  - Search input — `id="meal-lib-search"` — helper
  - Library list — `id="meal-library-list"`

---

### 📈 Progress Tab (`id="tab-progress"`)

- **Page title** "📈 Progress" — `<h2>` — h2 (should be h1 for consistency)

- **Range buttons** — `.prog-range-btn`: 14d, 30d, YTD, All

- **Empty state message** — `id="progress-empty"` — helper

- **Charts grid** — `.prog-grid`
  - **Anki Activity chart** — card `.prog-cell`, `<h3>` "🃏 Anki Activity", `<canvas id="chart-anki">`
  - **Italian Scores chart** — card `.prog-cell`, `<h3>` "🇮🇹 Italian Scores", `<canvas id="chart-italian">`
  - **Calories & Protein chart** — card `.prog-cell`, `<h3>` "🍽️ Calories & Protein", `<canvas id="chart-nutrition">`
  - **Weight chart** — card `.prog-cell`, `<h3>` "⚖️ Weight", `<canvas id="chart-weight">`

---

### 📋 Log Tab (`id="tab-log"`)

- **Page title** "📋 Activity Log" — `<h1>` — h1

- **Filter card** — card
  - Card title "🔍 Filter" — `<h3>` — h3
  - Filter dropdown — `id="log-filter"` — body
  - Date filter — `id="log-date-filter"` — body

- **Confession / Note card** — card
  - Card title "📖 Confession / Note" — `<h3>` — h3
  - Confession textarea — `id="confess-in"` — body
  - Log button — `.btn btn-s`

- **Memory List card** — card
  - Card title "🎯 Memory List" — `<h3>` — h3
  - Description — helper
  - Memory list container — `id="memory-list-container"`

- **Log entries** — `id="log-entries"` — scrollable list

- **Weekly Archives card** — card
  - Card title "📦 Weekly Archives" — `<h3>` — h3
  - Archive button — `.btn btn-s`
  - Archives list — `id="week-archives"`

- **Export/Import card** — card
  - Export button — `.btn btn-s`
  - Import file input

---

### Modals

- **Site Lock modal** — `id="site-lock-modal"`
  - Title "🔒 Site Locked" — `<h2>` — h2
- **Stretch Goal Complete modal** — `id="sg-complete-modal"`
  - Content — `id="sg-complete-content"`

---

## ID Rename Log

IDs listed as "(currently `old-id`)" above will be renamed. Full rename map:

- `pgb` → `push-goal-banner`
- `pg-text` → `push-goal-text`
- `pg-countdown` → `push-goal-countdown`
- `t3-grid` → `daily-goals-grid`
- `t3-work` → `daily-goals-work`
- `t3-school` → `daily-goals-school`
- `t3-life` → `daily-goals-life`
- `h-anki` → `italian-check-anki`
- `h-art1` → `italian-check-art1`
- `h-art2` → `italian-check-art2`
- `h-refl` → `italian-check-refl`
- `refl-txt` → `reflection-text`
- `refl-wc` → `reflection-wordcount`
- `refl-res` → `reflection-result`
- `wk-date` → `week-date`
- `wk-goal-label` → `week-goal-label`
- `wg-work` → `week-goals-work`
- `wg-school` → `week-goals-school`
- `wg-life` → `week-goals-life`
- `ds-buttons` → `daily-summary-buttons`
- `ds-content` → `daily-summary-content`
- `wr-well` → `weekly-review-well`
- `wr-bad` → `weekly-review-bad`
- `wr-imp` → `weekly-review-improve`
- `wr-push` → `weekly-review-push`
- `wr-res` → `weekly-review-result`