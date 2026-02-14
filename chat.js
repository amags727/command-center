// ============ CHAT / CLAUDE MODULE ============
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
async function callClaude(key, prompt, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens || 4096, messages: [{ role: 'user', content: prompt }] })
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

