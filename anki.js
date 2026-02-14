// ============ ANKI / CARDS MODULE ============
// ============ CARDS TAB (SM-2 Spaced Repetition) ============
function getCards() { const d = load(); if (!d.cards) d.cards = []; if (!d.cardSettings) d.cardSettings = { newPerDay: 20 }; return d; }
function todayDayNum() { return Math.floor(Date.now() / 86400000); }
function saveCardSettings() {
  const v = parseInt(document.getElementById('cards-new-limit').value) || 20;
  const d = getCards(); d.cardSettings = { newPerDay: Math.max(1, Math.min(200, v)) }; save(d);
  document.getElementById('cards-review-cap').textContent = v * 10;
  renderCards();
}
function getAnkiDailyTarget() {
  // Compute once at site open, cache for the day
  const key = 'anki_target_' + today();
  const cached = localStorage.getItem(key);
  if (cached !== null && parseInt(cached) > 0) return parseInt(cached);
  const d = getCards(), now = todayDayNum();
  const settings = d.cardSettings || { newPerDay: 20 };
  const dailyBonus = (settings.dailyBonusNew && settings.dailyBonusNew[today()]) || 0;
  const newLimit = settings.newPerDay + dailyBonus;
  const reviewCap = newLimit * 10;
  const dueReviews = d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1 && c.queue !== 0).length;
  const availableNew = Math.min(newLimit, d.cards.filter(c => c.queue === 0).length);
  // Cap to review cap — you can't study more than this in one day
  const target = Math.min(dueReviews + availableNew, reviewCap);
  if (d.cards.length > 0 && target > 0) localStorage.setItem(key, target);
  return target;
}

function updateAnkiHabitFromCards(totalReviewedToday) {
  // Auto-update the Anki habit based on cards studied today
  const dd = dayData(today());
  const day = dd.days[today()];
  const target = getAnkiDailyTarget();
  // Update the displayed count and target
  const ctEl = document.getElementById('anki-ct');
  if (ctEl) ctEl.textContent = totalReviewedToday;
  const tgtEl = document.getElementById('anki-target');
  if (tgtEl) tgtEl.textContent = target;
  // Auto-check/uncheck habit: done when all due cards are completed
  const chk = document.getElementById('h-anki');
  if (target > 0 && totalReviewedToday >= target) {
    if (chk) chk.checked = true;
    day.habits.anki = true;
    day.habits.ankiCount = totalReviewedToday;
  } else {
    if (chk) chk.checked = false;
    day.habits.anki = false;
    day.habits.ankiCount = totalReviewedToday;
  }
  save(dd);
}

function getNewIntroducedToday() {
  // Count cards that were new (queue===0) and got their first review today
  const d = getCards();
  return d.cards.filter(c => c.queue !== 0 && c.firstReviewDate === today()).length;
}
function getTotalReviewedToday() {
  const d = getCards();
  return d.cards.filter(c => c.reviewedToday === today()).length;
}

function sm2(card, quality) {
  // SM-2 algorithm: quality 1=Again, 2=Hard, 3=Good, 4=Easy
  const c = Object.assign({}, card);
  c.reps = (c.reps || 0);
  c.lapses = (c.lapses || 0);
  c.ease = c.ease || 2500; // factor * 1000
  c.ivl = c.ivl || 0;
  c.reviewedToday = today();
  // Track when a new card gets its first review
  if (card.queue === 0 && !c.firstReviewDate) c.firstReviewDate = today();

  if (quality === 1) { // Again
    c.lapses++; c.reps = 0; c.ivl = 0; c.ease = Math.max(1300, c.ease - 200);
    c.due = todayDayNum(); // re-show today (end of queue)
    c.queue = 1; // learning
  } else if (quality === 2) { // Hard
    if (c.ivl === 0) { c.ivl = 1; } else { c.ivl = Math.max(1, Math.round(c.ivl * 1.2)); }
    c.ease = Math.max(1300, c.ease - 150);
    c.due = todayDayNum() + c.ivl; c.reps++; c.queue = 2;
  } else if (quality === 3) { // Good
    if (c.ivl === 0) { c.ivl = 1; } else if (c.ivl === 1) { c.ivl = 6; } else { c.ivl = Math.round(c.ivl * c.ease / 1000); }
    c.due = todayDayNum() + c.ivl; c.reps++; c.queue = 2;
  } else if (quality === 4) { // Easy
    if (c.ivl === 0) { c.ivl = 4; } else { c.ivl = Math.round(c.ivl * c.ease / 1000 * 1.3); }
    c.ease += 150; c.due = todayDayNum() + c.ivl; c.reps++; c.queue = 2;
  }
  return c;
}

function fmtIvl(days) {
  if (days === 0) return '<1d'; if (days === 1) return '1d';
  if (days < 30) return days + 'd'; if (days < 365) return Math.round(days / 30.4) + 'mo';
  return (days / 365).toFixed(1) + 'y';
}

function previewIvl(card, quality) { return fmtIvl(sm2(card, quality).ivl); }

let studyQueue = [], studyIdx = 0, studyFlipped = false, lastCardAction = null;

function getDueCards() {
  const d = getCards(), now = todayDayNum();
  return d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1);
}
function getNewCards() { const d = getCards(); return d.cards.filter(c => c.queue === 0); }

function renderCards() {
  const d = getCards(), now = todayDayNum();
  // Auto-seed on first visit if deck is empty
  // BUT skip if sync is configured and initial pull hasn't finished yet
  if (d.cards.length === 0 && !renderCards._seeding) {
    const syncConfigured = !!localStorage.getItem('sync_passphrase');
    const pullDone = typeof FirebaseSync !== 'undefined' && FirebaseSync.isInitialPullDone ? FirebaseSync.isInitialPullDone() : true;
    if (syncConfigured && !pullDone) {
      // Sync not ready yet — show waiting message, don't auto-seed
      const el = document.getElementById('cards-limit-status');
      if (el) { el.innerHTML = '🟡 Waiting for sync...'; el.style.color = 'var(--yellow)'; }
      return;
    }
    renderCards._seeding = true;
    seedAnkiDeckAuto();
    return;
  }
  const settings = d.cardSettings || { newPerDay: 20 };
  const dailyBonus = (settings.dailyBonusNew && settings.dailyBonusNew[today()]) || 0;
  const newLimit = settings.newPerDay + dailyBonus;
  const reviewCap = newLimit * 10;

  // Load setting into UI
  document.getElementById('cards-new-limit').value = settings.newPerDay;
  document.getElementById('cards-review-cap').textContent = reviewCap;

  const dueReviews = d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1 && c.queue !== 0);
  const allNew = d.cards.filter(c => c.queue === 0);
  const newIntroducedToday = getNewIntroducedToday();
  const totalReviewedToday = getTotalReviewedToday();
  const newRemaining = Math.max(0, newLimit - newIntroducedToday);
  const reviewRemaining = Math.max(0, reviewCap - totalReviewedToday);

  // What's actually available this session
  const availableReviews = dueReviews.slice(0, reviewRemaining);
  const availableNew = allNew.slice(0, Math.min(newRemaining, Math.max(0, reviewRemaining - availableReviews.length)));
  const totalAvailable = availableReviews.length + availableNew.length;

  const learningCards = d.cards.filter(c => c.queue === 1 && (c.due || 0) <= now);
  document.getElementById('cards-new-remaining').textContent = Math.min(newRemaining, allNew.length);
  document.getElementById('cards-learning-ct').textContent = learningCards.length;
  document.getElementById('cards-review-remaining').textContent = availableReviews.length;

  // Count cards reviewed today
  document.getElementById('cards-reviewed-today').textContent = totalReviewedToday;

  // Limit status message
  const statusEl = document.getElementById('cards-limit-status');
  if (totalAvailable === 0 && (allNew.length > 0 || dueReviews.length > 0)) {
    if (totalReviewedToday >= reviewCap) {
      statusEl.innerHTML = '🎉 <b>Review cap reached!</b> Done for today.';
    } else if (newIntroducedToday >= newLimit && dueReviews.length === 0) {
      statusEl.innerHTML = '✅ All reviews done. New card limit reached (' + newLimit + '/' + newLimit + ').';
    }
    statusEl.style.color = 'var(--green)';
  } else if (totalAvailable === 0) {
    statusEl.innerHTML = '🎉 No cards due!';
    statusEl.style.color = 'var(--green)';
  } else {
    statusEl.innerHTML = '';
  }

  // Show "Add more" button whenever there are new cards available
  const addMoreBtn = document.getElementById('cards-add-more-btn');
  if (allNew.length > 0) {
    addMoreBtn.style.display = '';
    addMoreBtn.textContent = '➕ Add ' + Math.min(5, allNew.length) + ' more new cards';
  } else {
    addMoreBtn.style.display = 'none';
  }

  // Auto-update Anki habit based on cards studied today
  updateAnkiHabitFromCards(totalReviewedToday);

  renderCardBrowse();
}

async function seedAnkiDeckAuto() {
  const btn = document.getElementById('seed-anki-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Auto-importing...'; }
  try {
    const resp = await fetch('anki_cards.json');
    if (!resp.ok) throw new Error('Failed to fetch anki_cards.json: ' + resp.status);
    const imported = await resp.json();
    const d = getCards();
    const existingIds = new Set(d.cards.map(c => c.id));
    let added = 0;
    imported.forEach(c => { if (!existingIds.has(c.id)) { d.cards.push(c); added++; } });
    save(d);
    addLog('action', 'Auto-seeded ' + added + ' Anki cards');
  } catch (e) { console.error('Auto-seed failed:', e); }
  renderCards._seeding = false;
  if (btn) { btn.disabled = false; btn.textContent = '📦 Seed Anki Deck'; }
  renderCards();
}

function startStudy() {
  const d = getCards(), now = todayDayNum();
  const settings = d.cardSettings || { newPerDay: 20 };
  const dailyBonus = (settings.dailyBonusNew && settings.dailyBonusNew[today()]) || 0;
  const newLimit = settings.newPerDay + dailyBonus;
  const reviewCap = newLimit * 10;
  const newIntroducedToday = getNewIntroducedToday();
  const totalReviewedToday = getTotalReviewedToday();
  const reviewRemaining = Math.max(0, reviewCap - totalReviewedToday);

  if (reviewRemaining === 0) { alert('Review cap reached (' + reviewCap + ')! You\'re done for today. 🎉'); return; }

  // Due reviews first (respect review cap)
  const dueReviews = d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1 && c.queue !== 0);
  const newRemaining = Math.max(0, newLimit - newIntroducedToday);
  const newC = d.cards.filter(c => c.queue === 0).slice(0, newRemaining);

  // Cap total queue to remaining review budget
  let queue = [...dueReviews, ...newC];
  if (queue.length > reviewRemaining) queue = queue.slice(0, reviewRemaining);

  if (queue.length === 0) { alert('No cards due! 🎉'); return; }
  // Shuffle to avoid always starting from the same place
  for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
  studyQueue = queue;
  studyIdx = 0; studyFlipped = false; lastCardAction = null;
  document.getElementById('study-area').style.display = 'block';
  showStudyCard();
}

function addMoreCards() {
  const d = getCards();
  const settings = d.cardSettings || { newPerDay: 20 };
  const bump = 5;
  // Temporarily increase today's allowance by bumping the setting
  // We track via a daily override instead
  if (!d.cardSettings.dailyBonusNew) d.cardSettings.dailyBonusNew = {};
  const existing = d.cardSettings.dailyBonusNew[today()] || 0;
  d.cardSettings.dailyBonusNew[today()] = existing + bump;
  save(d);
  renderCards();
  addLog('action', 'Added ' + bump + ' bonus new cards for today');
}

function showStudyCard() {
  if (studyIdx >= studyQueue.length) { endStudy(); alert('Session complete! 🎉 Reviewed ' + studyQueue.length + ' cards.'); return; }
  const card = studyQueue[studyIdx];
  document.getElementById('study-front').innerHTML = escHtml(card.front);
  document.getElementById('study-back-content').innerHTML = escHtml(card.back);
  document.getElementById('study-back').style.display = 'none';
  document.getElementById('study-hint').style.display = '';
  const remaining = studyQueue.slice(studyIdx);
  const newLeft = remaining.filter(c => c.queue === 0).length;
  const learnLeft = remaining.filter(c => c.queue === 1).length;
  const revLeft = remaining.length - newLeft - learnLeft;
  document.getElementById('study-progress').innerHTML = '<span style="color:#3b82f6;font-weight:700">' + newLeft + '</span> + <span style="color:#ef4444;font-weight:700">' + learnLeft + '</span> + <span style="color:#22c55e;font-weight:700">' + revLeft + '</span>';
  document.getElementById('hard-ivl').textContent = previewIvl(card, 2);
  document.getElementById('good-ivl').textContent = previewIvl(card, 3);
  document.getElementById('easy-ivl').textContent = previewIvl(card, 4);
  studyFlipped = false;
}

function flipCard() {
  if (studyFlipped) return;
  studyFlipped = true;
  document.getElementById('study-back').style.display = 'block';
  document.getElementById('study-hint').style.display = 'none';
}

function rateCard(quality) {
  const d = getCards();
  const card = studyQueue[studyIdx];
  const idx = d.cards.findIndex(c => c.id === card.id);
  if (idx === -1) return;
  // Snapshot for undo
  lastCardAction = { cardId: card.id, cardBefore: JSON.parse(JSON.stringify(d.cards[idx])), studyIdxBefore: studyIdx, quality, queueLenBefore: studyQueue.length };
  const updated = sm2(d.cards[idx], quality);
  d.cards[idx] = updated;
  save(d);
  if (quality === 1) { // Again: re-queue at end
    studyQueue.push(updated);
  }
  studyIdx++;
  // Show undo button
  const undoBtn = document.getElementById('undo-card-btn');
  if (undoBtn) { undoBtn.style.opacity = '1'; undoBtn.style.pointerEvents = 'auto'; }
  // Live-update the reviewed-today counter
  const reviewedNow = getTotalReviewedToday();
  document.getElementById('cards-reviewed-today').textContent = reviewedNow;
  updateAnkiHabitFromCards(reviewedNow);
  showStudyCard();
}

function undoCardResponse() {
  if (!lastCardAction) return;
  const d = getCards();
  const idx = d.cards.findIndex(c => c.id === lastCardAction.cardId);
  if (idx === -1) { lastCardAction = null; return; }
  // Restore card state
  d.cards[idx] = lastCardAction.cardBefore;
  save(d);
  // If "Again" was pressed, it appended a copy — remove it
  if (lastCardAction.quality === 1 && studyQueue.length > lastCardAction.queueLenBefore) {
    studyQueue.pop();
  }
  // Restore study index
  studyIdx = lastCardAction.studyIdxBefore;
  // Update the queue entry too
  studyQueue[studyIdx] = lastCardAction.cardBefore;
  lastCardAction = null;
  // Hide undo button
  const undoBtn = document.getElementById('undo-card-btn');
  if (undoBtn) { undoBtn.style.opacity = '.35'; undoBtn.style.pointerEvents = 'none'; }
  // Update counters
  const reviewedNow = getTotalReviewedToday();
  document.getElementById('cards-reviewed-today').textContent = reviewedNow;
  updateAnkiHabitFromCards(reviewedNow);
  showStudyCard();
}

// Cmd+Z / Ctrl+Z undo listener
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    const studyArea = document.getElementById('study-area');
    if (studyArea && studyArea.style.display !== 'none' && lastCardAction) {
      e.preventDefault();
      undoCardResponse();
    }
  }
});

function endStudy() {
  document.getElementById('study-area').style.display = 'none';
  studyQueue = []; studyIdx = 0; lastCardAction = null;
  renderCards();
  addLog('action', 'Flashcard study session');
}

function addCard(front, back, tags) {
  const frontEl = document.getElementById('card-front');
  const backEl = document.getElementById('card-back');
  const tagsEl = document.getElementById('card-tags');
  front = front || (frontEl ? frontEl.value.trim() : '');
  back = back || (backEl ? backEl.value.trim() : '');
  tags = tags || (tagsEl ? tagsEl.value.trim() : '');
  if (!front || !back) return;
  const d = getCards();
  d.cards.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 8), front, back, tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [], queue: 0, due: todayDayNum(), ivl: 0, ease: 2500, reps: 0, lapses: 0, created: today(), reviewedToday: null });
  save(d);
  if (frontEl) frontEl.value = '';
  if (backEl) backEl.value = '';
  if (tagsEl) tagsEl.value = '';
  renderCards();
  addLog('action', 'Card added: ' + front);
}

function toggleBulkImport() { const el = document.getElementById('bulk-import'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function bulkImport() {
  const txt = document.getElementById('bulk-text').value.trim();
  if (!txt) return;
  let count = 0;
  // Try Front:/Back: pairs first
  const fbPairs = txt.match(/Front:\s*(.+?)[\n\r]+Back:\s*(.+?)(?=\nFront:|\n*$)/gs);
  if (fbPairs && fbPairs.length > 0) {
    fbPairs.forEach(pair => {
      const fm = pair.match(/Front:\s*(.+)/i);
      const bm = pair.match(/Back:\s*(.+)/i);
      if (fm && bm) { addCard(fm[1].trim(), bm[1].trim(), ''); count++; }
    });
  } else {
    // TSV: front\tback per line
    txt.split('\n').forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        addCard(parts[0].trim(), parts[1].trim(), ''); count++;
      }
    });
  }
  document.getElementById('bulk-text').value = '';
  if (count > 0) { alert('Imported ' + count + ' cards!'); renderCards(); }
  else { alert('No cards found. Use TSV (tab-separated) or Front:/Back: format.'); }
}

async function seedAnkiDeck() {
  const btn = document.getElementById('seed-anki-btn');
  if (!btn) return;
  // Two-click confirmation pattern (no confirm() dialog needed)
  if (!btn.dataset.ready) {
    btn.dataset.ready = '1';
    btn.textContent = '⚠️ Click again to import 3,663 cards';
    btn.style.background = '#e74c3c'; btn.style.color = '#fff';
    setTimeout(() => { delete btn.dataset.ready; btn.textContent = '📦 Seed Anki Deck'; btn.style.background = ''; btn.style.color = ''; }, 5000);
    return;
  }
  delete btn.dataset.ready;
  btn.disabled = true; btn.textContent = '⏳ Importing...'; btn.style.background = ''; btn.style.color = '';
  try {
    const resp = await fetch('anki_cards.json');
    if (!resp.ok) throw new Error('Failed to fetch anki_cards.json: ' + resp.status);
    const imported = await resp.json();
    const d = getCards();
    const existingIds = new Set(d.cards.map(c => c.id));
    let added = 0, skipped = 0;
    imported.forEach(c => {
      if (existingIds.has(c.id)) { skipped++; return; }
      d.cards.push(c); added++;
    });
    save(d);
    renderCards();
    alert('✅ Imported ' + added + ' cards! (' + skipped + ' duplicates skipped)\n\n📊 Due now: ' +
      d.cards.filter(c => (c.due || 0) <= todayDayNum() && c.queue === 2).length +
      ' | New: ' + d.cards.filter(c => c.queue === 0).length +
      ' | Total: ' + d.cards.length);
  } catch (e) {
    alert('❌ Import failed: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📦 Seed Anki Deck'; }
  }
}

// ============ ADD CARDS MODE SWITCHER ============
function showAddCardMode(mode) {
  ['manual', 'vocab', 'premade'].forEach(m => {
    const panel = document.getElementById('add-mode-' + m);
    const btn = document.getElementById('add-mode-' + m + '-btn');
    if (panel) panel.style.display = m === mode ? 'block' : 'none';
    if (btn) btn.style.background = m === mode ? 'var(--acc)' : '';
    if (btn) btn.style.color = m === mode ? '#fff' : '';
  });
}

// ============ VOCAB LIST → CLAUDE FLASHCARDS ============
let _csvData = null;

async function submitVocabList() {
  const txt = document.getElementById('vocab-list-text').value.trim();
  if (!txt) { alert('Enter some words or phrases first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const words = txt.split(/\n/).map(w => w.trim()).filter(w => w.length > 0);
  if (words.length === 0) { alert('No words found.'); return; }
  const status = document.getElementById('vocab-list-status');

  // Batch words into chunks of 10 to avoid token limit truncation
  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    batches.push(words.slice(i, i + BATCH_SIZE));
  }

  let allCards = [];
  let batchNum = 0;
  try {
    for (const batch of batches) {
      batchNum++;
      status.textContent = '⏳ Generating flashcards... batch ' + batchNum + '/' + batches.length + ' (' + allCards.length + ' cards so far)';
      const prompt = `You are generating flashcards for an Italian language learner at C1-C2 level.\n\nThe student wants flashcards for these words/phrases:\n${batch.map(w => '- ' + w).join('\n')}\n\n${FLASH_CARD_RULES}\n\nFor each word/phrase, generate the paired definition card and cloze card following the rules above.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. No markdown fences, no commentary — just the JSON array. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
      const resp = await callClaude(key, prompt, 8192);
      const cards = _parseCardsJSON(resp);
      allCards = allCards.concat(cards);
    }
    if (allCards.length > 0) {
      status.textContent = '✅ Generated ' + allCards.length + ' cards from ' + words.length + ' words. Review below.';
      renderFlashcardReview('vocab-list-card-review', allCards, 'Vocab list: ' + words.join(', '), 'vocab');
    } else {
      status.textContent = '⚠️ No cards parsed. Try again.';
    }
    addLog('action', 'Generated ' + allCards.length + ' cards from vocab list (' + words.length + ' words)');
  } catch (e) {
    if (allCards.length > 0) {
      status.textContent = '⚠️ Error on batch ' + batchNum + ', but got ' + allCards.length + ' cards from earlier batches. Review below.';
      renderFlashcardReview('vocab-list-card-review', allCards, 'Vocab list: ' + words.join(', '), 'vocab');
    } else {
      status.textContent = '❌ Error: ' + e.message;
    }
  }
}

// ============ CSV / TSV IMPORT ============
function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('csv-file-name').textContent = file.name;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    // Detect delimiter: tab, comma, or semicolon
    const firstLine = text.split('\n')[0] || '';
    let delim = ',';
    if (firstLine.includes('\t')) delim = '\t';
    else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delim = ';';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const rows = lines.map(l => {
      // Simple CSV parse (handles basic quoting)
      const result = [];
      let current = '', inQuotes = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (inQuotes) {
          if (ch === '"' && l[i+1] === '"') { current += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else current += ch;
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === delim) { result.push(current); current = ''; }
          else current += ch;
        }
      }
      result.push(current);
      return result;
    });
    if (rows.length === 0) { alert('File appears empty.'); return; }
    _csvData = { rows, hasHeader: false };
    // Guess if first row is a header (non-empty, text-like, different pattern)
    if (rows.length > 1) {
      const first = rows[0];
      const isHeader = first.every(c => c.length > 0 && c.length < 40 && !/\d{4}/.test(c));
      _csvData.hasHeader = isHeader;
    }
    // Populate column selectors
    const numCols = Math.max(...rows.map(r => r.length));
    const frontSel = document.getElementById('csv-front-col');
    const backSel = document.getElementById('csv-back-col');
    frontSel.innerHTML = '';
    backSel.innerHTML = '';
    for (let i = 0; i < numCols; i++) {
      const label = _csvData.hasHeader && rows[0][i] ? rows[0][i] : 'Column ' + (i + 1);
      frontSel.innerHTML += '<option value="' + i + '">' + escHtml(label) + '</option>';
      backSel.innerHTML += '<option value="' + i + '">' + escHtml(label) + '</option>';
    }
    frontSel.value = '0';
    backSel.value = numCols > 1 ? '1' : '0';
    document.getElementById('csv-preview').style.display = 'block';
    renderCSVPreview();
  };
  reader.readAsText(file);
}

function renderCSVPreview() {
  if (!_csvData) return;
  const frontCol = parseInt(document.getElementById('csv-front-col').value);
  const backCol = parseInt(document.getElementById('csv-back-col').value);
  const startRow = _csvData.hasHeader ? 1 : 0;
  const dataRows = _csvData.rows.slice(startRow);
  const preview = dataRows.slice(0, 10);
  const table = document.getElementById('csv-preview-table');
  let html = '<thead><tr><th style="font-size:11px">#</th><th style="font-size:11px">Front</th><th style="font-size:11px">Back</th></tr></thead><tbody>';
  preview.forEach((row, i) => {
    const f = (row[frontCol] || '').trim();
    const b = (row[backCol] || '').trim();
    html += '<tr><td style="font-size:11px;color:var(--muted)">' + (i + 1) + '</td><td style="font-size:12px">' + escHtml(f) + '</td><td style="font-size:12px">' + escHtml(b) + '</td></tr>';
  });
  if (dataRows.length > 10) html += '<tr><td colspan="3" style="font-size:11px;color:var(--muted);text-align:center">... and ' + (dataRows.length - 10) + ' more rows</td></tr>';
  html += '</tbody>';
  table.innerHTML = html;
  document.getElementById('csv-row-count').textContent = dataRows.length;
}

function importCSVCards() {
  if (!_csvData) { alert('No file loaded.'); return; }
  const frontCol = parseInt(document.getElementById('csv-front-col').value);
  const backCol = parseInt(document.getElementById('csv-back-col').value);
  const startRow = _csvData.hasHeader ? 1 : 0;
  const dataRows = _csvData.rows.slice(startRow);
  let count = 0;
  dataRows.forEach(row => {
    const f = (row[frontCol] || '').trim();
    const b = (row[backCol] || '').trim();
    if (f && b) { addCard(f, b, ''); count++; }
  });
  if (count > 0) {
    alert('✅ Imported ' + count + ' cards!');
    renderCards();
    // Reset
    _csvData = null;
    document.getElementById('csv-preview').style.display = 'none';
    document.getElementById('csv-file-name').textContent = '';
    document.getElementById('csv-file-input').value = '';
  } else {
    alert('No valid cards found. Check your column selection.');
  }
  addLog('action', 'CSV import: ' + count + ' cards');
}

function renderCardBrowse() {
  const d = getCards(), el = document.getElementById('card-browse');
  if (!el) return;
  const search = (document.getElementById('card-search') || {}).value || '';
  const filter = (document.getElementById('card-filter') || {}).value || 'all';
  const now = todayDayNum();
  let cards = d.cards;
  if (search) { const s = search.toLowerCase(); cards = cards.filter(c => c.front.toLowerCase().includes(s) || c.back.toLowerCase().includes(s)); }
  if (filter === 'new') cards = cards.filter(c => c.queue === 0);
  else if (filter === 'learning') cards = cards.filter(c => c.queue === 1);
  else if (filter === 'review') cards = cards.filter(c => c.queue === 2);
  else if (filter === 'due') cards = cards.filter(c => (c.due || 0) <= now);
  if (cards.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;font-style:italic">No cards match.</p>'; return; }
  el.innerHTML = cards.slice(0, 100).map(c => {
    const status = c.queue === 0 ? '<span class="label l-ital">New</span>' : c.queue === 1 ? '<span class="label l-gym">Learning</span>' : '<span class="label l-diss">Review</span>';
    const dueIn = (c.due || 0) - now;
    const dueStr = dueIn <= 0 ? '<span style="color:var(--red);font-weight:600">Due</span>' : fmtIvl(dueIn);
    return '<div class="iitem"><div class="itxt"><b>' + escHtml(c.front) + '</b><br><span style="font-size:12px;color:var(--muted)">' + escHtml(c.back) + '</span></div>' + status + '<span style="font-size:11px;color:var(--muted)">' + dueStr + '</span><button class="btn" style="font-size:10px;padding:2px 6px;color:var(--red)" onclick="deleteCard(\'' + c.id + '\')">✕</button></div>';
  }).join('');
}

function deleteCard(id) {
  if (!confirm('Delete this card?')) return;
  const d = getCards(); d.cards = d.cards.filter(c => c.id !== id); save(d); renderCardBrowse();
}

