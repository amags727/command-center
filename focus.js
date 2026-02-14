// ============ FOCUS MODULE ============
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

