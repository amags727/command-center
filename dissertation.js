// ============ DISSERTATION MODULE ============
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

