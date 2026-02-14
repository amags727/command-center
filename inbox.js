// ============ INBOX MODULE ============
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

