// ============ WEEK MODULE ============
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
  renderDailySummaries();
}
function addCWG() { const v = document.getElementById('cw-in').value.trim(), cat = document.getElementById('cw-cat').value; if (!v) return; const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals.push({ text: v, cat, done: false }); save(wd); document.getElementById('cw-in').value = ''; renderCWG(); }
function renderDailySummaries() {
  const btnBar = document.getElementById('ds-buttons');
  const content = document.getElementById('ds-content');
  if (!btnBar || !content) return;
  const wk = weekId();
  const mon = new Date(wk);
  const d = load();
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const todayKey = today();
  const todayDate = new Date(todayKey);
  btnBar.innerHTML = '';
  // Build day info array
  const dayInfos = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    const key = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    const notes = d.days && d.days[key] && d.days[key].notes;
    const hasNotes = notes && notes.replace(/<[^>]*>/g,'').trim();
    const isFuture = dt > todayDate;
    const isToday = key === todayKey;
    dayInfos.push({ key, label: dayNames[i], dt, notes, hasNotes, isFuture, isToday });
  }
  dayInfos.forEach((info, i) => {
    const btn = document.createElement('button');
    btn.textContent = info.label;
    btn.className = 'btn btn-s';
    btn.style.cssText = 'font-size:11px;padding:4px 10px;border-radius:12px;' +
      (info.isToday ? 'border-color:var(--blue);font-weight:700;' : '') +
      (info.hasNotes ? 'background:var(--gl);border-color:var(--green);' : '') +
      (info.isFuture ? 'opacity:0.5;' : '');
    btn.onclick = function() { showDaySummary(i, dayInfos); };
    btnBar.appendChild(btn);
  });
  // Default: show most recent past day with notes, or Monday
  let defaultIdx = 0;
  for (let i = dayInfos.length - 1; i >= 0; i--) {
    if (dayInfos[i].hasNotes && !dayInfos[i].isToday) { defaultIdx = i; break; }
  }
  showDaySummary(defaultIdx, dayInfos);
}
function showDaySummary(idx, dayInfos) {
  const content = document.getElementById('ds-content');
  const btnBar = document.getElementById('ds-buttons');
  if (!content || !btnBar) return;
  // Update button active state
  Array.from(btnBar.children).forEach((btn, i) => {
    btn.style.outline = i === idx ? '2px solid var(--blue)' : 'none';
    btn.style.outlineOffset = i === idx ? '1px' : '0';
  });
  const info = dayInfos[idx];
  const fullDay = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][idx];
  const dateStr = info.dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const header = '<div style="font-weight:600;margin-bottom:6px;font-size:14px">' + fullDay + ', ' + dateStr + '</div>';
  if (info.isToday) {
    content.innerHTML = header + '<p style="color:var(--muted);font-style:italic">Today — notes will appear here after the day is saved.</p>';
  } else if (info.isFuture) {
    content.innerHTML = header + '<p style="color:var(--muted);font-style:italic">This day hasn\'t happened yet.</p>';
  } else if (info.hasNotes) {
    content.innerHTML = header + info.notes;
  } else {
    content.innerHTML = header + '<p style="color:var(--muted);font-style:italic">No notes were logged for this day.</p>';
  }
}
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

