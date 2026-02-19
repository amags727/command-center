// ============ TRANSLATE TAB ============
let trArticleCards = [];
function renderTranslate() {
  const d = load();
  const history = d.readingHistory || [];
  const el = document.getElementById('tr-history');
  if (el) {
    el.innerHTML = history.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No articles read yet.</p>' :
      history.slice(-20).reverse().map(h => '<div class="lentry action"><span class="lt">' + h.date + '</span> ' + escHtml(h.title || 'Untitled') + (h.cardCount ? ' — <b>' + h.cardCount + ' cards</b>' : '') + '</div>').join('');
  }
}

async function trFetchURL() {
  const url = document.getElementById('tr-url').value.trim();
  if (!url) { alert('Paste a URL first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('tr-status');
  status.textContent = '⏳ Fetching article...';
  try {
    // Try multiple CORS proxies in order
    const proxies = [
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      'https://corsproxy.io/?' + encodeURIComponent(url),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
    ];
    let html = null;
    for (const proxyUrl of proxies) {
      try {
        status.textContent = '⏳ Fetching article...';
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (resp.ok) { html = await resp.text(); break; }
      } catch (e) { continue; }
    }
    if (!html) {
      status.textContent = '⚠️ Could not fetch URL (CORS blocked). Paste the article text below instead.';
      document.querySelector('#tab-translate details').open = true;
      return;
    }
    // Extract article text from HTML
    status.textContent = '⏳ Extracting article text...';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Remove scripts, styles, nav, footer, ads
    doc.querySelectorAll('script,style,nav,footer,header,aside,iframe,.ad,.ads,.sidebar,.menu,.nav,.cookie,.banner,figure,figcaption').forEach(el => el.remove());
    // Try common article selectors
    let articleEl = doc.querySelector('article') || doc.querySelector('[role="main"]') || doc.querySelector('.post-content') || doc.querySelector('.article-body') || doc.querySelector('.entry-content') || doc.querySelector('.story-body') || doc.querySelector('main');
    let text = '';
    if (articleEl) {
      // Get paragraphs from article element
      const paras = articleEl.querySelectorAll('p, h1, h2, h3, blockquote');
      text = Array.from(paras).map(p => p.textContent.trim()).filter(t => t.length > 20).join('\n\n');
    }
    if (!text || text.length < 100) {
      // Fallback: get all paragraphs from body
      const allParas = doc.querySelectorAll('p');
      text = Array.from(allParas).map(p => p.textContent.trim()).filter(t => t.length > 30).join('\n\n');
    }
    if (!text || text.length < 50) {
      status.textContent = '⚠️ Could not extract article text. Paste it manually below.';
      document.querySelector('#tab-translate details').open = true;
      return;
    }
    // Try to get title
    const titleEl = doc.querySelector('h1') || doc.querySelector('title');
    const title = titleEl ? titleEl.textContent.trim() : '';
    status.textContent = '✅ Fetched! ' + text.split(/\s+/).length + ' words extracted. Sending to Claude...';
    // Put text in the raw textarea for reference
    document.getElementById('tr-raw').value = text;
    // Now translate it
    await trTranslateText(text, title);
  } catch (e) {
    status.textContent = '❌ Fetch error: ' + e.message + '. Try pasting the text below.';
    document.querySelector('#tab-translate details').open = true;
  }
}

async function trTranslateRaw() {
  const raw = document.getElementById('tr-raw').value.trim();
  if (!raw || raw.length < 50) { alert('Paste at least a paragraph of Italian text.'); return; }
  await trTranslateText(raw);
}

async function trTranslateText(raw, fetchedTitle) {
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('tr-status');
  status.textContent = '⏳ Translating with Claude... (this may take a moment)';
  try {
    // Split into paragraphs and number them for strict alignment
    const srcParas = raw.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
    const numbered = srcParas.map((p, i) => `[${i + 1}] ${p}`).join('\n\n');

    const prompt = `You are a professional Italian-English translator. Translate the following Italian text paragraph by paragraph.

CRITICAL RULES:
- The text has ${srcParas.length} numbered paragraphs [1] through [${srcParas.length}].
- You MUST return EXACTLY ${srcParas.length} paragraph objects in your response — one per numbered paragraph.
- Each paragraph object has "it" (the original Italian), "en" (English translation), and "repro" (boolean).
- Do NOT merge, split, skip, or reorder paragraphs. Paragraph [1] → index 0, [2] → index 1, etc.
- Preserve the original text in the "it" field (without the [N] number prefix).
- Set "repro": true on 2-5 paragraphs that are most valuable for a prose reproduction exercise, targeting 350-600 total words of reproduction material. Choose paragraphs with: complex subordination, interesting register choices, idiomatic density, or native Italian syntax patterns that an English speaker would struggle to reproduce. Skip trivial/short paragraphs. Fewer paragraphs if they are long, more if they are short.

Also include a "title" field if you can infer the article title, and a "difficulty" field (A2/B1/B2/C1/C2).

Return ONLY valid JSON:
{"title": "...", "difficulty": "...", "paragraphs": [{"it": "...", "en": "...", "repro": false}, ...]}

Numbered Italian text:
${numbered}`;

    const resp = await callClaude(key, prompt, 8192);
    // Try to parse JSON from response
    let data;
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      data = JSON.parse(jsonMatch ? jsonMatch[0] : resp);
      // Validate alignment: if counts don't match, log warning but don't crash
      if (data.paragraphs && data.paragraphs.length !== srcParas.length) {
        console.warn('Paragraph count mismatch: source=' + srcParas.length + ' translated=' + data.paragraphs.length);
        // Pad or trim to match source count
        while (data.paragraphs.length < srcParas.length) {
          const idx = data.paragraphs.length;
          data.paragraphs.push({ it: srcParas[idx], en: '(translation missing)' });
        }
        if (data.paragraphs.length > srcParas.length) {
          data.paragraphs = data.paragraphs.slice(0, srcParas.length);
        }
      }
    } catch {
      // Fallback: treat as plain text, split by double newlines
      data = { title: 'Untitled Article', difficulty: '?', paragraphs: srcParas.map(p => ({ it: p, en: '(translation pending)' })) };
      // Try a simpler translation request
      status.textContent = '⏳ Retrying with simpler format...';
      const resp2 = await callClaude(key, 'Translate each paragraph from Italian to English. Return one English paragraph per line, separated by |||.\n\n' + srcParas.map(p => p).join('\n\n'));
      const translations = resp2.split('|||').map(t => t.trim());
      data.paragraphs = srcParas.map((p, i) => ({ it: p, en: translations[i] || '...' }));
    }

    // Render the result
    document.getElementById('tr-title').textContent = data.title || 'Article';
    const reproCount = data.paragraphs.filter(p => p.repro).length;
    document.getElementById('tr-meta').textContent = 'Difficulty: ' + (data.difficulty || '?') + ' | ' + data.paragraphs.length + ' paragraphs' + (reproCount ? ' | ' + reproCount + ' marked for reproduction' : '');
    const tbody = document.getElementById('tr-tbody');
    tbody.innerHTML = data.paragraphs.map((p, i) =>
      '<tr data-idx="' + i + '"' + (p.repro ? ' data-repro="1"' : '') + '><td class="it-col">' + escHtml(p.it) + '</td><td class="en-col">' + escHtml(p.en) + '</td></tr>'
    ).join('');
    document.getElementById('tr-result-card').style.display = 'block';
    document.getElementById('tr-reflection-card').style.display = 'block';
    // Show summary card
    const summaryCard = document.getElementById('tr-summary-card');
    if (summaryCard) summaryCard.style.display = 'block';
    // Show reproduction card if repro paragraphs exist (legacy, hidden in new HTML but kept for compat)
    const reproCard = document.getElementById('tr-repro-card');
    if (reproCard) reproCard.style.display = reproCount > 0 ? 'block' : 'none';
    trArticleCards = [];
    trCollectedWords = [];
    // Store paragraph data for reproduction
    _trParagraphs = data.paragraphs;
    _trReproState = 'idle'; // idle | active | submitted
    _trReproductions = {};
    const reproStatus = document.getElementById('tr-repro-status');
    if (reproStatus) reproStatus.textContent = '';
    const reproResultEl = document.getElementById('tr-repro-result');
    if (reproResultEl) reproResultEl.style.display = 'none';
    const reproReviewEl = document.getElementById('tr-repro-card-review');
    if (reproReviewEl) reproReviewEl.style.display = 'none';
    const collCard = document.getElementById('tr-collected-card');
    if (collCard) collCard.style.display = 'none';
    status.textContent = '✅ Translation complete! Highlight Italian words to collect them for flashcards.';
    // Store current article data for logging
    CAL._currentArticle = { title: data.title, difficulty: data.difficulty, text: raw.slice(0, 200) };
    // Bind text selection for card creation
    trBindSelection();
    addLog('action', 'Translated article: ' + (data.title || 'Untitled'));
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

let trCollectedWords = [];

function trBindSelection() {
  const tbody = document.getElementById('tr-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('.it-col').forEach(td => {
    td.addEventListener('mouseup', trHandleSelection);
    td.addEventListener('touchend', trHandleSelection);
  });
}

function trHandleSelection(e) {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text || text.length < 2 || text.length > 100) return;
  // Add to collected words (no popup — just collect)
  if (trCollectedWords.some(w => w.toLowerCase() === text.toLowerCase())) return; // skip dupes
  trCollectedWords.push(text);
  trRenderCollected();
  // Brief visual feedback
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.cssText = 'background:var(--ol);border-radius:2px;padding:0 2px;transition:background .5s';
  range.surroundContents(span);
  sel.removeAllRanges();
}

function trRenderCollected() {
  const card = document.getElementById('tr-collected-card');
  const list = document.getElementById('tr-collected-list');
  const ct = document.getElementById('tr-coll-ct');
  if (!card || !list) return;
  card.style.display = trCollectedWords.length > 0 ? 'block' : 'none';
  // Also show reflection card when words are collected
  // Reflection card visibility is now controlled when article loads, not by collected words
  ct.textContent = trCollectedWords.length;
  list.innerHTML = trCollectedWords.map((w, i) =>
    '<div class="tr-card-item"><span class="front" style="flex:1">' + escHtml(w) + '</span>' +
    '<button class="btn" style="font-size:11px;padding:2px 6px;color:var(--red);border-color:var(--red)" onclick="trRemoveWord(' + i + ')">✕</button></div>'
  ).join('');
}

function trRemoveWord(i) {
  trCollectedWords.splice(i, 1);
  trRenderCollected();
}

function trClearCollected() {
  if (trCollectedWords.length && !confirm('Clear all ' + trCollectedWords.length + ' collected words?')) return;
  trCollectedWords = [];
  trRenderCollected();
  document.getElementById('tr-created-cards').style.display = 'none';
}

async function trSubmitWords() {
  if (!trCollectedWords.length) { alert('Highlight some Italian words first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('tr-words-status');
  status.textContent = '⏳ Generating flashcards for ' + trCollectedWords.length + ' words...';
  try {
    const article = CAL._currentArticle || {};
    const articleContext = article.title ? 'Article: "' + article.title + '" (' + (article.difficulty || '?') + ')\n' : '';
    const prompt = `You are generating flashcards for an Italian language learner at C1-C2 level.\n\n${articleContext}The student highlighted these words/phrases while reading:\n${trCollectedWords.map(w => '- ' + w).join('\n')}\n\n${FLASH_CARD_RULES}\n\nFor each word/phrase, generate the paired definition card and cloze card following the rules above.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
    const resp = await callClaude(key, prompt);
    const cards = _parseCardsJSON(resp);
    if (cards.length > 0) {
      status.textContent = '✅ Generated ' + cards.length + ' cards. Review below.';
      renderFlashcardReview('tr-words-card-review', cards, articleContext + 'Collected words: ' + trCollectedWords.join(', '), 'reading');
    } else {
      status.textContent = '⚠️ No cards parsed. Try again.';
    }
    addLog('action', 'Generated ' + cards.length + ' cards from ' + trCollectedWords.length + ' collected words');
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

function trUpdReflWC() {
  const txt = document.getElementById('tr-refl-txt').value;
  const wc = txt.trim().split(/\s+/).filter(w => w).length;
  const el = document.getElementById('tr-refl-wc');
  el.textContent = wc + ' / 100 words';
  el.className = 'wc' + (wc < 100 ? ' bad' : '');
}

function trUpdSummaryWC() {
  const txt = document.getElementById('tr-summary-txt').value;
  const wc = txt.trim().split(/\s+/).filter(w => w).length;
  const el = document.getElementById('tr-summary-wc');
  el.textContent = wc + ' / 100 words';
  el.className = 'wc' + (wc < 100 ? ' bad' : '');
}

function trUpdateSubmitBtn() {
  // No-op — buttons are now fixed to Article 1 and Article 2
}

// ============ MODE TOGGLE ============
function trSwitchMode(mode) {
  const artBtn = document.getElementById('tr-mode-article');
  const bkBtn = document.getElementById('tr-mode-book');
  const artDiv = document.getElementById('tr-article-mode');
  const bkDiv = document.getElementById('tr-book-mode');
  if (mode === 'book') {
    artBtn.style.background = 'var(--card)'; artBtn.style.color = 'var(--muted)';
    bkBtn.style.background = 'var(--blue)'; bkBtn.style.color = '#fff';
    artDiv.style.display = 'none'; bkDiv.style.display = 'block';
  } else {
    bkBtn.style.background = 'var(--card)'; bkBtn.style.color = 'var(--muted)';
    artBtn.style.background = 'var(--blue)'; artBtn.style.color = '#fff';
    bkDiv.style.display = 'none'; artDiv.style.display = 'block';
  }
}


// ============ ARTICLE REFLECTION (unchanged below) ============
async function trSubmitReflection(num) {
  const txt = document.getElementById('tr-refl-txt').value.trim();
  const wc = txt ? txt.split(/\s+/).filter(w => w).length : 0;
  if (wc < 100) { alert('Write at least 100 words in Italian.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const article = CAL._currentArticle || {};
  const title = article.title || document.getElementById('tr-title').textContent || 'Untitled';
  const status = document.getElementById('tr-refl-status');
  status.textContent = '⏳ Sending reflection to Claude for feedback + flashcard generation...';
  try {
    const feedbackPrompt = CORRECTION_PROMPT_ARTICLE(title, txt);
    const feedbackResp = await callClaude(key, feedbackPrompt);
    // Parse and save score + update interference profile
    const scoreData = _parseReflectionScore(feedbackResp);
    const intPatterns = _parseInterferencePatterns(feedbackResp);
    _updateInterferenceProfile(intPatterns);
    document.getElementById('tr-refl-result').style.display = 'block';
    document.getElementById('tr-refl-feedback').innerHTML = feedbackResp.replace(/\n/g, '<br>');
    // Log as article on Today tab
    const titleEl = document.getElementById('art' + num + '-t');
    const thoughtsEl = document.getElementById('art' + num + '-th');
    if (titleEl) titleEl.value = title + (article.difficulty ? ' [' + article.difficulty + ']' : '');
    if (thoughtsEl) thoughtsEl.value = txt;
    const chk = document.getElementById('h-art' + num);
    if (chk) chk.checked = true;
    const st = document.getElementById('art' + num + '-status');
    if (st) st.textContent = '✅ ' + title;
    const d = load();
    if (!d.readingHistory) d.readingHistory = [];
    d.readingHistory.push({ date: today(), title, difficulty: article.difficulty, cardCount: 0, reflectionWords: wc, score: scoreData });
    save(d);
    // Also persist article habit to day data so Today tab checkmark survives reload
    const dd2 = dayData(today());
    const dayObj = dd2.days[today()];
    const artKey = 'art' + num;
    dayObj.habits[artKey] = true;
    dayObj.habits[artKey + 'Title'] = title + (article.difficulty ? ' [' + article.difficulty + ']' : '');
    dayObj.habits[artKey + 'Thoughts'] = txt;
    save(dd2);
    // Now generate flashcards from the reflection corrections
    const cardPrompt = `You are generating flashcards from a corrected Italian reflection on an article.\n\nArticle: "${title}"\nStudent reflection:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections and the student's text, generate 5-8 flashcard items following the extraction and card construction rules. For each item, generate the paired definition card and cloze card.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields.\n[{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('tr-refl-card-review', cards, 'Article: ' + title + '\nReflection:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'reading');
    }
    status.textContent = '✅ Feedback + ' + cards.length + ' cards generated. Logged as Article ' + num + '.';
    addLog('action', 'Article ' + num + ' reflection: ' + title + ' + ' + cards.length + ' cards');
    trUpdateSubmitBtn();
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

// ============ ARTICLE SUMMARY (Article 2) ============
async function trSubmitSummary() {
  const txt = document.getElementById('tr-summary-txt').value.trim();
  const wc = txt ? txt.split(/\s+/).filter(w => w).length : 0;
  if (wc < 100) { alert('Write at least 100 words in Italian.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const article = CAL._currentArticle || {};
  const title = article.title || document.getElementById('tr-title').textContent || 'Untitled';
  const status = document.getElementById('tr-summary-status');
  status.textContent = '⏳ Sending summary to Claude for feedback + flashcard generation...';
  try {
    // Build a summary-specific correction prompt
    const feedbackPrompt = `Sei un tutor esperto di italiano a livello C1-C2. Lo studente ha letto un articolo intitolato "${title}" e ne ha scritto un riassunto in italiano, cercando di mantenere lo stesso registro, stile e livello di prosa dell'originale.

Riassunto dello studente:
"${txt}"${_getTopInterferenceContext()}

Istruzioni — segui questo formato ESATTAMENTE:

1. TESTO CORRETTO
Riscrivi COMPLETAMENTE il riassunto corretto. Correggi TUTTI gli errori. Presta particolare attenzione alla COERENZA DI REGISTRO: se l'articolo originale usa un linguaggio giornalistico formale, il riassunto deve mantenerlo. Se usa gergo parlamentare, tecnico, accademico ecc., il riassunto deve riflettere lo stesso livello.

2. ERRORI MECCANICI
Sviste di genere/numero/concordanza. Una riga per errore: originale → corretto.

3. ERRORI SOSTANZIALI
Per ogni errore di vocabolario, costruzione, anglicismo, registro inadeguato, scelta stilistica che tradisce il registro dell'originale: originale → corretto + spiegazione IN ITALIANO. Segnala in particolare dove lo studente ha abbassato il registro rispetto all'originale o ha usato costruzioni troppo semplici/anglofone dove l'originale avrebbe usato una struttura più elaborata.

4. VALUTAZIONE DEL REGISTRO
Valuta specificamente se lo studente ha mantenuto:
- Il livello di formalità dell'originale
- Il gergo/lessico specialistico appropriato
- I tempi verbali coerenti con il genere (passato remoto per narrativa giornalistica, ecc.)
- La complessità sintattica adeguata

5. PUNTEGGIO
SCORE: XX/100 (LIVELLO)

Fasce: 90-100 (C2), 80-89 (C1+), 70-79 (C1/B2+), 60-69 (B2), sotto 60 (B1 o meno).

6. PATTERN DI INTERFERENZA
INTERFERENCE: pattern1 | pattern2 | pattern3

Sii diretto e fattuale. Niente incoraggiamenti.`;

    const feedbackResp = await callClaude(key, feedbackPrompt);
    const scoreData = _parseReflectionScore(feedbackResp);
    const intPatterns = _parseInterferencePatterns(feedbackResp);
    _updateInterferenceProfile(intPatterns);
    document.getElementById('tr-summary-result').style.display = 'block';
    document.getElementById('tr-summary-feedback').innerHTML = feedbackResp.replace(/\n/g, '<br>');
    // Log as Article 2
    const num = 2;
    const titleEl = document.getElementById('art' + num + '-t');
    const thoughtsEl = document.getElementById('art' + num + '-th');
    if (titleEl) titleEl.value = title + ' [Summary]' + (article.difficulty ? ' [' + article.difficulty + ']' : '');
    if (thoughtsEl) thoughtsEl.value = txt;
    const chk = document.getElementById('h-art' + num);
    if (chk) chk.checked = true;
    const st = document.getElementById('art' + num + '-status');
    if (st) st.textContent = '✅ ' + title + ' [Summary]';
    const d = load();
    if (!d.readingHistory) d.readingHistory = [];
    d.readingHistory.push({ date: today(), title, difficulty: article.difficulty, type: 'summary', summaryWords: wc, score: scoreData });
    save(d);
    const dd2 = dayData(today());
    const dayObj = dd2.days[today()];
    dayObj.habits['art' + num] = true;
    dayObj.habits['art' + num + 'Title'] = title + ' [Summary]';
    dayObj.habits['art' + num + 'Thoughts'] = txt;
    save(dd2);
    // Generate flashcards
    const cardPrompt = `You are generating flashcards from a corrected Italian article summary.\n\nArticle: "${title}"\nStudent summary:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections and the student's text, generate 5-8 flashcard items following the extraction and card construction rules. For each item, generate the paired definition card and cloze card.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields.\n[{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('tr-summary-card-review', cards, 'Article: ' + title + '\nSummary:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'summary');
    }
    status.textContent = '✅ Feedback + ' + cards.length + ' cards generated. Logged as Article 2 [Summary].';
    addLog('action', 'Article 2 summary: ' + title + ' + ' + cards.length + ' cards');
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

// ============ PROSE REPRODUCTION EXERCISE ============
let _trParagraphs = []; // [{it, en, repro}, ...]
let _trReproState = 'idle'; // idle | active | submitted
let _trReproductions = {}; // {idx: 'text typed by user'}

function trStartRepro() {
  if (!_trParagraphs.length) { alert('Translate an article first.'); return; }
  _trReproState = 'active';
  _trReproductions = {};
  const tbody = document.getElementById('tr-tbody');
  // Wipe ALL English columns immediately
  tbody.querySelectorAll('.en-col').forEach(td => { td.textContent = ''; td.style.color = 'var(--muted)'; });
  // For repro paragraphs: add lock button, for non-repro: leave Italian visible
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(tr => {
    const idx = parseInt(tr.dataset.idx);
    const isRepro = tr.dataset.repro === '1';
    const itCol = tr.querySelector('.it-col');
    if (isRepro) {
      // Add lock button overlay
      const origText = itCol.textContent;
      itCol.innerHTML = '<div style="position:relative">' +
        '<div class="repro-orig" style="font-size:13px;line-height:1.5">' + escHtml(origText) + '</div>' +
        '<button class="btn btn-s repro-lock-btn" onclick="trLockPara(' + idx + ')" style="margin-top:6px;font-size:11px">🔒 Lock & Reproduce</button>' +
        '</div>';
    }
  });
  // Update UI
  document.getElementById('tr-repro-start-btn').style.display = 'none';
  document.getElementById('tr-repro-progress').style.display = 'block';
  trUpdateReproProgress();
}

function trLockPara(idx) {
  const tbody = document.getElementById('tr-tbody');
  const row = tbody.querySelector('tr[data-idx="' + idx + '"]');
  if (!row) return;
  const itCol = row.querySelector('.it-col');
  // Replace with textarea
  itCol.innerHTML = '<textarea class="fin repro-textarea" id="repro-ta-' + idx + '" ' +
    'style="width:100%;min-height:80px;font-size:13px;resize:vertical" ' +
    'placeholder="Reproduce this paragraph from memory..." ' +
    'oninput="trReproInput(' + idx + ')"></textarea>';
  // Focus the textarea
  document.getElementById('repro-ta-' + idx).focus();
  trUpdateReproProgress();
}

function trReproInput(idx) {
  const ta = document.getElementById('repro-ta-' + idx);
  if (ta) _trReproductions[idx] = ta.value;
  trUpdateReproProgress();
}

function trUpdateReproProgress() {
  const reproIdxs = _trParagraphs.map((p, i) => p.repro ? i : -1).filter(i => i >= 0);
  const total = reproIdxs.length;
  const done = reproIdxs.filter(i => (_trReproductions[i] || '').trim().length > 10).length;
  const el = document.getElementById('tr-repro-progress');
  if (el) el.innerHTML = '<span style="font-size:13px">' + done + ' / ' + total + ' paragraphs completed</span>' +
    (done === total ? ' <button class="btn btn-p" onclick="trSubmitRepro()" style="margin-left:10px">✅ Submit Reproduction</button>' : '');
}

async function trSubmitRepro() {
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const reproIdxs = _trParagraphs.map((p, i) => p.repro ? i : -1).filter(i => i >= 0);
  const paragraphs = reproIdxs.map(i => ({
    original: _trParagraphs[i].it,
    reproduction: (_trReproductions[i] || '').trim()
  }));
  if (paragraphs.some(p => !p.reproduction)) { alert('Complete all reproduction paragraphs first.'); return; }
  const article = CAL._currentArticle || {};
  const title = article.title || document.getElementById('tr-title').textContent || 'Untitled';
  const status = document.getElementById('tr-repro-status');
  status.textContent = '⏳ Sending reproductions to Claude for evaluation...';
  _trReproState = 'submitted';
  try {
    const feedbackPrompt = CORRECTION_PROMPT_REPRODUCTION(paragraphs);
    const feedbackResp = await callClaude(key, feedbackPrompt, 8192);
    const scoreData = _parseReflectionScore(feedbackResp);
    const dimData = _parseReproDimensions(feedbackResp);
    if (dimData) scoreData.dimensions = dimData;
    // Update interference profile from reproduction patterns section
    const reproIntPatterns = _parseInterferencePatterns(feedbackResp);
    _updateInterferenceProfile(reproIntPatterns);
    // Show feedback
    document.getElementById('tr-repro-result').style.display = 'block';
    document.getElementById('tr-repro-feedback').innerHTML = feedbackResp.replace(/\n/g, '<br>');
    // Show side-by-side comparison (unhide originals)
    const tbody = document.getElementById('tr-tbody');
    reproIdxs.forEach(i => {
      const row = tbody.querySelector('tr[data-idx="' + i + '"]');
      if (!row) return;
      const itCol = row.querySelector('.it-col');
      const userText = (_trReproductions[i] || '').trim();
      itCol.innerHTML = '<div style="margin-bottom:6px"><b style="font-size:11px;color:var(--green)">Original:</b><div style="font-size:13px;background:#f0fdf4;padding:6px;border-radius:4px;border:1px solid #bbf7d0">' + escHtml(_trParagraphs[i].it) + '</div></div>' +
        '<div><b style="font-size:11px;color:var(--blue)">Your reproduction:</b><div style="font-size:13px;background:#eff6ff;padding:6px;border-radius:4px;border:1px solid #bfdbfe">' + escHtml(userText) + '</div></div>';
    });
    // Log as Article 2
    const num = 2;
    const titleEl = document.getElementById('art' + num + '-t');
    const thoughtsEl = document.getElementById('art' + num + '-th');
    if (titleEl) titleEl.value = title + ' [Reproduction]' + (article.difficulty ? ' [' + article.difficulty + ']' : '');
    if (thoughtsEl) thoughtsEl.value = paragraphs.map(p => p.reproduction).join('\n\n');
    const chk = document.getElementById('h-art' + num);
    if (chk) chk.checked = true;
    const st = document.getElementById('art' + num + '-status');
    if (st) st.textContent = '✅ ' + title + ' [Reproduction]';
    // Save to readingHistory with type: reproduction
    const d = load();
    if (!d.readingHistory) d.readingHistory = [];
    d.readingHistory.push({ date: today(), title, difficulty: article.difficulty, type: 'reproduction', score: scoreData });
    save(d);
    // Persist habit
    const dd2 = dayData(today());
    const dayObj = dd2.days[today()];
    dayObj.habits['art' + num] = true;
    dayObj.habits['art' + num + 'Title'] = title + ' [Reproduction]';
    dayObj.habits['art' + num + 'Thoughts'] = paragraphs.map(p => p.reproduction).join('\n\n');
    save(dd2);
    // Generate flashcards from reproduction errors
    const cardPrompt = `You are generating flashcards from a prose reproduction exercise.\n\nThe student read an Italian article and attempted to reproduce key paragraphs from memory.\n\nClaude's evaluation:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the errors and interference patterns identified above, generate 5-8 flashcard items following the extraction and card construction rules. Focus on constructions where the student's reproduction diverged from native Italian patterns.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields.\n[{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('tr-repro-card-review', cards, 'Reproduction exercise: ' + title + '\n\nEvaluation:\n' + feedbackResp, 'reproduction');
    }
    status.textContent = '✅ Evaluation + ' + cards.length + ' cards generated. Logged as Article 2 [Reproduction].';
    addLog('action', 'Prose reproduction: ' + title + ' — Score: ' + (scoreData.score || '?') + '/100 + ' + cards.length + ' cards');
    trUpdateSubmitBtn();
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

