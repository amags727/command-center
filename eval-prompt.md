# Evaluation Prompt for Language Acquisition System

Paste this into GPT along with the zip file contents.

---

I'm building a self-directed Italian language acquisition system as part of a personal productivity app. The target is going from solid B2 to C2. The system runs entirely client-side (vanilla JS, no framework) and uses the Anthropic Claude API for all AI-powered features.

I'm attaching the code files that handle the language learning portion of the app. Here's what each file does:

- **flashcard-review.js** — The brain. Contains all prompt engineering constants: flashcard construction rules (`FLASH_CARD_RULES`), composition extraction rules (`COMPOSITION_EXTRACTION_RULES`), and three correction/grading prompts for daily compositions, article reflections, and prose reproduction exercises. Also contains the shared flashcard review UI (edit/delete/submit cards, chat with Claude about card quality).

- **translate.js** — Article mode of the Read tab. Fetches Italian articles via URL, sends to Claude for paragraph-aligned translation with 4 paragraphs flagged for reproduction exercises. Handles word collection (highlight to collect), article reflection submission with grading, and the prose reproduction exercise (lock paragraphs → reproduce from memory → 4-dimension rubric evaluation → side-by-side comparison → flashcard generation from errors).

- **book-translate.js** — Book mode. Upload page photos, Claude Vision OCR + translation, word collection for flashcards.

- **anki.js** — SM-2 spaced repetition engine. Manages card states (new/learning/review), scheduling, study sessions. Supports manual entry, vocab list generation via Claude, CSV import. Tracks review counts per day.

- **aotd.js** — Article of the Day. Scans Italian RSS feeds, uses Claude to pick an article matched to interests, presents it with a blurb.

- **composition_flashcard_extraction_rules.rtf** / **flash_card_rules.rtf** — The original rule documents that were distilled into the JS constants.

- **MODULARIZATION.md** — Module map showing how these files fit into the larger app.

## What I want you to evaluate

### 1. Pedagogical soundness
- Does the overall system design make sense for pushing from B2 to C2?
- Are the right activities prioritized? (daily composition, article reading + reflection, prose reproduction, spaced repetition)
- Is anything missing that would be high-impact for this level transition?
- Is anything included that's low-value or actively counterproductive?

### 2. Prompt engineering quality
- Examine `FLASH_CARD_RULES`, `COMPOSITION_EXTRACTION_RULES`, `CORRECTION_PROMPT_DAILY`, `CORRECTION_PROMPT_ARTICLE`, and `CORRECTION_PROMPT_REPRODUCTION` in flashcard-review.js.
- Are the grading rubrics well-calibrated? Too harsh? Too lenient? Missing dimensions?
- Are the flashcard construction rules producing cards that actually test the right things for C2 acquisition?
- Is the extraction logic (what to pull from corrections, what to skip) well-targeted?
- The distinction between "mechanical errors" (slips) and "substantive errors" (L1 transfer, anglicisms, register mismatches) — is this cleanly drawn?

### 3. Prose reproduction exercise design
- The new reproduction exercise: read article → start reproduction → English wiped → lock paragraphs one at a time → reproduce Italian from memory → graded on semantic fidelity, collocational nativeness, information structure/rhythm, register alignment (each 0-5, scaled to 100).
- Is this rubric well-designed? Would you change the dimensions or weights?
- Is 4 paragraphs the right amount?
- Does the "lock one at a time" flow make sense, or would a different interaction pattern work better?

### 4. System gaps and failure modes
- Where might the system silently fail to help? (e.g., reinforcing errors, testing recognition instead of production, missing important competence areas)
- Are there scenarios where the Claude prompts would produce unhelpful or misleading output?
- Is the spaced repetition implementation (SM-2 in anki.js) sound, or are there known issues with the algorithm as implemented?

### 5. What would you add or change?
- If you could add one feature to this system, what would have the highest impact on B2→C2 progression?
- If you could remove or redesign one thing, what's the weakest link?

Be direct and specific. I don't need encouragement — I need structural critique. Point to specific code/prompts when making claims.