// ============ TODAY MODULE ============
// ============ TODAY TAB ============
function initToday() {
  const d = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('today-date').textContent = days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  const dayNum = d.getDay();
  const labels = { 0: '🧘 Rest & Review Day', 1: '💪 Fresh Start Monday', 2: '🔥 Build Momentum', 3: '⚡ Midweek Push', 4: '🎯 Almost There', 5: '🏁 Finish Strong Friday', 6: '📚 Deep Work Saturday' };
  document.getElementById('today-label').textContent = labels[dayNum] || '';
  const dd = dayData(today());
  const day = dd.days[today()];
  // Backfill article habits from readingHistory (covers articles submitted before fix)
  const rh = dd.readingHistory || [];
  const todaysArticles = rh.filter(a => a.date === today());
  if (todaysArticles.length >= 1 && !day.habits.art1) {
    day.habits.art1 = true;
    day.habits.art1Title = todaysArticles[0].title || 'Completed';
    save(dd);
  }
  if (todaysArticles.length >= 2 && !day.habits.art2) {
    day.habits.art2 = true;
    day.habits.art2Title = todaysArticles[1].title || 'Completed';
    save(dd);
  }
  ['anki','art1','art2'].forEach(h => {
    const el = document.getElementById('h-' + h);
    if (el && day.habits[h]) el.checked = true;
    if (day.sealed) el && (el.disabled = true);
  });
  if (day.habits.ankiCount) document.getElementById('anki-ct').textContent = day.habits.ankiCount;
  if (day.habits.art1Title) document.getElementById('art1-t').value = day.habits.art1Title;
  if (day.habits.art1Thoughts) document.getElementById('art1-th').value = day.habits.art1Thoughts;
  if (day.habits.art2Title) document.getElementById('art2-t').value = day.habits.art2Title;
  if (day.habits.art2Thoughts) document.getElementById('art2-th').value = day.habits.art2Thoughts;
  // Update article status labels from stored data
  if (day.habits.art1) {
    const st = document.getElementById('art1-status');
    if (st) st.textContent = '✅ ' + (day.habits.art1Title || 'Completed');
  }
  if (day.habits.art2) {
    const st = document.getElementById('art2-status');
    if (st) st.textContent = '✅ ' + (day.habits.art2Title || 'Completed');
  }
  if (day.reflection) document.getElementById('refl-txt').value = day.reflection;
  updRC();
  renderBlocks(); loadT3Intentions();
  const wk = weekId();
  const wd = weekData(wk);
  if (wd.weeks[wk].pushGoal) {
    document.getElementById('pgb').style.display = 'block';
    document.getElementById('pg-text').textContent = wd.weeks[wk].pushGoal;
    const endOfWeek = new Date(wk); endOfWeek.setDate(endOfWeek.getDate() + 6);
    document.getElementById('pg-countdown').textContent = Math.max(0, Math.ceil((endOfWeek - new Date()) / 86400000)) + ' days left this week';
  }
  if (day.sealed) lockToday();
  // Populate Anki count/target from cards data
  const totalReviewed = getTotalReviewedToday();
  updateAnkiHabitFromCards(totalReviewed);
}

function lockToday() {
  document.querySelectorAll('#tab-today input, #tab-today textarea, #tab-today select').forEach(el => el.disabled = true);
  document.querySelectorAll('#tab-today button').forEach(el => { if (!el.closest('.nav')) el.disabled = true; });
}

function gateHabit(type) {
  const dd = dayData(today()); const day = dd.days[today()];
  if (type === 'anki') {
    const ct = parseInt(document.getElementById('anki-ct').textContent) || 0;
    if (ct < 300) { document.getElementById('anki-w').style.display = 'block'; document.getElementById('h-anki').checked = false; return; }
    document.getElementById('anki-w').style.display = 'none'; day.habits.anki = true; day.habits.ankiCount = ct;
  } else if (type === 'art1' || type === 'art2') {
    const n = type === 'art1' ? 1 : 2;
    const thoughts = document.getElementById('art' + n + '-th').value.trim();
    if (thoughts.length < 50) { document.getElementById('art' + n + '-w').style.display = 'block'; document.getElementById('h-' + type).checked = false; return; }
    document.getElementById('art' + n + '-w').style.display = 'none';
    day.habits[type] = true; day.habits[type + 'Title'] = document.getElementById('art' + n + '-t').value; day.habits[type + 'Thoughts'] = thoughts;
  } else if (type === 'convo') {
    day.habits.convo = true; day.habits.convoWho = document.getElementById('convo-who').value; day.habits.convoDet = document.getElementById('convo-det').value;
  }
  save(dd); addLog('action', 'Habit checked: ' + type);
}

function valArt(n) { const t = document.getElementById('art' + n + '-th').value.trim(); document.getElementById('art' + n + '-w').style.display = t.length < 50 && t.length > 0 ? 'block' : 'none'; }

document.addEventListener('change', function(e) {
  if (e.target.id === 'h-gym') { const dd = dayData(today()); dd.days[today()].habits.gym = e.target.checked; save(dd); if (e.target.checked) addLog('action', 'Gym completed'); }
});


// --- T3 Intentions, Reflection Count, Seal ---
function saveT3Intentions() {
  const dd = dayData(today());
  dd.days[today()].t3intentions = {
    work: document.getElementById('t3-work').value,
    school: document.getElementById('t3-school').value,
    life: document.getElementById('t3-life').value
  };
  save(dd);
}
function loadT3Intentions() {
  const dd = dayData(today());
  const t = dd.days[today()].t3intentions;
  if (t && (t.work || t.school || t.life)) {
    document.getElementById('t3-work').value = t.work || '';
    document.getElementById('t3-school').value = t.school || '';
    document.getElementById('t3-life').value = t.life || '';
  } else {
    // Auto-populate from previous day
    const prev = new Date(); prev.setDate(prev.getDate() - 1);
    const prevKey = prev.toISOString().slice(0, 10);
    const pd = dd.days[prevKey];
    if (pd && pd.t3intentions) {
      document.getElementById('t3-work').value = pd.t3intentions.work || '';
      document.getElementById('t3-school').value = pd.t3intentions.school || '';
      document.getElementById('t3-life').value = pd.t3intentions.life || '';
      saveT3Intentions();
    }
  }
}

function updRC() {
  const txt = document.getElementById('refl-txt').value, wc = txt.trim().split(/\s+/).filter(w => w).length, el = document.getElementById('refl-wc');
  el.textContent = wc + ' / 200 words'; el.className = 'wc' + (wc > 0 && wc < 200 ? ' bad' : '');
  const dd = dayData(today()); dd.days[today()].reflection = txt; save(dd);
}


function sealDay() {
  if (!confirm('Lock all entries for today permanently?')) return;
  const dd = dayData(today()); dd.days[today()].sealed = true; save(dd); lockToday(); addLog('sealed', 'Day sealed: ' + today());
}


// --- Daily Composition / Reflection Submit ---
// ============ REFLECTION SUBMIT (Daily Composition) ============
async function submitRefl() {
  const txt = document.getElementById('refl-txt').value.trim();
  const wc = txt.split(/\s+/).filter(w => w).length;
  if (wc < 200) { alert('Min 200 words required. Currently: ' + wc); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const res = document.getElementById('refl-res');
  res.style.display = 'block'; res.innerHTML = '<p>⏳ Sending to Claude for correction + flashcard generation...</p>';
  try {
    const feedbackPrompt = `Sei un tutor esperto di italiano a livello C1-C2. Lo studente ha scritto questa composizione giornaliera:\n\n"${txt}"\n\nIstruzioni:\n1. Per prima cosa, riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine — il testo intero, non solo frammenti.\n2. Poi elenca ogni errore: originale → corretto, con una spiegazione IN ITALIANO del perché era sbagliato.\n3. Valuta il livello (A2/B1/B2/C1/C2).\n\nSii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti. Solo correzioni e spiegazioni.\n\nFormatta la risposta con intestazioni chiare.`;
    const feedbackResp = await callClaude(key, feedbackPrompt);
    res.innerHTML = '<div style="background:var(--bg);padding:10px;border-radius:6px;font-size:13px;white-space:pre-wrap;border:1px solid var(--border)">' + escHtml(feedbackResp) + '</div>';
    // Save correction
    const d = getGlobal();
    d.corrections.push({ date: today(), text: txt, response: feedbackResp });
    save(d);
    // Now generate flashcards
    const cardPrompt = `You are generating flashcards from a corrected Italian composition exercise.\n\nOriginal student text:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections above, extract 5-8 flashcard items following the extraction and card construction rules. For each item, generate the paired definition card and cloze card.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('refl-card-review', cards, 'Daily composition:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'composition');
    }
    addLog('action', 'Italian composition submitted + corrected + ' + cards.length + ' cards generated');
  } catch (e) { res.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>'; }
}

