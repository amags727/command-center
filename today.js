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
  // Check if reflection was submitted today
  const corrections = dd.corrections || [];
  const todayReflection = corrections.find(c => c.date === today());
  if (todayReflection) {
    // Check reflection checkbox
    const reflChk = document.getElementById('italian-check-refl');
    if (reflChk) reflChk.checked = true;
    // Lock textarea and hide submit button
    const reflTxt = document.getElementById('reflection-text');
    if (reflTxt) {
      reflTxt.disabled = true;
      reflTxt.style.background = '#f5f5f5';
      reflTxt.style.cursor = 'not-allowed';
    }
    const submitBtn = document.querySelector('.btn.btn-p[onclick="submitRefl()"]');
    if (submitBtn) submitBtn.style.display = 'none';
  }
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
  if (day.reflection) document.getElementById('reflection-text').value = day.reflection;
  // Display-only word count — do NOT call updRC() here, it would re-stamp reflectionMod
  { const _t = document.getElementById('reflection-text').value, _wc = _t.trim().split(/\s+/).filter(w=>w).length, _el = document.getElementById('reflection-wordcount');
    if (_el) { _el.textContent = _wc + ' / 200 words'; _el.className = 'wc' + (_wc > 0 && _wc < 200 ? ' bad' : ''); } }
  renderBlocks(); loadT3Intentions();
  const wk = weekId();
  const wd = weekData(wk);
  if (wd.weeks[wk].pushGoal) {
    document.getElementById('push-goal-banner').style.display = 'block';
    document.getElementById('push-goal-text').textContent = wd.weeks[wk].pushGoal;
    const endOfWeek = new Date(wk); endOfWeek.setDate(endOfWeek.getDate() + 6);
    document.getElementById('push-goal-countdown').textContent = Math.max(0, Math.ceil((endOfWeek - new Date()) / 86400000)) + ' days left this week';
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
    if (ct < 300) { document.getElementById('anki-w').style.display = 'block'; document.getElementById('italian-check-anki').checked = false; return; }
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


// --- T3 Intentions (Chip-based) ---

function _t3GenId(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,6); }

// Date helper: offset a YYYY-MM-DD string by N days (negative = past)
function _dateOffset(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Get day key (mon/tue/...) for a YYYY-MM-DD string
function _dayKeyForDate(dateStr) {
  var map = ['sun','mon','tue','wed','thu','fri','sat'];
  return map[new Date(dateStr + 'T12:00:00').getDay()];
}

// Recursive carry-forward: walk back up to 14 days, collect undone chips
function carryForwardTasks() {
  var todayStr = today();
  var dd = dayData(todayStr);
  var todayT3 = dd.days[todayStr].t3intentions;
  // Build lookup of existing chip texts in today (to avoid duplicates)
  var existingTexts = {};
  if (todayT3) {
    ['work','school','life'].forEach(function(cat) {
      var arr = todayT3[cat];
      if (Array.isArray(arr)) arr.forEach(function(c) { if (c.text) existingTexts[cat + '::' + c.text.trim()] = true; });
    });
  }
  var carried = { work: [], school: [], life: [] };
  var todayDayKey = typeof getTodayDayKey === 'function' ? getTodayDayKey() : _dayKeyForDate(todayStr);
  // Walk backwards up to 14 days
  for (var offset = 1; offset <= 14; offset++) {
    var pastDate = _dateOffset(todayStr, -offset);
    var pastDd = dayData(pastDate);
    var pastDay = pastDd.days[pastDate];
    if (!pastDay || !pastDay.t3intentions) continue;
    var pt = pastDay.t3intentions;
    ['work','school','life'].forEach(function(cat) {
      var arr = pt[cat];
      if (!Array.isArray(arr)) return;
      arr.forEach(function(chip) {
        if (chip.done) return; // completed, skip
        var key = cat + '::' + (chip.text || '').trim();
        if (!key || existingTexts[key]) return; // already exists in today
        existingTexts[key] = true;
        var newChip = { text: chip.text, id: _t3GenId(cat[0]), overdue: true, originalDate: chip.originalDate || pastDate };
        if (chip.dissLinked) {
          // Move diss span to today's day color
          var oldDayKey = _dayKeyForDate(pastDate);
          if (typeof moveDissSpanToDay === 'function') {
            moveDissSpanToDay(oldDayKey, chip.spanIndex, todayDayKey);
          }
          // Re-query to get new spanIndex after move
          if (typeof getDissWeeklyGoalsForDayArray === 'function') {
            var todaySpans = getDissWeeklyGoalsForDayArray(todayDayKey);
            var found = todaySpans.find(function(s) { return s.text.trim() === chip.text.trim(); });
            if (found) { newChip.dissLinked = true; newChip.spanIndex = found.spanIndex; }
          }
        }
        carried[cat].push(newChip);
      });
    });
  }
  // Append carried chips to today
  var changed = false;
  if (!todayT3) { dd.days[todayStr].t3intentions = { work: [], school: [], life: [] }; todayT3 = dd.days[todayStr].t3intentions; }
  ['work','school','life'].forEach(function(cat) {
    if (!Array.isArray(todayT3[cat])) todayT3[cat] = [];
    if (carried[cat].length) { todayT3[cat] = todayT3[cat].concat(carried[cat]); changed = true; }
  });
  if (changed) save(dd);
}

function saveT3Intentions() {
  const dd = dayData(today());
  dd.days[today()].t3intentions = {
    work: _t3ReadChips('daily-goals-work'),
    school: _t3ReadChips('daily-goals-school'),
    life: _t3ReadChips('daily-goals-life')
  };
  save(dd);
}

// Read chip data from DOM
function _t3ReadChips(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  return Array.from(el.querySelectorAll('.goal-chip')).map(function(chip) {
    const obj = { text: chip.querySelector('.chip-text').textContent.trim(), id: chip.dataset.chipId || '' };
    if (chip.dataset.dissLinked === 'true') { obj.dissLinked = true; obj.spanIndex = parseInt(chip.dataset.spanIndex) || 0; }
    if (chip.dataset.done === 'true') obj.done = true;
    return obj;
  }).filter(function(c) { return c.text; });
}

// Render chips into a container from array
function _t3RenderChips(containerId, chips, prefix) {
  const el = document.getElementById(containerId);
  if (!el) return;
  // Remove only chip elements, preserve the static ＋ Add button
  el.querySelectorAll('.goal-chip').forEach(function(c) { c.remove(); });
  const addBtn = el.querySelector('.chip-add');
  (chips || []).forEach(function(c) {
    const chip = _t3MakeChip(c, containerId, prefix);
    if (addBtn) el.insertBefore(chip, addBtn);
    else el.appendChild(chip);
  });
}

function _t3MakeChip(chipData, containerId, prefix) {
  const chip = document.createElement('span');
  chip.className = 'goal-chip' + (chipData.dissLinked ? ' linked' : '') + (chipData.done ? ' done' : '') + (chipData.overdue ? ' overdue' : '');
  chip.dataset.chipId = chipData.id || _t3GenId(prefix);
  if (chipData.done) chip.dataset.done = 'true';
  if (chipData.dissLinked) {
    chip.dataset.dissLinked = 'true';
    chip.dataset.spanIndex = chipData.spanIndex;
    if (typeof _dissHighlightColors !== 'undefined' && typeof getTodayDayKey === 'function') {
      chip.style.borderLeftColor = _dissHighlightColors[getTodayDayKey()] || '#B3D9FF';
    }
  }
  // Check circle
  const chk = document.createElement('span');
  chk.className = 'chip-check';
  chk.textContent = '✓';
  chk.onclick = function() {
    chip.classList.toggle('done');
    const isDone = chip.classList.contains('done');
    chip.dataset.done = isDone ? 'true' : '';
    saveT3Intentions();
    // Cross out on dissertation page if linked
    if (chipData.dissLinked && typeof toggleDissGoalDone === 'function' && typeof getTodayDayKey === 'function') {
      toggleDissGoalDone(getTodayDayKey(), chipData.spanIndex, isDone);
    }
    // Sync strikethrough on weekly goals page
    if (typeof syncWeekGoalsDoneState === 'function') syncWeekGoalsDoneState();
  };
  chip.appendChild(chk);
  // Overdue badge
  if (chipData.overdue && chipData.originalDate) {
    const badge = document.createElement('span');
    badge.className = 'chip-overdue-badge';
    badge.textContent = '⏰';
    badge.title = 'Carried from ' + chipData.originalDate;
    chip.appendChild(badge);
  }
  const txt = document.createElement('span');
  txt.className = 'chip-text';
  txt.contentEditable = 'true';
  txt.textContent = chipData.text || '';
  txt.dataset.placeholder = 'goal...';
  txt.onblur = function() {
    saveT3Intentions();
    // Reverse sync to dissertation if linked
    if (chipData.dissLinked && typeof updateDissWeeklyGoalSpan === 'function' && typeof getTodayDayKey === 'function') {
      updateDissWeeklyGoalSpan(getTodayDayKey(), chipData.spanIndex, txt.textContent.trim());
    }
  };
  txt.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } };
  const x = document.createElement('span');
  x.className = 'chip-x';
  x.textContent = '×';
  x.onclick = function() { chip.remove(); saveT3Intentions(); };
  chip.appendChild(txt);
  chip.appendChild(x);
  return chip;
}

function _t3AddNewChip(containerId, prefix) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const chipData = { text: '', id: _t3GenId(prefix) };
  const chip = _t3MakeChip(chipData, containerId, prefix);
  const addBtn = el.querySelector('.chip-add');
  el.insertBefore(chip, addBtn);
  chip.querySelector('.chip-text').focus();
}

function loadT3Intentions() {
  const dd = dayData(today());
  const t = dd.days[today()].t3intentions;
  if (t && (Array.isArray(t.work) || Array.isArray(t.school) || Array.isArray(t.life))) {
    // New array format
    _t3RenderChips('daily-goals-work', t.work || [], 'w');
    _t3RenderChips('daily-goals-school', t.school || [], 's');
    _t3RenderChips('daily-goals-life', t.life || [], 'l');
  } else if (t && (t.work || t.school || t.life)) {
    // Old string format — convert
    const toArr = function(s, p) { return (s||'').split('\n').filter(Boolean).map(function(line) { return {text:line.trim(), id:_t3GenId(p)}; }); };
    const converted = { work: toArr(t.work,'w'), school: toArr(t.school,'s'), life: toArr(typeof t.life === 'string' ? t.life : [t.life1,t.life2,t.life3].filter(Boolean).join('\n'), 'l') };
    dd.days[today()].t3intentions = converted;
    save(dd);
    _t3RenderChips('daily-goals-work', converted.work, 'w');
    _t3RenderChips('daily-goals-school', converted.school, 's');
    _t3RenderChips('daily-goals-life', converted.life, 'l');
  } else {
    // Empty — just render empty containers with add buttons
    _t3RenderChips('daily-goals-work', [], 'w');
    _t3RenderChips('daily-goals-school', [], 's');
    _t3RenderChips('daily-goals-life', [], 'l');
  }
  // Carry forward undone tasks from previous days
  carryForwardTasks();
  // Re-read after carry-forward may have added chips
  const dd2 = dayData(today());
  const t2 = dd2.days[today()].t3intentions;
  if (t2) {
    _t3RenderChips('daily-goals-work', t2.work || [], 'w');
    _t3RenderChips('daily-goals-school', t2.school || [], 's');
    _t3RenderChips('daily-goals-life', t2.life || [], 'l');
  }
  // Auto-populate from dissertation weekly goals (school)
  populateSchoolWeeklyGoals();
  // Auto-populate from weekly goals (work + life)
  populateFromWeeklyGoals();
}

function populateSchoolWeeklyGoals() {
  if (typeof getDissWeeklyGoalsForDayArray !== 'function' || typeof getTodayDayKey !== 'function') return;
  const dayKey = getTodayDayKey();
  const dissGoals = getDissWeeklyGoalsForDayArray(dayKey);
  if (!dissGoals.length) return;
  const container = document.getElementById('daily-goals-school');
  if (!container) return;
  // Get existing linked chips
  const existingLinked = {};
  container.querySelectorAll('.goal-chip[data-diss-linked="true"]').forEach(function(chip) {
    existingLinked[chip.dataset.spanIndex] = chip;
  });
  // Build set of current spanIndexes from diss
  const currentIndexes = new Set(dissGoals.map(function(g) { return String(g.spanIndex); }));
  // Remove linked chips that no longer exist in dissertation
  Object.keys(existingLinked).forEach(function(idx) {
    if (!currentIndexes.has(idx)) existingLinked[idx].remove();
  });
  // Add/update linked chips
  const addBtn = container.querySelector('.chip-add');
  dissGoals.forEach(function(g) {
    if (existingLinked[String(g.spanIndex)]) {
      // Update text if different
      const chip = existingLinked[String(g.spanIndex)];
      const txtEl = chip.querySelector('.chip-text');
      if (txtEl.textContent.trim() !== g.text) txtEl.textContent = g.text;
    } else {
      // Create new linked chip
      const chipData = { text: g.text, id: _t3GenId('s'), dissLinked: true, spanIndex: g.spanIndex };
      const chip = _t3MakeChip(chipData, 'daily-goals-school', 's');
      container.insertBefore(chip, addBtn);
    }
  });
  saveT3Intentions();
}

// --- Auto-populate daily chips from Weekly Goals (Work / School / Life) ---
function getWeeklyGoalsForToday() {
  const d = getGlobal();
  const wk = d.weekGoals && d.weekGoals[weekId()] || {};
  const dayMap = {1:'mon',2:'tue',3:'wed',4:'thu',5:'fri',6:'sat',0:'sun'};
  const todayDay = dayMap[new Date().getDay()];
  const results = {work:[], school:[], life:[]};
  ['work','school','life'].forEach(cat => {
    const html = wk[cat] || '';
    if (!html) return;
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('[data-day="'+todayDay+'"]').forEach(span => {
      const text = span.textContent.trim();
      if (text) results[cat].push(text);
    });
  });
  return results;
}

function populateFromWeeklyGoals() {
  const goals = getWeeklyGoalsForToday();
  const catMap = {work:'daily-goals-work', school:'daily-goals-school', life:'daily-goals-life'};
  const prefixMap = {work:'w', school:'s', life:'l'};
  ['work','school','life'].forEach(cat => {
    const items = goals[cat];
    if (!items.length) return;
    const container = document.getElementById(catMap[cat]);
    if (!container) return;
    const existingTexts = new Set();
    container.querySelectorAll('.goal-chip .chip-text').forEach(el => {
      existingTexts.add(el.textContent.trim());
    });
    const addBtn = container.querySelector('.chip-add');
    items.forEach(text => {
      if (existingTexts.has(text)) return;
      const chipData = { text, id: _t3GenId(prefixMap[cat]), linked: true };
      const chip = _t3MakeChip(chipData, catMap[cat], prefixMap[cat]);
      chip.classList.add('linked');
      container.insertBefore(chip, addBtn);
    });
  });
  saveT3Intentions();
}

function updRC() {
  const txt = document.getElementById('reflection-text').value, wc = txt.trim().split(/\s+/).filter(w => w).length, el = document.getElementById('reflection-wordcount');
  el.textContent = wc + ' / 200 words'; el.className = 'wc' + (wc > 0 && wc < 200 ? ' bad' : '');
  const dd = dayData(today()); dd.days[today()].reflection = txt; dd.days[today()].reflectionMod = Date.now(); save(dd);
}


function sealDay() {
  if (!confirm('Lock all entries for today permanently?')) return;
  const dd = dayData(today()); dd.days[today()].sealed = true; save(dd); lockToday(); addLog('sealed', 'Day sealed: ' + today());
}


// --- Daily Composition / Reflection Submit ---
// ============ REFLECTION SUBMIT (Daily Composition) ============
async function submitRefl() {
  const txt = document.getElementById('reflection-text').value.trim();
  const wc = txt.split(/\s+/).filter(w => w).length;
  if (wc < 200) { alert('Min 200 words required. Currently: ' + wc); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const res = document.getElementById('reflection-result');
  res.style.display = 'block'; res.innerHTML = '<p style="font-size:18px">⏳ Sending to Claude for correction + flashcard generation...</p>';
  try {
    const feedbackPrompt = CORRECTION_PROMPT_DAILY(txt);
    const feedbackResp = await callClaude(key, feedbackPrompt);
    res.innerHTML = '<div style="background:var(--bg);padding:10px;border-radius:6px;font-size:13px;white-space:pre-wrap;border:1px solid var(--border)">' + escHtml(feedbackResp) + '</div>';
    // Parse and save score
    const scoreData = _parseReflectionScore(feedbackResp);
    // Save correction with score
    const d = getGlobal();
    d.corrections.push({ date: today(), text: txt, response: feedbackResp, score: scoreData });
    save(d);
    // Now generate flashcards
    const cardPrompt = `You are generating flashcards from a corrected Italian composition exercise.\n\nOriginal student text:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections above, extract 5-8 flashcard items following the extraction and card construction rules. For each item, generate the paired definition card and cloze card.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('refl-card-review', cards, 'Daily composition:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'composition');
    }
    // Lock textarea and hide submit button
    document.getElementById('reflection-text').disabled = true;
    document.getElementById('reflection-text').style.background = '#f5f5f5';
    document.getElementById('reflection-text').style.cursor = 'not-allowed';
    const submitBtn = document.querySelector('.btn.btn-p[onclick="submitRefl()"]');
    if (submitBtn) submitBtn.style.display = 'none';
    
    // Check reflection checkbox
    const reflChk = document.getElementById('italian-check-refl');
    if (reflChk) reflChk.checked = true;
    
    addLog('action', 'Italian composition submitted + corrected + ' + cards.length + ' cards generated');
  } catch (e) { res.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>'; }
}

