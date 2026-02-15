// ============ ARTICLE OF THE DAY ============
const AOTD_FEEDS = {
  italian: [
    { name: 'Il Post', url: 'https://www.ilpost.it/feed/' },
    { name: 'La Repubblica', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml' },
    { name: 'Internazionale', url: 'https://www.internazionale.it/sitemaps/rss.xml' },
    { name: 'Doppiozero', url: 'https://www.doppiozero.com/rss.xml' },
    { name: 'Il Fatto Quotidiano', url: 'https://www.ilfattoquotidiano.it/feed/' },
    { name: 'Fanpage', url: 'https://www.fanpage.it/feed/' },
    { name: 'ANSA', url: 'https://www.ansa.it/sito/ansait_rss.xml' },
    { name: 'Il Manifesto', url: 'https://ilmanifesto.it/feed' },
    { name: 'Rivista Studio', url: 'https://www.rivistastudio.com/feed/' },
    { name: 'Il Tascabile', url: 'https://www.iltascabile.com/feed/' },
    { name: 'Valigia Blu', url: 'https://www.vfrancia.me/valigiablu/feed/' },
    { name: 'Domani', url: 'https://www.editorialedomani.it/feed' },
    { name: 'Wired Italia', url: 'https://www.wired.it/feed/rss' },
    { name: 'Vita', url: 'https://www.vita.it/feed/' }
  ],
  english: [
    { name: 'Aeon', url: 'https://aeon.co/feed.rss' },
    { name: 'The Guardian Long Read', url: 'https://www.theguardian.com/news/series/the-long-read/rss' },
    { name: 'The Conversation', url: 'https://theconversation.com/articles.atom' },
    { name: 'ProPublica', url: 'https://feeds.propublica.org/propublica/main' },
    { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'The Intercept', url: 'https://theintercept.com/feed/?rss' },
    { name: 'Vox', url: 'https://www.vox.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/' },
    { name: 'Rest of World', url: 'https://restofworld.org/feed/' },
    { name: 'NYRB', url: 'https://www.nybooks.com/feed/' },
    { name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' }
  ],
  other: [
    { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
    { name: 'France 24', url: 'https://www.france24.com/fr/rss' },
    { name: 'Die Zeit', url: 'https://newsfeed.zeit.de/index' },
    { name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-de-all' },
    { name: 'Der Spiegel', url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
    { name: 'NZZ', url: 'https://www.nzz.ch/recent.rss' },
    { name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
    { name: 'BBC Mundo', url: 'https://www.bbc.com/mundo/rss.xml' },
    { name: 'The Wire (India)', url: 'https://thewire.in/feed' },
    { name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/feed/' },
    { name: 'NHK World', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml' },
    { name: 'Mediapart Blog', url: 'https://blogs.mediapart.fr/feed' }
  ]
};

const AOTD_PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
];

const AOTD_METHODOLOGY = `You are a reading advisor for a reader with advanced training in economics and the humanities.

TASK: From the pool of recent articles below, select ONE that best matches the following criteria. You may also REJECT the entire pool if nothing meets the bar.

SOURCE STRATEGY — aim for balance over time. Yesterday's pick was from the "{lastCat}" category. Prefer a different category today if quality allows.
Categories: Italian-language, English-language, Non-Anglophone/non-Italian

QUALITY CONTROL — this pool comes from ~40 feeds of varying quality. You MUST apply strict editorial judgment:
- REJECT clickbait, listicles, wire-service rewrites, aggregated news briefs, PR-driven announcements, and content-farm filler
- REJECT anything that merely describes events without analysis ("X happened yesterday")
- REJECT promotional or sponsored content, product announcements, celebrity gossip
- REJECT pieces shorter than ~800 words (based on description length — if the description is a single sentence with no substance, it's probably a brief)
- PREFER long-form: essays, reported features, investigations, serious reviews, deep analysis
- PREFER pieces with original reporting or a distinct intellectual argument
- PENALIZE duplicative coverage — if multiple outlets ran the same story, skip it unless one has a meaningfully different angle
- ASK: "Would this be worth 10+ minutes of focused reading for someone who reads seriously?" If no, skip it.

SUBJECT AREAS TO PRIORITIZE (at least one, preferably two):
- Political economy of technology (AI, data, platforms, measurement)
- Media, expertise, and knowledge production
- Migration, borders, categorization, and state capacity
- Cultural responses to economic or technological change
- Institutions whose public narratives diverge from their actual functioning

ACCESSIBILITY CONSTRAINT:
- The reader subscribes to: Il Post, New York Times, Wall Street Journal
- STRONGLY prefer articles that are either (a) from a subscribed outlet, (b) known to be freely accessible (e.g. Aeon, Guardian, BBC, NPR, ProPublica, The Conversation, Quanta, Rest of World, Al Jazeera, DW, France 24, BBC Mundo, NHK World), or (c) from outlets that typically don't paywall long-form content
- If recommending a paywalled piece from a non-subscribed outlet, add "⚠️ likely paywalled" at the start of the blurb
- Many feeds in this pool are free — lean toward those unless a subscribed or exceptional piece clearly wins

ANALYTICAL CONSTRAINTS:
- The article should interrogate a commonly accepted assumption rather than merely describe events
- Prefer pieces that link abstract concepts (incentives, norms, classification, legitimacy) to a concrete case
- Tone should be skeptical or analytical, not celebratory, alarmist, or moralizing
- Avoid culture-war framing, hype about "the future of X," or managerial optimism

AUDIENCE CALIBRATION:
- The reader is comfortable with theory and abstraction but impatient with jargon
- Do not pick articles that merely explain basic concepts unless doing so IS the argument

STYLE PREFERENCES:
- Clear argumentative spine; the core claim should be expressible in one sentence
- Bonus for authors who quietly dissent from a dominant narrative

BIAS RATING — after identifying the source, assign a political bias rating from this scale:
far-left | left | left-center | center | center-right | right | far-right
Base this on the outlet's overall editorial posture, not the individual article.

FAR-RIGHT EXCLUSION — STRONGLY avoid far-right publications. Only include one if the specific piece contains genuinely rigorous analysis that transcends the outlet's editorial posture — this should be extremely rare.

RESPONSE FORMAT — return ONLY valid JSON, no markdown fences:
If you find a worthy article:
{"title":"...","url":"...","source":"...","bias":"left|left-center|center|center-right|right","category":"italian|english|other","blurb":"One sentence on why this is worth reading","image":"image_url_or_null","paywalled":false}

If NOTHING in the pool meets the bar, respond with:
{"resample":true,"reason":"brief explanation of why the pool was weak"}`;

async function fetchWithProxy(url) {
  for (const mkProxy of AOTD_PROXIES) {
    try {
      const r = await fetch(mkProxy(url), { signal: AbortSignal.timeout(12000) });
      if (r.ok) return await r.text();
    } catch(e) { /* try next proxy */ }
  }
  return null;
}

function parseRSSItems(xml, sourceName) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return [];
    const items = [...doc.querySelectorAll('item')].slice(0, 15);
    return items.map(it => {
      const get = tag => { const el = it.querySelector(tag); return el ? el.textContent.trim() : ''; };
      let image = null;
      const media = it.querySelector('content[url]') || it.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
      if (media) image = media.getAttribute('url');
      if (!image) { const enc = it.querySelector('enclosure[url]'); if (enc && (enc.getAttribute('type')||'').startsWith('image')) image = enc.getAttribute('url'); }
      const desc = get('description').replace(/<[^>]+>/g, '').slice(0, 400);
      return { title: get('title'), link: get('link'), description: desc, pubDate: get('pubDate'), source: sourceName, image };
    }).filter(i => i.title && i.link);
  } catch(e) { return []; }
}

async function fetchAllRSSItems() {
  const allFeeds = [...AOTD_FEEDS.italian.map(f=>({...f,cat:'italian'})), ...AOTD_FEEDS.english.map(f=>({...f,cat:'english'})), ...AOTD_FEEDS.other.map(f=>({...f,cat:'other'}))];
  const results = await Promise.allSettled(allFeeds.map(async feed => {
    const xml = await fetchWithProxy(feed.url);
    if (!xml) return [];
    return parseRSSItems(xml, feed.name).map(item => ({ ...item, category: feed.cat }));
  }));
  let pool = [];
  results.forEach(r => { if (r.status === 'fulfilled') pool.push(...r.value); });
  // Sort by date (most recent first), dedupe by title
  pool.sort((a,b) => { try { return new Date(b.pubDate) - new Date(a.pubDate); } catch(e) { return 0; } });
  const seen = new Set();
  pool = pool.filter(i => { const k = i.title.toLowerCase().slice(0,60); if (seen.has(k)) return false; seen.add(k); return true; });
  return pool.slice(0, 60);
}

async function askClaudeForArticle(pool, lastCat, isRetry) {
  const key = localStorage.getItem('cc_apikey');
  if (!key) throw new Error('NO_KEY');
  const historyContext = getAotdHistorySummary();
  const prompt = AOTD_METHODOLOGY.replace('{lastCat}', lastCat || 'none') +
    historyContext +
    (isRetry ? '\n\nNOTE: This is a second pass. Nothing met the bar on the first attempt. Lower your threshold slightly but maintain core quality standards. If still nothing, pick the least-bad option and note it is a compromise in the blurb.' : '') +
    '\n\nARTICLE POOL (' + pool.length + ' items):\n' + JSON.stringify(pool.map(({title,link,source,description,category,image}) => ({title,url:link,source,description,category,image})), null, 0);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 512, messages: [{ role: 'user', content: prompt }] })
  });
  if (!resp.ok) throw new Error('Claude API error: ' + resp.status);
  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  // Extract JSON from response (handle possible markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');
  return JSON.parse(jsonMatch[0]);
}

function aotdTrack(action) {
  // action: 'click' (read), 'skip' (new pick), 'ignore' (day ended without click)
  const cached = localStorage.getItem('aotd_data');
  if (!cached) return;
  try {
    const article = JSON.parse(cached);
    const d = load();
    if (!d.aotdHistory) d.aotdHistory = [];
    // Don't double-log the same article+action
    const existing = d.aotdHistory.find(h => h.date === today() && h.title === article.title && h.action === action);
    if (existing) return;
    d.aotdHistory.push({
      date: today(),
      title: article.title,
      source: article.source,
      category: article.category,
      bias: article.bias || null,
      action: action,
      ts: new Date().toISOString()
    });
    // Keep last 100 entries (raw), consolidation handles the rest
    if (d.aotdHistory.length > 100) d.aotdHistory = d.aotdHistory.slice(-100);
    save(d);
    // Check if we've crossed a 20-entry threshold since last consolidation
    const lastConsolidatedAt = d.aotdConsolidatedAt || 0;
    const totalSinceConsolidation = d.aotdHistory.length - lastConsolidatedAt;
    if (totalSinceConsolidation >= 20) {
      aotdConsolidate(); // fire-and-forget async
    }
  } catch(e) { /* ignore */ }
}

async function aotdConsolidate() {
  const key = localStorage.getItem('cc_apikey');
  if (!key) return;
  const d = load();
  const hist = d.aotdHistory || [];
  if (hist.length < 20) return;
  const existingPrior = d.aotdPrior || '';
  const clicked = hist.filter(h => h.action === 'click');
  const skipped = hist.filter(h => h.action === 'skip');
  const prompt = `You are consolidating a reader's article recommendation history into a compact preference profile.

${existingPrior ? 'EXISTING PRIOR (from earlier consolidation):\n' + existingPrior + '\n\n' : ''}NEW DATA (${hist.length} entries since last consolidation):

Articles READ (${clicked.length}):
${clicked.map(h => '- "' + h.title + '" (' + h.source + ', ' + h.category + ')').join('\n') || '(none)'}

Articles SKIPPED (${skipped.length}):
${skipped.map(h => '- "' + h.title + '" (' + h.source + ', ' + h.category + ')').join('\n') || '(none)'}

TASK: Produce a COMPACT reader preference profile (max 300 words) that captures:
1. Source preferences (which outlets get read vs skipped)
2. Topic preferences (what subjects attract vs repel)
3. Category balance (Italian/English/Other reading ratio)
4. Any emerging patterns in what makes the reader click vs skip
5. Concrete guidance for future article selection

${existingPrior ? 'UPDATE the existing prior with these new signals — reinforce confirmed patterns, adjust any that new data contradicts.' : 'Create the initial profile from scratch.'}

Return ONLY the preference profile text, no JSON wrapping. Be direct and specific.`;

  try {
    const resp = await callClaude(key, prompt);
    const d2 = load();
    d2.aotdPrior = resp.trim();
    d2.aotdConsolidatedAt = (d2.aotdHistory || []).length;
    save(d2);
    addLog('action', 'AOTD preferences consolidated (' + hist.length + ' entries → compact prior)');
  } catch(e) {
    console.error('AOTD consolidation failed:', e);
  }
}

function getAotdHistorySummary() {
  const d = load();
  const hist = d.aotdHistory || [];
  const prior = d.aotdPrior || '';
  const consolidatedAt = d.aotdConsolidatedAt || 0;

  if (hist.length === 0 && !prior) return '';

  let summary = '\n\nUSER READING HISTORY (use this to calibrate future picks):\n';

  // If we have a consolidated prior, use it as the primary signal
  if (prior) {
    summary += '\n--- CONSOLIDATED PREFERENCE PROFILE (from ' + consolidatedAt + ' tracked articles) ---\n';
    summary += prior + '\n';
    summary += '--- END PROFILE ---\n';
  }

  // Only list individual entries SINCE the last consolidation
  const recentHist = hist.slice(consolidatedAt);
  if (recentHist.length === 0 && prior) {
    summary += '\nNo new articles tracked since last consolidation.\n';
    summary += '\nUse the preference profile above as a STRONG signal for source, topic, and category selection.';
    return summary;
  }

  // If no prior exists yet, show all entries; otherwise only recent ones
  const displayHist = prior ? recentHist : hist;
  const clicked = displayHist.filter(h => h.action === 'click');
  const skipped = displayHist.filter(h => h.action === 'skip');

  if (prior) {
    summary += '\nRECENT ACTIVITY (since last consolidation — ' + recentHist.length + ' new entries):\n';
  } else {
    summary += 'Total tracked: ' + hist.length + ' articles | Read: ' + clicked.length + ' | Skipped: ' + skipped.length + '\n';
  }

  if (clicked.length > 0) {
    summary += '\nArticles the user CLICKED (liked enough to read):\n';
    clicked.slice(-15).forEach(h => { summary += '- "' + h.title + '" (' + h.source + ', ' + h.category + ')\n'; });
  }
  if (skipped.length > 0) {
    summary += '\nArticles the user SKIPPED (hit New Pick — not interesting enough):\n';
    skipped.slice(-15).forEach(h => { summary += '- "' + h.title + '" (' + h.source + ', ' + h.category + ')\n'; });
  }

  // Compute source preferences from the display set
  const srcClicks = {}, srcSkips = {};
  clicked.forEach(h => { srcClicks[h.source] = (srcClicks[h.source] || 0) + 1; });
  skipped.forEach(h => { srcSkips[h.source] = (srcSkips[h.source] || 0) + 1; });
  const allSrcs = new Set([...Object.keys(srcClicks), ...Object.keys(srcSkips)]);
  if (allSrcs.size > 0) {
    summary += '\nSource hit rates' + (prior ? ' (recent only)' : '') + ':\n';
    allSrcs.forEach(s => {
      const c = srcClicks[s] || 0, sk = srcSkips[s] || 0;
      summary += '- ' + s + ': ' + c + ' read, ' + sk + ' skipped\n';
    });
  }

  // Category preferences from the display set
  const catClicks = {}, catSkips = {};
  clicked.forEach(h => { catClicks[h.category] = (catClicks[h.category] || 0) + 1; });
  skipped.forEach(h => { catSkips[h.category] = (catSkips[h.category] || 0) + 1; });
  summary += '\nCategory preferences' + (prior ? ' (recent)' : '') + ': ';
  ['italian','english','other'].forEach(c => {
    summary += c + ' (' + (catClicks[c]||0) + ' read / ' + (catSkips[c]||0) + ' skipped) ';
  });

  summary += '\n\n' + (prior ? 'Use the preference profile AND recent activity as STRONG signals.' : 'Use this data to favor sources and topics the user actually reads, and avoid sources/topics they consistently skip. This is a STRONG signal — weight it heavily.');
  return summary;
}

function renderAOTD(article) {
  document.getElementById('aotd-loading').style.display = 'none';
  document.getElementById('aotd-result').style.display = 'block';
  document.getElementById('aotd-nokey').style.display = 'none';
  document.getElementById('aotd-error').style.display = 'none';
  const linkEl = document.getElementById('aotd-link');
  linkEl.textContent = article.title;
  linkEl.href = article.url;
  const readLink = document.getElementById('aotd-read-link');
  readLink.href = article.url;
  readLink.onclick = function() { aotdTrack('click'); };
  const archEl = document.getElementById('aotd-archive-link');
  if (archEl) { if (article.archiveUrl) { archEl.href = article.archiveUrl; archEl.style.display = ''; } else { archEl.style.display = 'none'; } }
  document.getElementById('aotd-source').textContent = article.source + (article.bias ? ' · ' + article.bias : '');
  const catEl = document.getElementById('aotd-cat');
  catEl.textContent = article.category === 'italian' ? '🇮🇹 Italian' : article.category === 'english' ? '🇬🇧 English' : '🌍 International';
  catEl.className = 'aotd-cat ' + (article.category === 'italian' ? 'it' : article.category === 'english' ? 'en' : 'other');
  document.getElementById('aotd-blurb').textContent = article.blurb || '';
  const claimEl = document.getElementById('aotd-claim');
  claimEl.style.display = 'none';
  const iconEl = document.getElementById('aotd-icon');
  if (article.image) {
    iconEl.innerHTML = `<img src="${article.image}" alt="" onerror="this.parentElement.innerHTML='📰'">`;
  } else {
    try { const domain = new URL(article.url).hostname; iconEl.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" onerror="this.parentElement.innerHTML='📰'">`; } catch(e) { iconEl.innerHTML = '📰'; }
  }
}

async function fetchArticleOfTheDay(force) {
  const today = new Date().toISOString().slice(0, 10);
  const cached = localStorage.getItem('aotd_data');
  const cachedDate = localStorage.getItem('aotd_date');
  if (!force && cached && cachedDate === today) {
    try { renderAOTD(JSON.parse(cached)); return; } catch(e) { /* re-fetch */ }
  }
  const key = localStorage.getItem('cc_apikey');
  if (!key) {
    document.getElementById('aotd-loading').style.display = 'none';
    document.getElementById('aotd-nokey').style.display = 'block';
    return;
  }
  document.getElementById('aotd-loading').style.display = 'block';
  document.getElementById('aotd-result').style.display = 'none';
  document.getElementById('aotd-nokey').style.display = 'none';
  document.getElementById('aotd-error').style.display = 'none';
  try {
    const pool = await fetchAllRSSItems();
    if (pool.length === 0) throw new Error('No RSS feeds responded. Check your connection.');
    const lastCat = localStorage.getItem('aotd_lastCategory') || 'none';
    let result = await askClaudeForArticle(pool, lastCat, false);
    // Handle resample / reject
    if (result.resample) {
      console.log('AOTD: Claude rejected pool —', result.reason);
      result = await askClaudeForArticle(pool, lastCat, true);
      if (result.resample) {
        // Force pick: take the first item from a different category than last time
        const fallback = pool.find(i => i.category !== lastCat) || pool[0];
        result = { title: fallback.title, url: fallback.link, source: fallback.source, category: fallback.category, blurb: 'Auto-selected (Claude found no standout piece today). ' + (fallback.description || ''), claim: null, image: fallback.image };
      }
    }
    // Check Wayback Machine for an archive link
    try {
      const wbResp = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(result.url), { signal: AbortSignal.timeout(6000) });
      if (wbResp.ok) {
        const wbData = await wbResp.json();
        if (wbData.archived_snapshots && wbData.archived_snapshots.closest && wbData.archived_snapshots.closest.available) {
          result.archiveUrl = wbData.archived_snapshots.closest.url.replace(/^http:/, 'https:');
        }
      }
    } catch(e) { /* Wayback check is best-effort */ }
    localStorage.setItem('aotd_date', today);
    if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange();
    localStorage.setItem('aotd_data', JSON.stringify(result));
    if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange();
    localStorage.setItem('aotd_lastCategory', result.category || 'none');
    if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange();
    renderAOTD(result);
  } catch(e) {
    document.getElementById('aotd-loading').style.display = 'none';
    if (e.message === 'NO_KEY') {
      document.getElementById('aotd-nokey').style.display = 'block';
    } else {
      document.getElementById('aotd-error').style.display = 'block';
      document.getElementById('aotd-error-msg').textContent = '⚠ ' + e.message;
    }
  }
}

function forceNewArticle() {
  aotdTrack('skip');
  localStorage.removeItem('aotd_date');
  localStorage.removeItem('aotd_data');
  fetchArticleOfTheDay(true);
}
