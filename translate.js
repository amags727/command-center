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
    const prompt = `You are a professional Italian-English translator. Translate the following Italian text paragraph by paragraph. 

Return ONLY a JSON array where each element is an object with "it" (Italian paragraph) and "en" (English translation). Keep paragraphs aligned. Preserve the original paragraph breaks.

Also include a "title" field at the top level if you can infer the article title, and a "difficulty" field (A2/B1/B2/C1/C2).

Return format:
{"title": "...", "difficulty": "...", "paragraphs": [{"it": "...", "en": "..."}, ...]}

Italian text:
${raw}`;

    const resp = await callClaude(key, prompt);
    // Try to parse JSON from response
    let data;
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      data = JSON.parse(jsonMatch ? jsonMatch[0] : resp);
    } catch {
      // Fallback: treat as plain text, split by double newlines
      const paras = raw.split(/\n\n+/).filter(p => p.trim());
      data = { title: 'Untitled Article', difficulty: '?', paragraphs: paras.map(p => ({ it: p.trim(), en: '(translation pending)' })) };
      // Try a simpler translation request
      status.textContent = '⏳ Retrying with simpler format...';
      const resp2 = await callClaude(key, 'Translate each paragraph from Italian to English. Return one English paragraph per line, separated by |||.\n\n' + paras.map(p => p.trim()).join('\n\n'));
      const translations = resp2.split('|||').map(t => t.trim());
      data.paragraphs = paras.map((p, i) => ({ it: p.trim(), en: translations[i] || '...' }));
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
    const feedbackPrompt = `Lo studente ha letto un articolo italiano intitolato "${title}" e ha scritto questa riflessione in italiano:\n\n"${txt}"\n\nIstruzioni:\n1. Per prima cosa, riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine — il testo intero, non solo frammenti.\n2. Poi elenca ogni errore: originale → corretto, con una spiegazione IN ITALIANO del perché era sbagliato.\n3. Valuta il livello (A2/B1/B2/C1/C2).\n\nSii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti. Solo correzioni e spiegazioni.`;
    const feedbackResp = await callClaude(key, feedbackPrompt);
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
    d.readingHistory.push({ date: today(), title, difficulty: article.difficulty, cardCount: 0, reflectionWords: wc });
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
    const cardPrompt = `You are generating flashcards from a corrected Italian reflection on an article.\n\nArticle: "${title}"\nStudent reflection:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections and the student's text, generate 5-8 flashcard pairs (definition + cloze for each item) following the rules.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields.\n[{"front":"...","back":"..."}]`;
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

