// ============ NAV ============
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  const btns = document.querySelectorAll('.nav button');
  const names = ['today','week','dissertation','cards','translate','claude','log'];
  const idx = names.indexOf(id);
  if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');
  if (id === 'today') initToday();
  if (id === 'week') renderWeek();
  if (id === 'log') renderLog();
  if (id === 'dissertation') renderDiss();
  if (id === 'cards') renderCards();
  if (id === 'translate') renderTranslate();
  if (id === 'claude') initClaude();
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

// ============ UTILS (escHtml now in core.js) ============

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
  trUpdateSubmitBtn();
  const key = localStorage.getItem('cc_apikey');
  if (key) document.getElementById('api-key').value = key;
  // Re-render whichever tab is active
  const active = document.querySelector('.tab.active');
  if (active) {
    const id = active.id.replace('tab-', '');
    if (id === 'week') renderWeek();
    if (id === 'log') renderLog();
    if (id === 'dissertation') renderDiss();
    if (id === 'cards') renderCards();
    if (id === 'claude') initClaude();
  }
}

// ============ NOTES (Today + Week) ============
function saveTodayNotes() {
  const el = document.getElementById('today-notes');
  if (!el) return;
  const dd = dayData(today());
  dd.days[today()].notes = el.innerHTML;
  save(dd);
}
function loadTodayNotes() {
  const dd = dayData(today());
  const el = document.getElementById('today-notes');
  if (el && dd.days[today()].notes) el.innerHTML = dd.days[today()].notes;
}

// ============ KEYBOARD SHORTCUTS ============

// Helper: get the closest list item ancestor of the current selection
function _notesListContext() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let node = sel.anchorNode;
  while (node && node !== document) {
    if (node.nodeName === 'LI') return node;
    node = node.parentNode;
  }
  return null;
}

// Tab indent / Shift-Tab outdent inside contenteditable notes
function _handleNotesTab(e) {
  const el = document.activeElement;
  if (!el || el.getAttribute('contenteditable') !== 'true') return;

  const isToday = (el.id === 'today-notes');
  const isWgEditor = el.classList.contains('wg-editor');
  if (!isToday && !isWgEditor) return;

  const li = _notesListContext();
  if (!li) return; // only act when cursor is in a list item

  e.preventDefault();

  if (e.shiftKey) {
    document.execCommand('outdent');
  } else {
    document.execCommand('indent');
  }

  // Fire correct save
  if (isToday) { saveTodayNotes(); }
  else if (isWgEditor) {
    const cat = el.id.replace('wg-','');
    if (typeof saveWeekGoals === 'function') saveWeekGoals(cat);
  }
}

// Auto-detect "1." or "1)" at the start of a line and convert to ordered list
function _handleAutoNumberedList(e) {
  const el = e.target;
  if (!el || el.getAttribute('contenteditable') !== 'true') return;
  const isToday = (el.id === 'today-notes');
  const isWg = el.classList.contains('wg-editor');
  if (!isToday && !isWg) return;

  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const anchor = sel.anchorNode;
  if (!anchor || anchor.nodeType !== 3) return; // text node only

  const text = anchor.textContent;
  // Match "1." or "1)" at start of text node (possibly with leading whitespace)
  if (/^\s*1[.)]\s$/.test(text)) {
    // Clear the typed "1. " or "1) "
    anchor.textContent = '';
    // Insert ordered list via execCommand
    document.execCommand('insertOrderedList');
    // Fire save
    if (isToday) saveTodayNotes();
    else if (isWg && typeof saveWeekGoals === 'function') saveWeekGoals(el.id.replace('wg-',''));
  }
}

document.addEventListener('keydown', function(e) {
  // Tab handling for notes lists
  if (e.key === 'Tab') {
    _handleNotesTab(e);
    // If we handled it (preventDefault was called), return
    if (e.defaultPrevented) return;
  }

  // Notes rich-text shortcuts (only when inside contenteditable)
  const el = document.activeElement;
  if (el && el.getAttribute('contenteditable') === 'true') {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Digit8') {
      e.preventDefault(); document.execCommand('insertUnorderedList');
      // Save the appropriate editor
      if (el.id === 'today-notes') saveTodayNotes();
      else if (el.classList.contains('wg-editor') && typeof saveWeekGoals === 'function') {
        saveWeekGoals(el.id.replace('wg-',''));
      }
    }
    return; // don't process card shortcuts while editing
  }
  // Card study shortcuts (only when study area visible)
  const studyArea = document.getElementById('study-area');
  if (studyArea && studyArea.style.display !== 'none') {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); flipCard(); }
    else if (studyFlipped && e.key === '1') { e.preventDefault(); rateCard(1); }
    else if (studyFlipped && e.key === '2') { e.preventDefault(); rateCard(2); }
    else if (studyFlipped && e.key === '3') { e.preventDefault(); rateCard(3); }
    else if (studyFlipped && e.key === '4') { e.preventDefault(); rateCard(4); }
  }
});

// ============ SYNC UI ============
async function doSyncConnect() {
  const pass = document.getElementById('sync-pass').value.trim();
  if (!pass) { alert('Enter a sync passphrase.'); return; }
  if (typeof FirebaseSync === 'undefined') { alert('Firebase not loaded.'); return; }
  const ok = await FirebaseSync.connect(pass);
  if (ok) {
    document.getElementById('sync-pass').style.display = 'none';
    document.querySelector('.sync-bar .btn-sync').style.display = 'none';
    document.getElementById('sync-disc-btn').style.display = '';
  }
}
function doSyncDisconnect() {
  if (!confirm('Disconnect sync? Data stays local.')) return;
  FirebaseSync.disconnect();
  document.getElementById('sync-pass').style.display = '';
  document.getElementById('sync-pass').value = '';
  document.querySelector('.sync-bar .btn-sync').style.display = '';
  document.getElementById('sync-disc-btn').style.display = 'none';
}
function initSyncUI() {
  if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isConnected()) {
    document.getElementById('sync-pass').style.display = 'none';
    document.querySelector('.sync-bar .btn-sync').style.display = 'none';
    document.getElementById('sync-disc-btn').style.display = '';
  }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Firebase Sync
  if (typeof FirebaseSync !== 'undefined') FirebaseSync.init().then(() => initSyncUI());
  // Clear stale Anki target cache (forces recalc with review-cap fix)
  const ankiKey = 'anki_target_' + today();
  const cached = parseInt(localStorage.getItem(ankiKey));
  if (cached > 0) {
    const d = getCards();
    const settings = d.cardSettings || { newPerDay: 20 };
    const reviewCap = settings.newPerDay * 10;
    if (cached > reviewCap) localStorage.removeItem(ankiKey);
  }
  loadAll();
  loadTodayNotes();
  // Article of the Day — runs once daily on launch
  fetchArticleOfTheDay(false);
  // Auto-numbered list detection on notes and weekly goal editors
  ['today-notes','wg-work','wg-school','wg-life'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', _handleAutoNumberedList);
  });
});
