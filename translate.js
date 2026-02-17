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
- Each paragraph object has "it" (the original Italian) and "en" (English translation).
- Do NOT merge, split, skip, or reorder paragraphs. Paragraph [1] → index 0, [2] → index 1, etc.
- Preserve the original text in the "it" field (without the [N] number prefix).

Also include a "title" field if you can infer the article title, and a "difficulty" field (A2/B1/B2/C1/C2).

Return ONLY valid JSON:
{"title": "...", "difficulty": "...", "paragraphs": [{"it": "...", "en": "..."}, ...]}

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
    document.getElementById('tr-meta').textContent = 'Difficulty: ' + (data.difficulty || '?') + ' | ' + data.paragraphs.length + ' paragraphs';
    const tbody = document.getElementById('tr-tbody');
    tbody.innerHTML = data.paragraphs.map(p =>
      '<tr><td class="it-col">' + escHtml(p.it) + '</td><td>' + escHtml(p.en) + '</td></tr>'
    ).join('');
    document.getElementById('tr-result-card').style.display = 'block';
    document.getElementById('tr-reflection-card').style.display = 'block';
    trArticleCards = [];
    trCollectedWords = [];
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
  const txt = document.getElementById('tr-refl-txt').value.trim();
  const wc = txt ? txt.split(/\s+/).filter(w => w).length : 0;
  const el = document.getElementById('tr-refl-wc');
  el.textContent = wc + ' / 50 words';
  el.className = 'wc' + (wc < 50 ? ' bad' : '');
}

function trGetNextArticleSlot() {
  const dd = dayData(today());
  const day = dd.days[today()];
  if (!day.habits || !day.habits.art1) return 1;
  return 2;
}

function trUpdateSubmitBtn() {
  const btn = document.getElementById('tr-refl-submit-btn');
  if (btn) btn.textContent = '✅ Submit as Article ' + trGetNextArticleSlot();
}

function trSubmitReflectionAuto() {
  trSubmitReflection(trGetNextArticleSlot());
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

// ============ BOOK MODE ============
let _bkDir = 'it2en'; // or 'en2it'
let _bkPages = []; // [{img: base64DataURL, status: 'pending'|'processing'|'ready'|'error', paragraphs: [{src,tgt},...]}]
let _bkCurrentPage = 0;
let _bkCollectedWords = [];
let _bkProcessingIdx = -1; // currently processing page index

function bkSetDir(dir) {
  _bkDir = dir;
  const it2en = document.getElementById('bk-dir-it2en');
  const en2it = document.getElementById('bk-dir-en2it');
  if (dir === 'it2en') {
    it2en.style.background = 'var(--blue)'; it2en.style.color = '#fff'; it2en.style.borderColor = 'var(--blue)';
    en2it.style.background = ''; en2it.style.color = ''; en2it.style.borderColor = '';
  } else {
    en2it.style.background = 'var(--blue)'; en2it.style.color = '#fff'; en2it.style.borderColor = 'var(--blue)';
    it2en.style.background = ''; it2en.style.color = ''; it2en.style.borderColor = '';
  }
  // Update table headers
  const thSrc = document.getElementById('bk-th-src');
  const thTgt = document.getElementById('bk-th-tgt');
  if (dir === 'it2en') {
    thSrc.textContent = '🇮🇹 Italiano'; thTgt.textContent = '🇬🇧 English';
  } else {
    thSrc.textContent = '🇬🇧 English'; thTgt.textContent = '🇮🇹 Italiano';
  }
}

async function _callClaudeVision(key, imageBase64, mediaType, textPrompt, maxTokens) {
  const base64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const mt = mediaType || (imageBase64.includes('image/png') ? 'image/png' : 'image/jpeg');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: maxTokens || 4096,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mt, data: base64 } },
        { type: 'text', text: textPrompt }
      ]}]
    })
  });
  if (!resp.ok) throw new Error('API error: ' + resp.status + ' ' + (await resp.text()));
  const data = await resp.json();
  return data.content[0].text;
}

function bkImagesSelected(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const status = document.getElementById('bk-upload-status');
  status.textContent = '⏳ Loading ' + files.length + ' image(s)...';
  let loaded = 0;
  const newPages = [];
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      newPages.push({ img: e.target.result, status: 'pending', paragraphs: [], originalIndex: i });
      loaded++;
      if (loaded === files.length) {
        // Sort by original file order
        newPages.sort((a, b) => a.originalIndex - b.originalIndex);
        _bkPages = _bkPages.concat(newPages);
        status.textContent = '✅ ' + files.length + ' page(s) added. Total: ' + _bkPages.length;
        input.value = '';
        bkRenderThumbs();
        // Start processing if not already running
        if (_bkProcessingIdx === -1) bkProcessNext();
      }
    };
    reader.readAsDataURL(file);
  });
}

function bkRenderThumbs() {
  const card = document.getElementById('bk-thumbs-card');
  const container = document.getElementById('bk-thumbs');
  const total = document.getElementById('bk-page-total');
  if (!_bkPages.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  total.textContent = _bkPages.length;
  container.innerHTML = _bkPages.map((p, i) => {
    const badge = p.status === 'ready' ? '✅' : p.status === 'processing' ? '🔄' : p.status === 'error' ? '❌' : '⏳';
    const border = i === _bkCurrentPage ? '3px solid var(--blue)' : '1px solid var(--border)';
    return '<div onclick="bkGoPage(' + i + ')" style="cursor:pointer;flex-shrink:0;text-align:center;width:60px">' +
      '<img src="' + p.img + '" style="width:56px;height:75px;object-fit:cover;border-radius:4px;border:' + border + '">' +
      '<div style="font-size:10px;margin-top:2px">' + badge + ' ' + (i + 1) + '</div></div>';
  }).join('');
  // Show reader card
  document.getElementById('bk-reader-card').style.display = 'block';
  bkRenderCurrentPage();
}

function bkGoPage(idx) {
  if (idx < 0 || idx >= _bkPages.length) return;
  _bkCurrentPage = idx;
  bkRenderThumbs();
}

function bkPrevPage() { bkGoPage(_bkCurrentPage - 1); }
function bkNextPage() { bkGoPage(_bkCurrentPage + 1); }

function bkRenderCurrentPage() {
  const page = _bkPages[_bkCurrentPage];
  if (!page) return;
  // Update label + nav buttons
  document.getElementById('bk-page-label').textContent = 'Page ' + (_bkCurrentPage + 1) + ' of ' + _bkPages.length;
  document.getElementById('bk-prev-btn').disabled = _bkCurrentPage === 0;
  document.getElementById('bk-next-btn').disabled = _bkCurrentPage >= _bkPages.length - 1;
  const statusEl = document.getElementById('bk-page-status');
  const tbody = document.getElementById('bk-tbody');
  if (page.status === 'ready' && page.paragraphs.length) {
    statusEl.textContent = '';
    tbody.innerHTML = page.paragraphs.map(p =>
      '<tr><td class="it-col">' + escHtml(p.src) + '</td><td>' + escHtml(p.tgt) + '</td></tr>'
    ).join('');
    bkBindSelection();
  } else if (page.status === 'processing') {
    statusEl.textContent = '🔄 Translating this page...';
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:40px;color:var(--muted)">Processing...</td></tr>';
  } else if (page.status === 'error') {
    statusEl.textContent = '❌ Error translating this page. Try clearing and re-uploading.';
    tbody.innerHTML = '';
  } else {
    statusEl.textContent = '⏳ Waiting in queue...';
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:40px;color:var(--muted)">Pending...</td></tr>';
  }
}

async function bkProcessNext() {
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); return; }
  // Find next pending page
  const idx = _bkPages.findIndex(p => p.status === 'pending');
  if (idx === -1) { _bkProcessingIdx = -1; return; }
  _bkProcessingIdx = idx;
  _bkPages[idx].status = 'processing';
  bkRenderThumbs();
  try {
    let prompt;
    if (_bkDir === 'it2en') {
      prompt = `Extract ALL text from this book page image. The text is in Italian. Then translate it paragraph by paragraph into English.

CRITICAL RULES:
- Extract every paragraph of text visible on the page.
- Return one object per paragraph with "src" (original Italian) and "tgt" (English translation).
- Do NOT merge or skip paragraphs. Maintain the original paragraph structure.
- Preserve paragraph order exactly as it appears on the page.

Return ONLY valid JSON:
{"paragraphs": [{"src": "...", "tgt": "..."}, ...]}`;
    } else {
      prompt = `Extract ALL text from this book page image. The text is in English. Then translate it paragraph by paragraph into idiomatic Italian.

CRITICAL RULES:
- Extract every paragraph of text visible on the page.
- Return one object per paragraph with "src" (original English) and "tgt" (Italian translation).
- The Italian translation should be unabridged — no content omitted, preserve tone and register.
- Prioritize natural Italian flow, collocations, and rhythm over mechanical loyalty to English syntax.
- Do NOT merge or skip paragraphs. Maintain the original paragraph structure.

Return ONLY valid JSON:
{"paragraphs": [{"src": "...", "tgt": "..."}, ...]}`;
    }

    const resp = await _callClaudeVision(key, _bkPages[idx].img, null, prompt, 8192);
    const jsonMatch = resp.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : resp);
    _bkPages[idx].paragraphs = data.paragraphs || [];
    _bkPages[idx].status = 'ready';
  } catch (e) {
    console.error('Book page translation error:', e);
    _bkPages[idx].status = 'error';
  }
  bkRenderThumbs();
  // Continue to next
  bkProcessNext();
}

function bkClearAll() {
  if (_bkPages.length && !confirm('Clear all ' + _bkPages.length + ' pages?')) return;
  _bkPages = [];
  _bkCurrentPage = 0;
  _bkProcessingIdx = -1;
  _bkCollectedWords = [];
  document.getElementById('bk-thumbs-card').style.display = 'none';
  document.getElementById('bk-reader-card').style.display = 'none';
  document.getElementById('bk-collected-card').style.display = 'none';
  document.getElementById('bk-upload-status').textContent = '';
}

// ---- Book mode word collection (reuses article mode pattern) ----
function bkBindSelection() {
  const tbody = document.getElementById('bk-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('.it-col').forEach(td => {
    td.addEventListener('mouseup', bkHandleSelection);
    td.addEventListener('touchend', bkHandleSelection);
  });
}

function bkHandleSelection() {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text || text.length < 2 || text.length > 100) return;
  if (_bkCollectedWords.some(w => w.toLowerCase() === text.toLowerCase())) return;
  _bkCollectedWords.push(text);
  bkRenderCollected();
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.cssText = 'background:var(--ol);border-radius:2px;padding:0 2px;transition:background .5s';
  range.surroundContents(span);
  sel.removeAllRanges();
}

function bkRenderCollected() {
  const card = document.getElementById('bk-collected-card');
  const list = document.getElementById('bk-collected-list');
  const ct = document.getElementById('bk-coll-ct');
  if (!card || !list) return;
  card.style.display = _bkCollectedWords.length > 0 ? 'block' : 'none';
  ct.textContent = _bkCollectedWords.length;
  list.innerHTML = _bkCollectedWords.map((w, i) =>
    '<div class="tr-card-item"><span class="front" style="flex:1">' + escHtml(w) + '</span>' +
    '<button class="btn" style="font-size:11px;padding:2px 6px;color:var(--red);border-color:var(--red)" onclick="bkRemoveWord(' + i + ')">✕</button></div>'
  ).join('');
}

function bkRemoveWord(i) { _bkCollectedWords.splice(i, 1); bkRenderCollected(); }

function bkClearCollected() {
  if (_bkCollectedWords.length && !confirm('Clear all ' + _bkCollectedWords.length + ' collected words?')) return;
  _bkCollectedWords = [];
  bkRenderCollected();
}

async function bkSubmitWords() {
  if (!_bkCollectedWords.length) { alert('Highlight some words first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('bk-words-status');
  status.textContent = '⏳ Generating flashcards for ' + _bkCollectedWords.length + ' words...';
  try {
    const srcLang = _bkDir === 'it2en' ? 'Italian' : 'English';
    const tgtLang = _bkDir === 'it2en' ? 'English' : 'Italian';
    const prompt = `You are generating flashcards for a language learner.\n\nThe student highlighted these ${srcLang} words/phrases while reading a book:\n${_bkCollectedWords.map(w => '- ' + w).join('\n')}\n\n${FLASH_CARD_RULES}\n\nFor each word/phrase, generate the paired definition card and cloze card following the rules above. Source language: ${srcLang}. Target language: ${tgtLang}.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields.\n[{"front":"...","back":"..."}]`;
    const resp = await callClaude(key, prompt);
    const cards = _parseCardsJSON(resp);
    if (cards.length > 0) {
      status.textContent = '✅ Generated ' + cards.length + ' cards. Review below.';
      renderFlashcardReview('bk-words-card-review', cards, 'Book words: ' + _bkCollectedWords.join(', '), 'reading');
    } else {
      status.textContent = '⚠️ No cards parsed. Try again.';
    }
    addLog('action', 'Generated ' + cards.length + ' cards from book (' + _bkCollectedWords.length + ' words)');
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

// ============ ARTICLE REFLECTION (unchanged below) ============
async function trSubmitReflection(num) {
  const txt = document.getElementById('tr-refl-txt').value.trim();
  const wc = txt ? txt.split(/\s+/).filter(w => w).length : 0;
  if (wc < 50) { alert('Write at least 50 words in Italian.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const article = CAL._currentArticle || {};
  const title = article.title || document.getElementById('tr-title').textContent || 'Untitled';
  const status = document.getElementById('tr-refl-status');
  status.textContent = '⏳ Sending reflection to Claude for feedback + flashcard generation...';
  try {
    const feedbackPrompt = CORRECTION_PROMPT_ARTICLE(title, txt);
    const feedbackResp = await callClaude(key, feedbackPrompt);
    // Parse and save score
    const scoreData = _parseReflectionScore(feedbackResp);
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

