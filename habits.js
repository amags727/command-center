// ============ HABITS MODULE ============
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

