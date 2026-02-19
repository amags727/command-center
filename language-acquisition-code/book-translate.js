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
