// ============ FORCE UPDATE (mobile Cmd+Shift+R equivalent) ============
function forceUpdate() {
  if (!confirm('Clear cache and reload? This fetches the latest version.')) return;
  const btn = document.querySelector('[onclick="forceUpdate()"]');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  Promise.all([
    // Unregister all service workers
    navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(regs =>
      Promise.all(regs.map(r => r.unregister()))
    ) : Promise.resolve(),
    // Delete all caches
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
  ]).then(() => {
    window.location.reload(true);
  }).catch(() => {
    window.location.reload(true);
  });
}

// ============ NAV ============
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  const btns = document.querySelectorAll('.nav button');
  const names = ['today','week','dissertation','cards','translate','claude','meals','progress','log'];
  const idx = names.indexOf(id);
  if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');
  if (id === 'today') initToday();
  if (id === 'week') renderWeek();
  if (id === 'log') renderLog();
  if (id === 'meals') renderMeals();
  if (id === 'dissertation') renderDiss();
  if (id === 'cards') renderCards();
  if (id === 'translate') renderTranslate();
  if (id === 'claude') initClaude();
  if (id === 'progress') renderProgress();
}

// ============ LOG TAB ============
function renderLog() {
  const d = getGlobal(), filter = document.getElementById('log-filter').value, dateF = document.getElementById('log-date-filter').value;
  let entries = d.log || [];
  if (filter !== 'all') entries = entries.filter(e => e.type === filter);
  if (dateF) entries = entries.filter(e => e.ts.startsWith(dateF));
  document.getElementById('log-entries').innerHTML = entries.length === 0 ? '<p style="color:var(--muted);font-size:13px;padding:10px">No entries.</p>' : entries.slice(0, 100).map(e => '<div class="lentry ' + e.type + '"><span class="lt">' + new Date(e.ts).toLocaleString() + '</span> ' + escHtml(e.msg) + '</div>').join('');
  renderMemoryList();
  renderWeekArchives();
}

function renderMemoryList() {
  const container = document.getElementById('memory-list-container');
  if (!container) return;
  
  const d = load();
  if (!d.weeks) {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);font-style:italic">No memory goals yet.</p>';
    return;
  }
  
  const weeksWithGoals = Object.keys(d.weeks)
    .filter(wk => d.weeks[wk].stretchGoals?.goals)
    .sort((a, b) => b.localeCompare(a));
  
  if (!weeksWithGoals.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);font-style:italic">No memory goals yet.</p>';
    return;
  }
  
  const html = weeksWithGoals.map(wk => {
    const sg = d.weeks[wk].stretchGoals;
    const completed = sg.goals.filter(g => g.completed).length;
    const total = sg.goals.length;
    const statusBadge = completed === total ? '<span style="color:var(--green);font-weight:600">✓ Complete</span>' : '<span style="color:var(--orange)">' + completed + '/' + total + ' Complete</span>';
    
    const goalsHtml = sg.goals.map(g => {
      const typeIcon = g.type === 'italian-media' ? '📚' : '🎯';
      const status = g.completed ? '✓' : '○';
      const statusColor = g.completed ? 'var(--green)' : 'var(--muted)';
      
      let evidenceHtml = '';
      if (g.completed && g.completionEvidence) {
        const ev = g.completionEvidence;
        
        // Photos
        if (ev.images && ev.images.length) {
          const photosHtml = ev.images.map(img => 
            `<img src="${img}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--border);margin-right:4px;margin-top:4px">`
          ).join('');
          evidenceHtml += `<div style="margin-top:6px">${photosHtml}</div>`;
        }
        
        // Reflection
        if (ev.reflection) {
          evidenceHtml += `<div style="margin-top:6px;font-size:12px;font-style:italic;color:var(--muted);border-left:2px solid var(--border);padding-left:8px">"${escHtml(ev.reflection.substring(0, 150))}${ev.reflection.length > 150 ? '...' : ''}"</div>`;
        }
        
        // Composition (Italian media)
        if (ev.composition) {
          evidenceHtml += `<div style="margin-top:6px;font-size:12px;font-style:italic;color:var(--muted);border-left:2px solid var(--purple);padding-left:8px">"${escHtml(ev.composition.substring(0, 150))}${ev.composition.length > 150 ? '...' : ''}"</div>`;
        }
      }
      
      return `<li style="margin-bottom:10px;color:${statusColor}"><span style="font-size:16px">${status}</span> ${typeIcon} ${escHtml(g.text)}${evidenceHtml}</li>`;
    }).join('');
    
    return `
      <details class="memory-week-item" style="margin-bottom:12px">
        <summary style="cursor:pointer;font-weight:600;font-size:14px;padding:8px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">
          <span>Week of ${wk}</span>
          <span style="float:right">${statusBadge}</span>
        </summary>
        <div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px">
          <ul style="list-style:none;padding:0;margin:0">${goalsHtml}</ul>
        </div>
      </details>
    `;
  }).join('');
  
  container.innerHTML = html;
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
  // Suppress lastMod stamping during re-render so stale data doesn't
  // get a fresh timestamp and win future merges
  suppressLastMod(true);
  try {
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
  } finally {
    suppressLastMod(false);
  }
}

// ============ NOTES (Today + Week) ============
function saveTodayNotes() {
  const el = document.getElementById('today-notes');
  if (!el) return;
  const dd = dayData(today());
  dd.days[today()].notes = el.innerHTML;
  dd.days[today()].notesMod = Date.now();
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

  // Always prevent default Tab inside our editors (prevents focus leaving)
  e.preventDefault();

  const li = _notesListContext();

  if (li) {
    // Inside a list item: do proper DOM-based indent/outdent
    const sel = window.getSelection();
    const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    if (e.shiftKey) {
      // OUTDENT: move li out of its nested list into the grandparent list
      const parentList = li.parentNode;
      const grandLi = parentList.parentNode;
      if (grandLi && grandLi.nodeName === 'LI') {
        const grandList = grandLi.parentNode;
        grandList.insertBefore(li, grandLi.nextSibling);
        if (parentList.children.length === 0) parentList.remove();
      }
    } else {
      // INDENT: move li into a nested list inside its previous sibling
      const prevLi = li.previousElementSibling;
      if (prevLi && prevLi.nodeName === 'LI') {
        const parentList = li.parentNode;
        const listTag = parentList.nodeName;
        let nestedList = prevLi.querySelector(':scope > ul, :scope > ol');
        if (!nestedList) {
          nestedList = document.createElement(listTag);
          prevLi.appendChild(nestedList);
        }
        nestedList.appendChild(li);
      }
    }

    // Restore cursor position
    if (range) {
      try { sel.removeAllRanges(); sel.addRange(range); } catch(_) {}
    }
  } else {
    // Not inside a list item: use execCommand as fallback
    if (e.shiftKey) {
      document.execCommand('outdent');
    } else {
      document.execCommand('indent');
    }
  }

  // Fire correct save
  if (isToday) { saveTodayNotes(); }
  else if (isWgEditor) {
    const cat = el.id.replace('week-goals-','');
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
    else if (isWg && typeof saveWeekGoals === 'function') saveWeekGoals(el.id.replace('week-goals-',''));
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
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.code === 'Digit8' || e.code === 'Digit7')) {
      e.preventDefault();
      document.execCommand(e.code === 'Digit7' ? 'insertOrderedList' : 'insertUnorderedList');
      // Save the appropriate editor
      if (el.id === 'today-notes') saveTodayNotes();
      else if (el.classList.contains('wg-editor') && typeof saveWeekGoals === 'function') {
        saveWeekGoals(el.id.replace('week-goals-',''));
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

// ============ STRETCH GOALS SITE LOCK ============
function checkSiteLock() {
  const wk = weekId();
  const hasGoals = hasStretchGoals(wk);
  const modal = document.getElementById('site-lock-modal');
  
  if (!hasGoals) {
    // Site is locked - show modal and disable interactions
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('site-locked');
  } else {
    // Site is unlocked
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('site-locked');
  }
}

function goToWeekTab() {
  const modal = document.getElementById('site-lock-modal');
  if (modal) modal.style.display = 'none';
  switchTab('week');
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
  checkWeekTransition();
  loadAll();
  loadTodayNotes();
  // Article of the Day — runs once daily on launch
  fetchArticleOfTheDay(false);
  // Auto-numbered list detection on notes and weekly goal editors
  ['today-notes','week-goals-work','week-goals-school','week-goals-life'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', _handleAutoNumberedList);
  });
  // Check if site should be locked
  checkSiteLock();
  // Add CSS animation for celebration
  const style = document.createElement('style');
  style.textContent = '@keyframes sgFadeOut { 0% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }';
  document.head.appendChild(style);
});
