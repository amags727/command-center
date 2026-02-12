// ============ DATA LAYER ============
const KEY = 'cmdcenter';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange(); }
function today() { return new Date().toISOString().slice(0, 10); }
function weekId(d) { const dt = new Date(d || today()); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); return new Date(dt.setDate(diff)).toISOString().slice(0, 10); }
function dayData(date) { const d = load(); if (!d.days) d.days = {}; if (!d.days[date]) d.days[date] = { habits: {}, blocks: [], top3: [], intentions: [], bundles: [], reflection: '', sealed: false, distractions: [], energy: [], dissTime: 0 }; return d; }
function weekData(wk) { const d = load(); if (!d.weeks) d.weeks = {}; if (!d.weeks[wk]) d.weeks[wk] = { goals: [], review: null, pushGoal: '' }; return d; }
function getGlobal() { const d = load(); if (!d.chapters) d.chapters = []; if (!d.dissSessions) d.dissSessions = []; if (!d.inbox) d.inbox = []; if (!d.log) d.log = []; if (!d.ifthens) d.ifthens = []; if (!d.chatHistory) d.chatHistory = []; if (!d.ankiCards) d.ankiCards = []; if (!d.corrections) d.corrections = []; return d; }
function addLog(type, msg) { const d = load(); if (!d.log) d.log = []; d.log.unshift({ type, msg, ts: new Date().toISOString() }); if (d.log.length > 500) d.log = d.log.slice(0, 500); save(d); }

// ============ NAV ============
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  const btns = document.querySelectorAll('.nav button');
  const names = ['today','week','habits','dissertation','inbox','focus','claude','log'];
  const idx = names.indexOf(id);
  if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');
  if (id === 'habits') renderHabits();
  if (id === 'week') renderWeek();
  if (id === 'log') renderLog();
  if (id === 'dissertation') renderDiss();
  if (id === 'inbox') renderInbox();
  if (id === 'focus') renderFocus();
  if (id === 'claude') initClaude();
}

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
  ['anki','art1','art2','gym','convo'].forEach(h => {
    const el = document.getElementById('h-' + h);
    if (el && day.habits[h]) el.checked = true;
    if (day.sealed) el && (el.disabled = true);
  });
  if (day.habits.ankiCount) document.getElementById('anki-ct').value = day.habits.ankiCount;
  if (day.habits.art1Title) document.getElementById('art1-t').value = day.habits.art1Title;
  if (day.habits.art1Thoughts) document.getElementById('art1-th').value = day.habits.art1Thoughts;
  if (day.habits.art2Title) document.getElementById('art2-t').value = day.habits.art2Title;
  if (day.habits.art2Thoughts) document.getElementById('art2-th').value = day.habits.art2Thoughts;
  if (day.habits.convoWho) document.getElementById('convo-who').value = day.habits.convoWho;
  if (day.habits.convoDet) document.getElementById('convo-det').value = day.habits.convoDet;
  if (day.reflection) document.getElementById('refl-txt').value = day.reflection;
  updRC();
  const d2 = getGlobal();
  const todayMins = (d2.dissSessions || []).filter(s => s.date === today()).reduce((a, s) => a + s.minutes, 0);
  document.getElementById('diss-td').textContent = todayMins + ' min today';
  if (todayMins >= 30) document.getElementById('h-diss').checked = true;
  renderBlocks(); renderTop3(); renderIntentions(); renderBundles();
  const wk = weekId();
  const wd = weekData(wk);
  if (wd.weeks[wk].pushGoal) {
    document.getElementById('pgb').style.display = 'block';
    document.getElementById('pg-text').textContent = wd.weeks[wk].pushGoal;
    const endOfWeek = new Date(wk); endOfWeek.setDate(endOfWeek.getDate() + 6);
    document.getElementById('pg-countdown').textContent = Math.max(0, Math.ceil((endOfWeek - new Date()) / 86400000)) + ' days left this week';
  }
  if (day.sealed) lockToday();
}

function lockToday() {
  document.querySelectorAll('#tab-today input, #tab-today textarea, #tab-today select').forEach(el => el.disabled = true);
  document.querySelectorAll('#tab-today button').forEach(el => { if (!el.closest('.nav')) el.disabled = true; });
}

function gateHabit(type) {
  const dd = dayData(today()); const day = dd.days[today()];
  if (type === 'anki') {
    const ct = parseInt(document.getElementById('anki-ct').value) || 0;
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

function addBlock() {
  const time = document.getElementById('bl-time').value, desc = document.getElementById('bl-desc').value.trim(), cat = document.getElementById('bl-cat').value;
  if (!desc) return; const dd = dayData(today()); dd.days[today()].blocks.push({ time: time || '??:??', desc, cat });
  dd.days[today()].blocks.sort((a, b) => a.time.localeCompare(b.time)); save(dd); document.getElementById('bl-desc').value = ''; renderBlocks(); addLog('action', 'Block added: ' + desc);
}
function renderBlocks() {
  const dd = dayData(today()), blocks = dd.days[today()].blocks || [], el = document.getElementById('sched');
  el.innerHTML = blocks.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No blocks yet.</p>' : blocks.map((b, i) => '<div class="tblock ' + b.cat + '"><span class="tm">' + b.time + '</span><span style="flex:1">' + b.desc + '</span><button class="btn" style="font-size:10px;padding:2px 6px" onclick="rmBlock(' + i + ')">✕</button></div>').join('');
}
function rmBlock(i) { const dd = dayData(today()); dd.days[today()].blocks.splice(i, 1); save(dd); renderBlocks(); }

function addT3() {
  const v = document.getElementById('t3-in').value.trim(); if (!v) return;
  const dd = dayData(today()); if (dd.days[today()].top3.length >= 3) { alert('Max 3. Remove one first.'); return; }
  dd.days[today()].top3.push({ text: v, done: false }); save(dd); document.getElementById('t3-in').value = ''; renderTop3(); addLog('action', 'Priority: ' + v);
}
function renderTop3() {
  const dd = dayData(today()), items = dd.days[today()].top3 || [];
  document.getElementById('top3').innerHTML = items.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">Set your top 3 priorities.</p>' : items.map((t, i) => '<div class="hrow"><input type="checkbox" class="hchk" ' + (t.done ? 'checked' : '') + ' onchange="toggleT3(' + i + ')"><div class="hinfo"><span style="' + (t.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + t.text + '</span></div><button class="btn" style="font-size:10px;padding:2px 6px" onclick="rmT3(' + i + ')">✕</button></div>').join('');
}
function toggleT3(i) { const dd = dayData(today()); dd.days[today()].top3[i].done = !dd.days[today()].top3[i].done; save(dd); renderTop3(); }
function rmT3(i) { const dd = dayData(today()); dd.days[today()].top3.splice(i, 1); save(dd); renderTop3(); }

function addInt() { const v = document.getElementById('int-in').value.trim(); if (!v) return; const dd = dayData(today()); dd.days[today()].intentions.push(v); save(dd); document.getElementById('int-in').value = ''; renderIntentions(); }
function renderIntentions() {
  const dd = dayData(today()), items = dd.days[today()].intentions || [];
  document.getElementById('int-list').innerHTML = items.length === 0 ? '<p style="color:var(--muted);font-size:12px;font-style:italic">Set if-then plans.</p>' : items.map((t, i) => '<div class="intention">' + t + ' <button style="float:right;background:none;border:none;color:var(--red);cursor:pointer;font-size:10px" onclick="rmInt(' + i + ')">✕</button></div>').join('');
}
function rmInt(i) { const dd = dayData(today()); dd.days[today()].intentions.splice(i, 1); save(dd); renderIntentions(); }

function addBun() { const v = document.getElementById('bun-in').value.trim(); if (!v) return; const dd = dayData(today()); dd.days[today()].bundles.push(v); save(dd); document.getElementById('bun-in').value = ''; renderBundles(); }
function renderBundles() {
  const dd = dayData(today()), items = dd.days[today()].bundles || [];
  document.getElementById('bun-list').innerHTML = items.length === 0 ? '<p style="color:var(--muted);font-size:12px;font-style:italic">Pair hard tasks with rewards.</p>' : items.map((t, i) => '<div class="bundle">🔗 ' + t + ' <button style="float:right;background:none;border:none;color:var(--red);cursor:pointer;font-size:10px" onclick="rmBun(' + i + ')">✕</button></div>').join('');
}
function rmBun(i) { const dd = dayData(today()); dd.days[today()].bundles.splice(i, 1); save(dd); renderBundles(); }

function updRC() {
  const txt = document.getElementById('refl-txt').value, wc = txt.trim().split(/\s+/).filter(w => w).length, el = document.getElementById('refl-wc');
  el.textContent = wc + ' / 200 words'; el.className = 'wc' + (wc > 0 && wc < 200 ? ' bad' : '');
  const dd = dayData(today()); dd.days[today()].reflection = txt; save(dd);
}

function qCapture() { const v = document.getElementById('qcap').value.trim(); if (!v) return; const d = getGlobal(); d.inbox.push({ text: v, status: 'unsorted', cat: '', created: new Date().toISOString() }); save(d); document.getElementById('qcap').value = ''; addLog('action', 'Captured: ' + v); }

function sealDay() {
  if (!confirm('Lock all entries for today permanently?')) return;
  const dd = dayData(today()); dd.days[today()].sealed = true; save(dd); lockToday(); addLog('sealed', 'Day sealed: ' + today());
}

// ============ REFLECTION SUBMIT ============
async function submitRefl() {
  const txt = document.getElementById('refl-txt').value.trim();
  const wc = txt.split(/\s+/).filter(w => w).length;
  if (wc < 200) { alert('Min 200 words required. Currently: ' + wc); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const res = document.getElementById('refl-res');
  res.style.display = 'block'; res.innerHTML = '<p>⏳ Sending to Claude for correction + Anki cards...</p>';
  try {
    const prompt = 'You are an expert Italian language tutor at C1-C2 level. The student wrote:\n\n' + txt + '\n\nPlease:\n1. CORRECT the text (show original errors → corrections with brief explanations in English)\n2. Generate 5-8 Anki flashcards from vocabulary/grammar in this text. Format each card as:\nFront: [Italian word/phrase]\nBack: [English meaning + example sentence in Italian]\n\nBe thorough but encouraging.';
    const resp = await callClaude(key, prompt);
    res.innerHTML = '<div style="background:#f0fdf4;padding:10px;border-radius:6px;font-size:13px;white-space:pre-wrap">' + escHtml(resp) + '</div>';
    const d = getGlobal();
    d.corrections.push({ date: today(), text: txt, response: resp });
    const cardMatch = resp.match(/Front:.*?Back:.*?(?=Front:|$)/gs);
    if (cardMatch) { cardMatch.forEach(c => d.ankiCards.push({ date: today(), card: c.trim() })); }
    save(d); addLog('action', 'Italian reflection submitted + corrected');
  } catch (e) { res.innerHTML = '<p style="color:var(--red)">Error: ' + escHtml(e.message) + '</p>'; }
}

// ============ WEEK TAB ============
function renderWeek() {
  const wk = weekId(); document.getElementById('wk-date').textContent = wk;
  const d = load(), days = d.days || {};
  let gym = 0, anki = 0, art = 0, convo = 0, refl = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(wk); dt.setDate(dt.getDate() + i); const key = dt.toISOString().slice(0, 10), day = days[key];
    if (day && day.habits) { if (day.habits.gym) gym++; if (day.habits.anki) anki++; if (day.habits.art1) art++; if (day.habits.art2) art++; if (day.habits.convo) convo++; }
    if (day && day.reflection && day.reflection.trim().split(/\s+/).filter(w => w).length >= 200) refl++;
  }
  const dissHrs = ((d.dissSessions || []).filter(s => { const sd = new Date(s.date), wkd = new Date(wk); return sd >= wkd && sd < new Date(wkd.getTime() + 7 * 86400000); }).reduce((a, s) => a + s.minutes, 0) / 60).toFixed(1);
  document.getElementById('wk-gym').textContent = gym; document.getElementById('wk-anki').textContent = anki;
  document.getElementById('wk-art').textContent = art; document.getElementById('wk-convo').textContent = convo;
  document.getElementById('wk-refl').textContent = refl; document.getElementById('wk-diss').textContent = dissHrs;
  renderCWG();
}
function addCWG() { const v = document.getElementById('cw-in').value.trim(), cat = document.getElementById('cw-cat').value; if (!v) return; const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals.push({ text: v, cat, done: false }); save(wd); document.getElementById('cw-in').value = ''; renderCWG(); }
function renderCWG() {
  const wk = weekId(), wd = weekData(wk), goals = wd.weeks[wk].goals || [];
  const catMap = { work: 'work', dissertation: 'diss', italian: 'ital', social: 'social', misc: 'misc' };
  document.getElementById('cw-goals').innerHTML = goals.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No custom goals.</p>' : goals.map((g, i) => '<div class="hrow"><input type="checkbox" class="hchk" ' + (g.done ? 'checked' : '') + ' onchange="toggleCWG(' + i + ')"><div class="hinfo"><span class="label l-' + (catMap[g.cat] || 'misc') + '">' + g.cat + '</span> <span style="' + (g.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + g.text + '</span></div><button class="btn" style="font-size:10px;padding:2px 6px" onclick="rmCWG(' + i + ')">✕</button></div>').join('');
}
function toggleCWG(i) { const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals[i].done = !wd.weeks[wk].goals[i].done; save(wd); renderCWG(); }
function rmCWG(i) { const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals.splice(i, 1); save(wd); renderCWG(); }
function submitWR() {
  const well = document.getElementById('wr-well').value.trim(), bad = document.getElementById('wr-bad').value.trim(), imp = document.getElementById('wr-imp').value.trim(), push = document.getElementById('wr-push').value.trim();
  if (!well || !bad || !imp) { alert('Complete all review prompts.'); return; }
  const wk = weekId(), wd = weekData(wk); wd.weeks[wk].review = { well, bad, imp, push, ts: new Date().toISOString() }; save(wd);
  document.getElementById('wr-res').style.display = 'block'; document.getElementById('wr-res').innerHTML = '<p style="color:var(--green);font-weight:600">✅ Weekly review submitted!</p>'; addLog('action', 'Weekly review: ' + wk);
}

// ============ HABITS TAB ============
function renderHabits() {
  const habitNames = [{ key: 'anki', label: 'Anki 300', cls: 'l-ital' }, { key: 'art1', label: 'Article 1', cls: 'l-ital' }, { key: 'art2', label: 'Article 2', cls: 'l-ital' }, { key: 'gym', label: 'Workout', cls: 'l-gym' }, { key: 'diss', label: 'Dissertation', cls: 'l-diss' }, { key: 'convo', label: 'Conversation', cls: 'l-ital' }];
  const d = load(), days = d.days || {}, container = document.getElementById('habit-grids');
  let html = '';
  habitNames.forEach(h => {
    let best = 0, cur = 0, cells = '';
    for (let i = 55; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i); const key = dt.toISOString().slice(0, 10), day = days[key];
      let done = false;
      if (h.key === 'diss') { done = (d.dissSessions || []).filter(s => s.date === key).reduce((a, s) => a + s.minutes, 0) >= 30; }
      else { done = day && day.habits && day.habits[h.key]; }
      if (done) { cur++; if (cur > best) best = cur; } else { cur = 0; }
      cells += '<div class="scell ' + (done ? 'done' : '') + (key === today() ? ' today' : '') + '" title="' + key + '"></div>';
    }
    html += '<div class="card"><h3><span class="label ' + h.cls + '">' + h.label + '</span></h3><p style="font-size:12px;color:var(--muted)">🔥 Current: ' + cur + ' | 🏆 Best: ' + best + '</p><div class="sgrid">' + cells + '</div></div>';
  });
  container.innerHTML = html; renderIFT();
}
function addIFT() { const v = document.getElementById('ift-in').value.trim(); if (!v) return; const d = getGlobal(); d.ifthens.push(v); save(d); document.getElementById('ift-in').value = ''; renderIFT(); }
function renderIFT() {
  const d = getGlobal();
  document.getElementById('ifthen-list').innerHTML = (d.ifthens || []).length === 0 ? '<p style="color:var(--muted);font-size:12px;font-style:italic">Pre-register fallback plans.</p>' : d.ifthens.map((t, i) => '<div class="intention">🛡 ' + t + ' <button style="float:right;background:none;border:none;color:var(--red);cursor:pointer;font-size:10px" onclick="rmIFT(' + i + ')">✕</button></div>').join('');
}
function rmIFT(i) { const d = getGlobal(); d.ifthens.splice(i, 1); save(d); renderIFT(); }

// ============ DISSERTATION TAB ============
let dissInterval = null, dissStartTime = null, dissElapsed = 0;
function renderDiss() { renderChapters(); renderDissLog(); updateDissChapterSelect(); }
function addCh() {
  const name = document.getElementById('ch-name').value.trim(), target = parseInt(document.getElementById('ch-target').value) || 0;
  if (!name) return; const d = getGlobal(); d.chapters.push({ name, target, current: 0 }); save(d);
  document.getElementById('ch-name').value = ''; document.getElementById('ch-target').value = ''; renderChapters(); updateDissChapterSelect();
}
function renderChapters() {
  const d = getGlobal(), chs = d.chapters || []; let totalT = 0, totalC = 0, html = chs.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">Add chapters.</p>' : '';
  chs.forEach((ch, i) => { totalT += ch.target; totalC += ch.current; const pct = ch.target > 0 ? Math.min(100, Math.round(ch.current / ch.target * 100)) : 0;
    html += '<div style="margin-bottom:8px"><div class="flex" style="align-items:center"><b style="font-size:13px;flex:1">' + ch.name + '</b><input type="number" class="fin" style="width:90px" value="' + ch.current + '" onchange="updChW(' + i + ',this.value)"> / ' + ch.target + '<button class="btn" style="font-size:10px;padding:2px 6px;margin-left:4px" onclick="rmCh(' + i + ')">✕</button></div><div class="pbar"><div class="pfill" style="width:' + pct + '%"></div></div></div>'; });
  document.getElementById('ch-list').innerHTML = html;
  const tp = totalT > 0 ? Math.min(100, Math.round(totalC / totalT * 100)) : 0;
  document.getElementById('diss-pbar').style.width = tp + '%'; document.getElementById('diss-total').textContent = totalC.toLocaleString() + ' / ' + totalT.toLocaleString() + ' words (' + tp + '%)';
}
function updChW(i, val) { const d = getGlobal(); d.chapters[i].current = parseInt(val) || 0; save(d); renderChapters(); }
function rmCh(i) { const d = getGlobal(); d.chapters.splice(i, 1); save(d); renderChapters(); updateDissChapterSelect(); }
function updateDissChapterSelect() { const d = getGlobal(); document.getElementById('diss-ch-sel').innerHTML = '<option value="">Working on...</option>' + (d.chapters || []).map(ch => '<option value="' + ch.name + '">' + ch.name + '</option>').join(''); }
function dissTimer(action) {
  if (action === 'start' || action === '5min') {
    dissStartTime = Date.now(); dissElapsed = 0;
    document.getElementById('diss-start').disabled = true; document.getElementById('diss-5min').disabled = true; document.getElementById('diss-stop').disabled = false;
    document.getElementById('diss-timer-status').textContent = action === '5min' ? 'Just 5 minutes...' : '90-min deep work';
    dissInterval = setInterval(() => {
      dissElapsed = Math.floor((Date.now() - dissStartTime) / 1000);
      const h = Math.floor(dissElapsed / 3600), m = Math.floor((dissElapsed % 3600) / 60), s = dissElapsed % 60;
      document.getElementById('diss-timer').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      if (dissElapsed >= 5400) document.getElementById('diss-timer-status').textContent = '⏰ 90 min! Break time.';
    }, 1000);
  } else if (action === 'stop') {
    clearInterval(dissInterval); const mins = Math.round(dissElapsed / 60);
    const ch = document.getElementById('diss-ch-sel').value || 'Unspecified';
    const d = getGlobal(); d.dissSessions.push({ date: today(), minutes: mins, chapter: ch, ts: new Date().toISOString() }); save(d);
    document.getElementById('diss-start').disabled = false; document.getElementById('diss-5min').disabled = false; document.getElementById('diss-stop').disabled = true;
    document.getElementById('diss-timer-status').textContent = 'Logged ' + mins + ' min on "' + ch + '"';
    document.getElementById('diss-timer').textContent = '00:00:00'; dissElapsed = 0;
    addLog('action', 'Dissertation: ' + mins + ' min on ' + ch); renderDissLog();
  }
}
function renderDissLog() {
  const d = getGlobal(), sessions = (d.dissSessions || []).slice(-20).reverse();
  document.getElementById('diss-log').innerHTML = sessions.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No sessions yet.</p>' : sessions.map(s => '<div class="lentry action"><span class="lt">' + s.date + '</span> ' + s.minutes + ' min — ' + s.chapter + '</div>').join('');
}

// ============ INBOX TAB ============
function renderInbox() {
  const d = getGlobal();
  const unsorted = (d.inbox || []).filter(x => x.status === 'unsorted');
  const scheduled = (d.inbox || []).filter(x => x.status === 'scheduled');
  const someday = (d.inbox || []).filter(x => x.status === 'someday');
  document.getElementById('inbox-unsorted').innerHTML = unsorted.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">Inbox zero!</p>' : unsorted.map((x, i) => inboxItem(x, i)).join('');
  document.getElementById('inbox-scheduled').innerHTML = scheduled.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">Nothing scheduled.</p>' : scheduled.map((x, i) => inboxItem(x, i)).join('');
  document.getElementById('inbox-someday').innerHTML = someday.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">Empty.</p>' : someday.map((x, i) => inboxItem(x, i)).join('');
}
function inboxItem(x, globalIdx) {
  const d = getGlobal(), realIdx = d.inbox.indexOf(x);
  return '<div class="iitem"><span class="itxt">' + escHtml(x.text) + '</span><select onchange="moveInbox(' + realIdx + ',this.value)"><option value="unsorted"' + (x.status === 'unsorted' ? ' selected' : '') + '>Unsorted</option><option value="scheduled"' + (x.status === 'scheduled' ? ' selected' : '') + '>Scheduled</option><option value="someday"' + (x.status === 'someday' ? ' selected' : '') + '>Someday</option></select><button class="del" onclick="rmInbox(' + realIdx + ')">✕</button></div>';
}
function addInbox() { const v = document.getElementById('inbox-in').value.trim(); if (!v) return; const d = getGlobal(); d.inbox.push({ text: v, status: 'unsorted', created: new Date().toISOString() }); save(d); document.getElementById('inbox-in').value = ''; renderInbox(); addLog('action', 'Inbox: ' + v); }
function moveInbox(i, status) { const d = getGlobal(); d.inbox[i].status = status; save(d); renderInbox(); }
function rmInbox(i) { const d = getGlobal(); d.inbox.splice(i, 1); save(d); renderInbox(); }

// ============ FOCUS TAB ============
let focusInt = null, focusSec = 0, focusTotal = 1500, focusRunning = false;
function renderFocus() {
  const d = getGlobal(), dd = dayData(today());
  const dists = dd.days[today()].distractions || [];
  document.getElementById('distraction-log').innerHTML = dists.length === 0 ? '<p style="color:var(--muted);font-size:12px;font-style:italic">No distractions logged today.</p>' : dists.map(x => '<div class="lentry warning">' + escHtml(x) + '</div>').join('');
  const energies = dd.days[today()].energy || [];
  document.getElementById('energy-log').innerHTML = energies.length === 0 ? '' : energies.map(e => '<span style="margin-right:6px">' + e.time + ': ' + ['','💀','😴','😐','⚡','🔥'][e.level] + '</span>').join('');
}
function setFocus(mins) { focusTotal = mins * 60; focusSec = focusTotal; focusRunning = false; clearInterval(focusInt); updFocusDisplay(); document.getElementById('focus-status').textContent = mins + ' min focus'; }
function focusTimer(action) {
  if (action === 'start' && !focusRunning) {
    if (focusSec <= 0) focusSec = focusTotal;
    focusRunning = true;
    focusInt = setInterval(() => { focusSec--; updFocusDisplay(); if (focusSec <= 0) { clearInterval(focusInt); focusRunning = false; document.getElementById('focus-status').textContent = '🎉 Done!'; try { new Audio('data:audio/wav;base64,UklGRl9vT19teleWQVZFZm10IBAAAAAAEAABABBgAABAAAgAZGF0YQ==').play(); } catch(e) {} } }, 1000);
  } else if (action === 'pause') { clearInterval(focusInt); focusRunning = false; document.getElementById('focus-status').textContent = 'Paused'; }
  else if (action === 'reset') { clearInterval(focusInt); focusRunning = false; focusSec = focusTotal; updFocusDisplay(); document.getElementById('focus-status').textContent = 'Reset'; }
}
function updFocusDisplay() { const m = Math.floor(focusSec / 60), s = focusSec % 60; document.getElementById('focus-timer').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
function addDist() { const v = document.getElementById('dist-in').value.trim(); if (!v) return; const dd = dayData(today()); dd.days[today()].distractions.push(v); save(dd); document.getElementById('dist-in').value = ''; renderFocus(); addLog('warning', 'Distraction: ' + v); }
function logEnergy() { const level = document.getElementById('energy-level').value; const dd = dayData(today()); const now = new Date(); dd.days[today()].energy.push({ level: parseInt(level), time: now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0') }); save(dd); renderFocus(); }

// ============ CLAUDE TAB ============
function initClaude() {
  const key = localStorage.getItem('cc_apikey');
  if (key) document.getElementById('api-key').value = key;
  renderChat();
  const d = getGlobal();
  if (d.corrections && d.corrections.length > 0) {
    document.getElementById('corrections-area').innerHTML = d.corrections.slice(-5).reverse().map(c => '<div class="card mb4"><p style="font-size:11px;color:var(--muted)">' + c.date + '</p><div style="font-size:13px;white-space:pre-wrap">' + escHtml(c.response) + '</div></div>').join('');
  }
  if (d.ankiCards && d.ankiCards.length > 0) {
    document.getElementById('anki-area').innerHTML = d.ankiCards.slice(-10).reverse().map(c => '<div class="lentry" style="font-size:12px;white-space:pre-wrap">' + escHtml(c.card) + '</div>').join('');
  }
}
function saveKey() { localStorage.setItem('cc_apikey', document.getElementById('api-key').value.trim()); if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange(); }
async function callClaude(key, prompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] })
  });
  if (!resp.ok) throw new Error('API error: ' + resp.status + ' ' + (await resp.text()));
  const data = await resp.json(); return data.content[0].text;
}
function buildContext() {
  const d = load(), dd = dayData(today()), day = dd.days[today()], g = getGlobal();
  let ctx = 'User context:\n';
  ctx += '- Today: ' + today() + '\n';
  ctx += '- Habits today: ' + JSON.stringify(day.habits) + '\n';
  ctx += '- Top 3: ' + (day.top3 || []).map(t => t.text + (t.done ? ' ✓' : '')).join(', ') + '\n';
  ctx += '- Dissertation sessions today: ' + (g.dissSessions || []).filter(s => s.date === today()).reduce((a, s) => a + s.minutes, 0) + ' min\n';
  ctx += '- Chapters: ' + (g.chapters || []).map(c => c.name + ' ' + c.current + '/' + c.target).join(', ') + '\n';
  ctx += '- Inbox items: ' + (g.inbox || []).filter(x => x.status === 'unsorted').length + ' unsorted\n';
  return ctx;
}
async function sendChat() {
  const input = document.getElementById('chat-in').value.trim(); if (!input) return;
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set API key first.'); return; }
  const d = getGlobal(); d.chatHistory.push({ role: 'user', content: input }); save(d);
  document.getElementById('chat-in').value = ''; renderChat();
  try {
    const ctx = buildContext();
    const messages = d.chatHistory.slice(-10).map(m => ({ role: m.role, content: m.role === 'user' && m === d.chatHistory[d.chatHistory.length - 1] ? ctx + '\n\nUser question: ' + m.content : m.content }));
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, system: 'You are a productivity coach helping the user manage: gym 5x/week, Italian practice (Anki, articles, conversation, reflection), full-time work, dissertation writing, social life expansion, and daily tasks. Be concise, actionable, and encouraging. You have access to their current progress data.', messages })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json(); const reply = data.content[0].text;
    d.chatHistory.push({ role: 'assistant', content: reply }); save(d); renderChat();
  } catch (e) { d.chatHistory.push({ role: 'assistant', content: 'Error: ' + e.message }); save(d); renderChat(); }
}
function renderChat() {
  const d = getGlobal(), msgs = d.chatHistory || [];
  const el = document.getElementById('chat-msgs');
  el.innerHTML = msgs.length === 0 ? '<p style="color:var(--muted);font-size:13px;padding:20px;text-align:center">Ask Claude about your schedule, goals, or for advice.</p>' : msgs.slice(-20).map(m => '<div class="cmsg ' + m.role + '"><div class="bbl">' + escHtml(m.content) + '</div></div>').join('');
  el.scrollTop = el.scrollHeight;
}
function copyAnki() {
  const d = getGlobal(); const txt = (d.ankiCards || []).map(c => c.card).join('\n\n---\n\n');
  navigator.clipboard.writeText(txt).then(() => alert('Copied!')).catch(() => alert('Copy failed'));
}
function dlAnki() {
  const d = getGlobal(); const txt = (d.ankiCards || []).map(c => c.card).join('\n\n---\n\n');
  const blob = new Blob([txt], { type: 'text/plain' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'anki-cards-' + today() + '.txt'; a.click();
}

// ============ LOG TAB ============
function renderLog() {
  const d = getGlobal(), filter = document.getElementById('log-filter').value, dateF = document.getElementById('log-date-filter').value;
  let entries = d.log || [];
  if (filter !== 'all') entries = entries.filter(e => e.type === filter);
  if (dateF) entries = entries.filter(e => e.ts.startsWith(dateF));
  document.getElementById('log-entries').innerHTML = entries.length === 0 ? '<p style="color:var(--muted);font-size:13px;padding:10px">No entries.</p>' : entries.slice(0, 100).map(e => '<div class="lentry ' + e.type + '"><span class="lt">' + new Date(e.ts).toLocaleString() + '</span> ' + escHtml(e.msg) + '</div>').join('');
}
function addConfession() {
  const v = document.getElementById('confess-in').value.trim(); if (!v) return;
  addLog('confession', v); document.getElementById('confess-in').value = ''; renderLog();
}
function exportData() {
  const d = load(); const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cmdcenter-' + today() + '.json'; a.click();
}
function importData(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) { try { const d = JSON.parse(e.target.result); save(d); location.reload(); } catch (err) { alert('Invalid JSON'); } };
  reader.readAsText(file);
}

// ============ UTILS ============
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ============ AUTO-SEAL MIDNIGHT ============
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yk = yesterday.toISOString().slice(0, 10);
    const dd = dayData(yk);
    if (!dd.days[yk].sealed) { dd.days[yk].sealed = true; save(dd); addLog('sealed', 'Auto-sealed: ' + yk); }
  }
}, 60000);

// ============ LOAD ALL (called by FirebaseSync on remote update) ============
function loadAll() {
  initToday();
  const key = localStorage.getItem('cc_apikey');
  if (key) document.getElementById('api-key').value = key;
  // Re-render whichever tab is active
  const active = document.querySelector('.tab.active');
  if (active) {
    const id = active.id.replace('tab-', '');
    if (id === 'habits') renderHabits();
    if (id === 'week') renderWeek();
    if (id === 'log') renderLog();
    if (id === 'dissertation') renderDiss();
    if (id === 'inbox') renderInbox();
    if (id === 'focus') renderFocus();
    if (id === 'claude') initClaude();
  }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function() {
  loadAll();
});
