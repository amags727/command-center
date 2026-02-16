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
  const names = ['today','week','dissertation','cards','translate','claude','meals','log'];
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
}

// ============ WEEK ARCHIVE SYSTEM ============
function buildWeekSnapshot(wkId) {
  const d = load(), days = d.days || {};
  let gym=0, anki=0, art=0, convo=0, refl=0;
  const dailyNotes = [];
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(wkId); dt.setDate(dt.getDate() + i);
    const key = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
    const day = days[key];
    if (day && day.habits) { if(day.habits.gym)gym++; if(day.habits.anki)anki++; if(day.habits.art1)art++; if(day.habits.art2)art++; if(day.habits.convo)convo++; }
    if (day && day.reflection && day.reflection.trim().split(/\s+/).filter(w=>w).length >= 200) refl++;
    const notes = day && day.notes;
    if (notes && notes.replace(/<[^>]*>/g,'').trim()) {
      dailyNotes.push({ date: key, label: dayNames[dt.getDay()]+', '+dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}), notes });
    }
  }
  const dissHrs = ((d.dissSessions||[]).filter(s => { const sd=new Date(s.date), wkd=new Date(wkId); return sd>=wkd && sd<new Date(wkd.getTime()+7*86400000); }).reduce((a,s)=>a+s.minutes,0)/60).toFixed(1);
  const wd = d.weeks && d.weeks[wkId] || { goals:[], review:null };
  const wg = d.weekGoals && d.weekGoals[wkId] || {};
  return {
    weekId: wkId,
    stats: { gym, anki, art, convo, refl, dissHrs },
    customGoals: wd.goals || [],
    weekGoals: { work: wg.work||'', school: wg.school||'', life: wg.life||'' },
    dailyNotes,
    review: wd.review || null,
    archivedAt: new Date().toISOString()
  };
}

function archiveWeek(wkId) {
  const d = load();
  if (!d.weekArchives) d.weekArchives = {};
  if (d.weekArchives[wkId]) return d.weekArchives[wkId]; // already archived
  const snap = buildWeekSnapshot(wkId);
  d.weekArchives[wkId] = snap;
  d.lastSeenWeek = weekId();
  save(d);
  addLog('action', 'Week archived: ' + wkId);
  return snap;
}

function generateWeekEmailBody(snap) {
  const s = snap.stats;
  let body = '=== WEEKLY SUMMARY: Week of ' + snap.weekId + ' ===\n\n';
  body += '--- HABIT TRACKER ---\n';
  body += 'Gym: ' + s.gym + '/5\n';
  body += 'Anki: ' + s.anki + '/7\n';
  body += 'Articles: ' + s.art + '/14\n';
  body += 'Conversation: ' + s.convo + '/2\n';
  body += 'Reflection: ' + s.refl + '/7\n';
  body += 'Dissertation: ' + s.dissHrs + 'hr\n\n';
  function stripHtml(h) { const t = document.createElement('div'); t.innerHTML = h; return t.textContent || t.innerText || ''; }
  if (snap.weekGoals.work) body += '--- WORK GOALS ---\n' + stripHtml(snap.weekGoals.work) + '\n\n';
  if (snap.weekGoals.school) body += '--- SCHOOL GOALS ---\n' + stripHtml(snap.weekGoals.school) + '\n\n';
  if (snap.weekGoals.life) body += '--- LIFE GOALS ---\n' + stripHtml(snap.weekGoals.life) + '\n\n';
  if (snap.customGoals.length) {
    body += '--- CUSTOM WEEKLY GOALS ---\n';
    snap.customGoals.forEach(g => { body += (g.done?'[x]':'[ ]') + ' [' + g.cat + '] ' + g.text + '\n'; });
    body += '\n';
  }
  if (snap.dailyNotes.length) {
    body += '--- DAILY NOTES ---\n';
    snap.dailyNotes.forEach(n => { body += n.label + ':\n' + stripHtml(n.notes) + '\n\n'; });
  }
  if (snap.review) {
    body += '--- WEEKLY REVIEW ---\n';
    body += 'What went well: ' + snap.review.well + '\n';
    body += 'What went badly: ' + snap.review.bad + '\n';
    body += 'Key improvement: ' + snap.review.imp + '\n';
    if (snap.review.push) body += 'Push goal: ' + snap.review.push + '\n';
  }
  return body;
}

function sendWeekEmail(snap) {
  const subject = encodeURIComponent('Weekly Summary: Week of ' + snap.weekId);
  const body = encodeURIComponent(generateWeekEmailBody(snap));
  window.open('mailto:xmagnuson@gmail.com?subject=' + subject + '&body=' + body, '_blank');
}

function checkWeekTransition() {
  const d = load();
  const curWeek = weekId();
  if (d.lastSeenWeek && d.lastSeenWeek !== curWeek) {
    const prevWeek = d.lastSeenWeek;
    if (!d.weekArchives || !d.weekArchives[prevWeek]) {
      const snap = archiveWeek(prevWeek);
      sendWeekEmail(snap);
    }
  }
  if (!d.lastSeenWeek) { d.lastSeenWeek = curWeek; save(d); }
}

function manualArchiveWeek() {
  const wk = weekId();
  const d = load();
  if (d.weekArchives && d.weekArchives[wk]) {
    if (!confirm('This week is already archived. Re-archive with current data?')) return;
    d.weekArchives[wk] = null; save(d);
  }
  const snap = archiveWeek(wk);
  alert('Week archived! Opening email...');
  sendWeekEmail(snap);
  if (document.querySelector('.tab.active')?.id === 'tab-log') renderLog();
}

// ============ LOG TAB ============
function renderLog() {
  const d = getGlobal(), filter = document.getElementById('log-filter').value, dateF = document.getElementById('log-date-filter').value;
  let entries = d.log || [];
  if (filter !== 'all') entries = entries.filter(e => e.type === filter);
  if (dateF) entries = entries.filter(e => e.ts.startsWith(dateF));
  document.getElementById('log-entries').innerHTML = entries.length === 0 ? '<p style="color:var(--muted);font-size:13px;padding:10px">No entries.</p>' : entries.slice(0, 100).map(e => '<div class="lentry ' + e.type + '"><span class="lt">' + new Date(e.ts).toLocaleString() + '</span> ' + escHtml(e.msg) + '</div>').join('');
  renderWeekArchives();
}

function renderWeekArchives() {
  const container = document.getElementById('week-archives');
  if (!container) return;
  const d = load();
  const archives = d.weekArchives || {};
  const weekIds = Object.keys(archives).sort().reverse();
  if (!weekIds.length) { container.innerHTML = '<p style="color:var(--muted);font-size:13px;font-style:italic;padding:10px">No archived weeks yet.</p>'; return; }

  // Group by year → month
  const tree = {};
  weekIds.forEach(wk => {
    const dt = new Date(wk);
    const yr = dt.getFullYear();
    const mo = dt.getMonth(); // 0-11
    if (!tree[yr]) tree[yr] = {};
    if (!tree[yr][mo]) tree[yr][mo] = [];
    tree[yr][mo].push(wk);
  });

  const moNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let html = '';
  const years = Object.keys(tree).sort().reverse();
  years.forEach(yr => {
    html += '<details class="archive-year" style="margin-bottom:4px"><summary style="cursor:pointer;font-weight:700;font-size:15px;padding:6px 0">📅 ' + yr + '</summary><div style="padding-left:12px">';
    const months = Object.keys(tree[yr]).sort((a,b)=>b-a);
    months.forEach(mo => {
      html += '<details class="archive-month" style="margin-bottom:4px"><summary style="cursor:pointer;font-weight:600;font-size:14px;padding:4px 0">' + moNames[mo] + '</summary><div style="padding-left:12px">';
      tree[yr][mo].forEach(wk => {
        const snap = archives[wk];
        const s = snap.stats;
        function stripH(h){const t=document.createElement('div');t.innerHTML=h;return t.textContent||'';}
        html += '<details class="archive-week card" style="margin-bottom:6px"><summary style="cursor:pointer;font-weight:600;font-size:13px">Week of ' + wk + '</summary><div style="padding:8px;font-size:13px;line-height:1.6">';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:8px">';
        html += '<span>🏋️ Gym: <b>'+s.gym+'/5</b></span>';
        html += '<span>📚 Anki: <b>'+s.anki+'/7</b></span>';
        html += '<span>📰 Articles: <b>'+s.art+'/14</b></span>';
        html += '<span>🗣️ Convo: <b>'+s.convo+'/2</b></span>';
        html += '<span>✍️ Reflection: <b>'+s.refl+'/7</b></span>';
        html += '<span>📖 Diss: <b>'+s.dissHrs+'hr</b></span>';
        html += '</div>';
        if (snap.weekGoals.work) html += '<div style="margin-bottom:6px"><b>Work Goals:</b><div style="padding:4px 8px;background:#f9f9f9;border-radius:4px;margin-top:2px">' + snap.weekGoals.work + '</div></div>';
        if (snap.weekGoals.school) html += '<div style="margin-bottom:6px"><b>School Goals:</b><div style="padding:4px 8px;background:#f9f9f9;border-radius:4px;margin-top:2px">' + snap.weekGoals.school + '</div></div>';
        if (snap.weekGoals.life) html += '<div style="margin-bottom:6px"><b>Life Goals:</b><div style="padding:4px 8px;background:#f9f9f9;border-radius:4px;margin-top:2px">' + snap.weekGoals.life + '</div></div>';
        if (snap.customGoals.length) {
          html += '<div style="margin-bottom:6px"><b>Custom Goals:</b>';
          snap.customGoals.forEach(g => { html += '<div style="padding:2px 0">' + (g.done?'✅':'⬜') + ' <span class="label l-'+(g.cat==='work'?'work':g.cat==='dissertation'?'diss':g.cat==='italian'?'ital':g.cat==='social'?'social':'misc')+'" style="font-size:10px">'+g.cat+'</span> '+(g.done?'<s>':'')+escHtml(g.text)+(g.done?'</s>':'')+'</div>'; });
          html += '</div>';
        }
        if (snap.dailyNotes.length) {
          html += '<details style="margin-bottom:6px"><summary style="cursor:pointer;font-weight:600;font-size:12px">Daily Notes ('+snap.dailyNotes.length+')</summary>';
          snap.dailyNotes.forEach(n => { html += '<div style="margin:4px 0"><b>'+escHtml(n.label)+'</b><div style="padding:4px 8px;background:#f9f9f9;border-radius:4px">'+n.notes+'</div></div>'; });
          html += '</details>';
        }
        if (snap.review) {
          html += '<details style="margin-bottom:6px"><summary style="cursor:pointer;font-weight:600;font-size:12px">Weekly Review</summary>';
          html += '<div style="padding:4px"><b>Went well:</b> '+escHtml(snap.review.well)+'<br><b>Went badly:</b> '+escHtml(snap.review.bad)+'<br><b>Improve:</b> '+escHtml(snap.review.imp);
          if (snap.review.push) html += '<br><b>Push goal:</b> '+escHtml(snap.review.push);
          html += '</div></details>';
        }
        html += '<div style="text-align:right;margin-top:4px"><button class="btn btn-s" onclick="sendWeekEmail(load().weekArchives[\''+wk+'\'])" style="font-size:11px">📧 Re-send Email</button></div>';
        html += '</div></details>';
      });
      html += '</div></details>';
    });
    html += '</div></details>';
  });
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
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.code === 'Digit8' || e.code === 'Digit7')) {
      e.preventDefault();
      document.execCommand(e.code === 'Digit7' ? 'insertOrderedList' : 'insertUnorderedList');
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
  checkWeekTransition();
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
