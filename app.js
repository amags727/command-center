// ============ DATA LAYER ============
const KEY = 'cmdcenter';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); if (typeof FirebaseSync !== 'undefined') FirebaseSync.onChange(); }
function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function weekId(d) { const dt = new Date(d || today()); const day = dt.getDay(); const diff = dt.getDate() - day + (day === 0 ? -6 : 1); const mon = new Date(dt.setDate(diff)); return mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0'); }
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
  // Backfill article habits from readingHistory
  const rh = dd.readingHistory || [];
  const todaysArticles = rh.filter(a => a.date === today());
  if (todaysArticles.length >= 1 && !day.habits.art1) {
    day.habits.art1 = true;
    day.habits.art1Title = todaysArticles[0].title || 'Completed';
    save(dd);
  }
  if (todaysArticles.length >= 2 && !day.habits.art2) {
    day.habits.art2 = true;
    day.habits.art2Title = todaysArticles[1].title || 'Completed';
    save(dd);
  }
  ['anki','art1','art2'].forEach(h => {
    const el = document.getElementById('h-' + h);
    if (el && day.habits[h]) el.checked = true;
    if (day.sealed) el && (el.disabled = true);
  });
  if (day.habits.ankiCount) document.getElementById('anki-ct').textContent = day.habits.ankiCount;
  if (day.habits.art1Title) document.getElementById('art1-t').value = day.habits.art1Title;
  if (day.habits.art1Thoughts) document.getElementById('art1-th').value = day.habits.art1Thoughts;
  if (day.habits.art2Title) document.getElementById('art2-t').value = day.habits.art2Title;
  if (day.habits.art2Thoughts) document.getElementById('art2-th').value = day.habits.art2Thoughts;
  // Update article status labels from stored data
  if (day.habits.art1) {
    const st = document.getElementById('art1-status');
    if (st) st.textContent = '✅ ' + (day.habits.art1Title || 'Completed');
  }
  if (day.habits.art2) {
    const st = document.getElementById('art2-status');
    if (st) st.textContent = '✅ ' + (day.habits.art2Title || 'Completed');
  }
  if (day.reflection) document.getElementById('refl-txt').value = day.reflection;
  updRC();
  renderBlocks(); loadT3Intentions();
  const wk = weekId();
  const wd = weekData(wk);
  if (wd.weeks[wk].pushGoal) {
    document.getElementById('pgb').style.display = 'block';
    document.getElementById('pg-text').textContent = wd.weeks[wk].pushGoal;
    const endOfWeek = new Date(wk); endOfWeek.setDate(endOfWeek.getDate() + 6);
    document.getElementById('pg-countdown').textContent = Math.max(0, Math.ceil((endOfWeek - new Date()) / 86400000)) + ' days left this week';
  }
  if (day.sealed) lockToday();
  // Populate Anki count/target from cards data
  const totalReviewed = getTotalReviewedToday();
  updateAnkiHabitFromCards(totalReviewed);
}

function lockToday() {
  document.querySelectorAll('#tab-today input, #tab-today textarea, #tab-today select').forEach(el => el.disabled = true);
  document.querySelectorAll('#tab-today button').forEach(el => { if (!el.closest('.nav')) el.disabled = true; });
}

function gateHabit(type) {
  const dd = dayData(today()); const day = dd.days[today()];
  if (type === 'anki') {
    const ct = parseInt(document.getElementById('anki-ct').textContent) || 0;
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

// ============ DAY CALENDAR ============
const CAL = {
  START_HOUR: 6, END_HOUR: 23, PX_PER_HOUR: 60, SNAP_MIN: 30,
  ZOOM_LEVELS: [30, 45, 60, 90, 120],
  dragging: null, resizing: null, popover: null, viewDate: null
};
function calZoom(dir) {
  const idx = CAL.ZOOM_LEVELS.indexOf(CAL.PX_PER_HOUR);
  const next = idx + dir;
  if (next >= 0 && next < CAL.ZOOM_LEVELS.length) {
    CAL.PX_PER_HOUR = CAL.ZOOM_LEVELS[next];
    renderCal();
  }
}
function calViewDate() { return CAL.viewDate || today(); }
function calSetDate(offset) {
  const cur = new Date(calViewDate() + 'T12:00:00');
  cur.setDate(cur.getDate() + offset);
  CAL.viewDate = cur.toISOString().slice(0, 10);
  renderCal();
}
function calGoToday() { CAL.viewDate = null; renderCal(); }
function calMinToY(min) { return (min - CAL.START_HOUR * 60) * CAL.PX_PER_HOUR / 60; }
function calYToMin(y) { const raw = y * 60 / CAL.PX_PER_HOUR + CAL.START_HOUR * 60; return Math.round(raw / CAL.SNAP_MIN) * CAL.SNAP_MIN; }
function calMinToTime(m) { const h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0'); }
function calTimeFmt(m) { const h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'pm' : 'am'; return ((h % 12) || 12) + (mm ? ':' + String(mm).padStart(2,'0') : '') + ap; }

function getCalBlocks(date) {
  const dd = dayData(date), day = dd.days[date];
  // Migrate old blocks to calendar format
  if (day.blocks && day.blocks.length > 0 && !day.calBlocks) {
    day.calBlocks = day.blocks.map((b, i) => {
      const parts = (b.time || '09:00').split(':'); const startMin = parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
      return { id: 'migrated_' + i + '_' + Date.now(), title: b.desc, cat: b.cat || 'misc', startMin, endMin: startMin + 60 };
    });
    save(dd);
  }
  if (!day.calBlocks) day.calBlocks = [];
  // Merge recurring blocks
  const d = load(); const recur = d.recurringBlocks || [];
  const dow = new Date(date + 'T12:00:00').getDay(); // 0=Sun — use noon to avoid UTC date shift
  const effective = [...day.calBlocks];
  recur.forEach(r => {
    if (r.days.includes(dow) && !effective.find(e => e.recurId === r.id)) {
      effective.push({ ...r, recurId: r.id, _recurring: true });
    }
  });
  return { dd, day, effective };
}

function renderCal() {
  const container = document.getElementById('cal-container');
  if (!container) return;
  const vd = calViewDate();
  const vDate = new Date(vd + 'T12:00:00');
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const isToday = vd === today();
  const totalH = CAL.END_HOUR - CAL.START_HOUR;
  const totalPx = totalH * CAL.PX_PER_HOUR;
  const collapsed = CAL._collapsed || false;
  // Date nav header — collapsible
  let html = '<div class="cal-header" onclick="calToggleCollapse(event)">';
  html += '<button class="btn" style="padding:3px 10px;font-size:16px" onclick="event.stopPropagation();calSetDate(-1)">‹</button>';
  html += '<span style="font-weight:600' + (isToday ? '' : ';color:var(--blue)') + '">📅 ' + dayNames[vDate.getDay()] + ', ' + monNames[vDate.getMonth()] + ' ' + vDate.getDate() + (isToday ? ' (today)' : '') + '</span>';
  html += '<button class="btn" style="padding:3px 10px;font-size:16px" onclick="event.stopPropagation();calSetDate(1)">›</button>';
  html += '<span class="cal-toggle' + (collapsed ? ' collapsed' : '') + '">▼</span>';
  html += '</div>';
  html += '<div class="cal-body' + (collapsed ? ' collapsed' : '') + '" id="cal-body" style="max-height:' + (collapsed ? '0' : (Math.min(totalPx + 20, 340) + 60) + 'px') + '">';
  html += '<div class="cal-wrap" id="cal-wrap" style="height:' + Math.min(totalPx + 20, 340) + 'px">';
  // Hour lines + labels
  for (let h = CAL.START_HOUR; h <= CAL.END_HOUR; h++) {
    const y = (h - CAL.START_HOUR) * CAL.PX_PER_HOUR;
    html += '<div class="cal-hour-label" style="top:' + y + 'px">' + calTimeFmt(h * 60) + '</div>';
    html += '<div class="cal-hour-line" style="top:' + y + 'px"></div>';
    if (h < CAL.END_HOUR) {
      for (let q = 1; q < 4; q++) html += '<div class="cal-quarter-line" style="top:' + (y + q * CAL.PX_PER_HOUR / 4) + 'px"></div>';
    }
  }
  html += '<div class="cal-grid" id="cal-grid" style="height:' + totalPx + 'px">';
  // Blocks
  const { effective } = getCalBlocks(vd);
  effective.forEach(b => {
    const top = calMinToY(b.startMin), height = Math.max(15, calMinToY(b.endMin) - top);
    html += '<div class="cal-block ' + (b.cat || 'misc') + '" style="top:' + top + 'px;height:' + height + 'px" data-id="' + (b.id || b.recurId) + '">';
    html += '<div class="cb-title">' + escHtml(b.title || '') + '</div>';
    if (b.desc) html += '<div class="cb-desc">' + escHtml(b.desc) + '</div>';
    html += '<div class="cb-time">' + calTimeFmt(b.startMin) + ' – ' + calTimeFmt(b.endMin) + '</div>';
    if (b._recurring) html += '<div class="cb-recur">↻</div>';
    html += '<div class="cal-resize-handle"></div></div>';
  });
  html += '</div>'; // cal-grid
  // Now line (only on today)
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  if (isToday && nowMin >= CAL.START_HOUR * 60 && nowMin <= CAL.END_HOUR * 60) {
    html += '<div class="cal-now-line" id="cal-now" style="top:' + calMinToY(nowMin) + 'px"></div>';
  }
  html += '</div>'; // cal-wrap
  html += '</div>'; // cal-body
  container.innerHTML = html;
  // Scroll to now or 8am
  const wrap = document.getElementById('cal-wrap');
  if (wrap) { const scrollTo = isToday ? calMinToY(Math.max(nowMin - 60, CAL.START_HOUR * 60)) : calMinToY(8 * 60); wrap.scrollTop = scrollTo; }
  calBindEvents();
}

function calBindEvents() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  let dragStart = null, preview = null;
  // Click-drag to create new block
  grid.addEventListener('mousedown', function(e) {
    if (e.target.closest('.cal-block')) {
      // Click on existing block
      if (e.target.classList.contains('cal-resize-handle')) {
        calStartResize(e); return;
      }
      calStartDrag(e); return;
    }
    // Create new block via drag
    const rect = grid.getBoundingClientRect();
    const y = e.clientY - rect.top;
    dragStart = calYToMin(y);
    preview = document.createElement('div');
    preview.className = 'cal-drag-preview';
    preview.style.top = calMinToY(dragStart) + 'px';
    preview.style.height = (CAL.SNAP_MIN * CAL.PX_PER_HOUR / 60) + 'px';
    grid.appendChild(preview);
    e.preventDefault();
  });
  grid.addEventListener('mousemove', function(e) {
    if (dragStart !== null && preview) {
      const rect = grid.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const curMin = calYToMin(y);
      const top = Math.min(dragStart, curMin), bot = Math.max(dragStart, curMin) + CAL.SNAP_MIN;
      preview.style.top = calMinToY(top) + 'px';
      preview.style.height = Math.max(CAL.SNAP_MIN * CAL.PX_PER_HOUR / 60, calMinToY(bot) - calMinToY(top)) + 'px';
    }
    if (CAL.dragging) calDoDrag(e);
    if (CAL.resizing) calDoResize(e);
  });
  grid.addEventListener('mouseup', function(e) {
    if (CAL.dragging) { calEndDrag(e); return; }
    if (CAL.resizing) { calEndResize(e); return; }
    if (dragStart !== null && preview) {
      const rect = grid.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const endMin = calYToMin(y);
      const startMin = Math.min(dragStart, endMin), finalEnd = Math.max(dragStart, endMin) + CAL.SNAP_MIN;
      preview.remove(); preview = null; dragStart = null;
      if (finalEnd - startMin >= CAL.SNAP_MIN) calShowPopover(null, startMin, finalEnd, e);
    }
  });
  grid.addEventListener('mouseleave', function() {
    if (preview) { preview.remove(); preview = null; dragStart = null; }
  });
  // Click existing blocks
  grid.querySelectorAll('.cal-block').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.defaultPrevented) return;
      const id = el.dataset.id;
      const { effective } = getCalBlocks(calViewDate());
      const block = effective.find(b => (b.id || b.recurId) === id);
      if (block) calShowPopover(block, block.startMin, block.endMin, e, el);
    });
  });
  // Touch events for mobile
  calBindTouchEvents();
}

function calToggleCollapse(event) {
  // Don't collapse when clicking nav buttons
  if (event.target.tagName === 'BUTTON') return;
  CAL._collapsed = !CAL._collapsed;
  renderCal();
}

function calTouchY(e) {
  return e.touches ? e.touches[0].clientY : e.clientY;
}

function calBindTouchEvents() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  let touchStart = null, touchPreview = null, touchMoved = false;
  let touchDragBlock = null, touchDragStartY = 0, touchDragOrigTop = 0;

  grid.addEventListener('touchstart', function(e) {
    const blockEl = e.target.closest('.cal-block');
    if (blockEl) {
      // Touch on existing block — start drag
      const id = blockEl.dataset.id;
      const { effective } = getCalBlocks(calViewDate());
      const block = effective.find(b => (b.id || b.recurId) === id);
      if (!block) return;
      touchDragBlock = { el: blockEl, block, startY: calTouchY(e), origTop: parseInt(blockEl.style.top) };
      touchMoved = false;
      return;
    }
    // Touch on empty grid — start creating block
    const rect = grid.getBoundingClientRect();
    const y = calTouchY(e) - rect.top;
    touchStart = calYToMin(y);
    touchPreview = document.createElement('div');
    touchPreview.className = 'cal-drag-preview';
    touchPreview.style.top = calMinToY(touchStart) + 'px';
    touchPreview.style.height = (CAL.SNAP_MIN * CAL.PX_PER_HOUR / 60) + 'px';
    grid.appendChild(touchPreview);
    touchMoved = false;
  }, { passive: true });

  grid.addEventListener('touchmove', function(e) {
    touchMoved = true;
    if (touchDragBlock) {
      e.preventDefault();
      const dy = calTouchY(e) - touchDragBlock.startY;
      touchDragBlock.el.style.top = (touchDragBlock.origTop + dy) + 'px';
      touchDragBlock.el.style.opacity = '0.7';
      return;
    }
    if (touchStart !== null && touchPreview) {
      const rect = grid.getBoundingClientRect();
      const y = calTouchY(e) - rect.top;
      const curMin = calYToMin(y);
      const top = Math.min(touchStart, curMin), bot = Math.max(touchStart, curMin) + CAL.SNAP_MIN;
      touchPreview.style.top = calMinToY(top) + 'px';
      touchPreview.style.height = Math.max(CAL.SNAP_MIN * CAL.PX_PER_HOUR / 60, calMinToY(bot) - calMinToY(top)) + 'px';
    }
  }, { passive: false });

  grid.addEventListener('touchend', function(e) {
    if (touchDragBlock) {
      const el = touchDragBlock.el, block = touchDragBlock.block;
      el.style.opacity = '';
      if (touchMoved) {
        const newStart = calYToMin(parseInt(el.style.top));
        const duration = block.endMin - block.startMin;
        calUpdateBlock(block, { startMin: newStart, endMin: newStart + duration });
      } else {
        // Tap on block — show popover
        calShowPopover(block, block.startMin, block.endMin, { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
      }
      touchDragBlock = null;
      return;
    }
    if (touchStart !== null && touchPreview) {
      if (touchMoved) {
        const rect = grid.getBoundingClientRect();
        const y = e.changedTouches[0].clientY - rect.top;
        const endMin = calYToMin(y);
        const startMin = Math.min(touchStart, endMin), finalEnd = Math.max(touchStart, endMin) + CAL.SNAP_MIN;
        if (finalEnd - startMin >= CAL.SNAP_MIN) {
          calShowPopover(null, startMin, finalEnd, { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
        }
      } else {
        // Simple tap on empty area — create 30-min block
        calShowPopover(null, touchStart, touchStart + 30, { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
      }
      touchPreview.remove(); touchPreview = null; touchStart = null;
    }
  });
}

function calStartDrag(e) {
  const el = e.target.closest('.cal-block');
  const grid = document.getElementById('cal-grid');
  const id = el.dataset.id;
  const { effective } = getCalBlocks(calViewDate());
  const block = effective.find(b => (b.id || b.recurId) === id);
  if (!block) return;
  CAL.dragging = { el, block, startY: e.clientY, startX: e.clientX, origTop: parseInt(el.style.top), moved: false };
  e.preventDefault();
}
function calDoDrag(e) {
  if (!CAL.dragging) return;
  const dy = e.clientY - CAL.dragging.startY;
  const dx = e.clientX - CAL.dragging.startX;
  // Require 6px movement before starting actual drag
  if (!CAL.dragging.moved && Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
  if (!CAL.dragging.moved) {
    CAL.dragging.moved = true;
    CAL.dragging.el.style.opacity = '0.7'; CAL.dragging.el.style.zIndex = '20';
  }
  CAL.dragging.el.style.top = (CAL.dragging.origTop + dy) + 'px';
}
function calEndDrag(e) {
  if (!CAL.dragging) return;
  const el = CAL.dragging.el, block = CAL.dragging.block, moved = CAL.dragging.moved;
  el.style.opacity = ''; el.style.zIndex = '';
  if (!moved) {
    // Didn't move enough — treat as a click to open popover
    CAL.dragging = null;
    calShowPopover(block, block.startMin, block.endMin, e);
    return;
  }
  const newTop = parseInt(el.style.top);
  const newStart = calYToMin(newTop);
  const duration = block.endMin - block.startMin;
  const newEnd = newStart + duration;
  calUpdateBlock(block, { startMin: newStart, endMin: newEnd });
  CAL.dragging = null;
}
function calStartResize(e) {
  const el = e.target.closest('.cal-block');
  const id = el.dataset.id;
  const { effective } = getCalBlocks(calViewDate());
  const block = effective.find(b => (b.id || b.recurId) === id);
  if (!block) return;
  CAL.resizing = { el, block, startY: e.clientY, origH: parseInt(el.style.height) };
  e.preventDefault(); e.stopPropagation();
}
function calDoResize(e) {
  if (!CAL.resizing) return;
  const dy = e.clientY - CAL.resizing.startY;
  const newH = Math.max(CAL.SNAP_MIN * CAL.PX_PER_HOUR / 60, CAL.resizing.origH + dy);
  CAL.resizing.el.style.height = newH + 'px';
}
function calEndResize(e) {
  if (!CAL.resizing) return;
  const block = CAL.resizing.block;
  const newH = parseInt(CAL.resizing.el.style.height);
  const newEnd = calYToMin(calMinToY(block.startMin) + newH);
  calUpdateBlock(block, { endMin: Math.max(block.startMin + CAL.SNAP_MIN, newEnd) });
  CAL.resizing = null;
}

function calUpdateBlock(block, updates) {
  const vd = calViewDate();
  if (block._recurring) {
    const dd = dayData(vd), day = dd.days[vd];
    if (!day.calBlocks) day.calBlocks = [];
    const existing = day.calBlocks.find(b => b.recurId === block.recurId);
    if (existing) { Object.assign(existing, updates); }
    else { day.calBlocks.push({ ...block, ...updates, id: 'ovr_' + Date.now(), _recurring: undefined }); }
    save(dd);
  } else {
    const dd = dayData(vd), day = dd.days[vd];
    const idx = (day.calBlocks || []).findIndex(b => b.id === block.id);
    if (idx >= 0) { Object.assign(day.calBlocks[idx], updates); save(dd); }
  }
  renderCal();
}

function calShowPopover(block, startMin, endMin, evt, targetEl) {
  calClosePopover();
  const isNew = !block;
  const cats = ['work','gym','italian','dissertation','social','misc'];
  const catLabels = { work:'💼 Work', gym:'💪 Gym', italian:'🇮🇹 Italian', dissertation:'📝 Diss.', social:'🎉 Social', misc:'📌 Misc' };
  const catCls = { work:'l-work', gym:'l-gym', italian:'l-ital', dissertation:'l-diss', social:'l-social', misc:'l-misc' };
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const curCat = block ? block.cat : 'work';
  const curRecur = block && block.recurDays ? block.recurDays : [];
  let html = '<div class="cal-popover" id="cal-pop">';
  html += '<div class="cp-row"><label>Title</label><input id="cp-title" value="' + escHtml(block ? block.title : '') + '" placeholder="Block name..."></div>';
  html += '<div class="cp-row"><label>Description</label><textarea id="cp-desc" rows="2" placeholder="Details (optional)..." style="width:100%;resize:vertical;font:inherit;padding:4px 6px;border:1px solid #ddd;border-radius:4px">' + escHtml(block ? (block.desc || '') : '') + '</textarea></div>';
  html += '<div class="cp-row"><label>Time</label><div class="cp-time-row"><input type="time" id="cp-start" value="' + calMinToTime(startMin) + '"><span>→</span><input type="time" id="cp-end" value="' + calMinToTime(endMin) + '"></div></div>';
  html += '<div class="cp-row"><label>Category</label><div class="cp-cats" id="cp-cats">';
  cats.forEach(c => { html += '<span class="cp-cat label ' + catCls[c] + (c === curCat ? ' sel' : '') + '" data-cat="' + c + '">' + catLabels[c] + '</span>'; });
  html += '</div></div>';
  html += '<div class="cp-row"><label>Repeat</label><div class="cp-recur-opts" id="cp-recur">';
  days.forEach((d, i) => { html += '<span class="cp-recur-opt' + (curRecur.includes(i) ? ' sel' : '') + '" data-day="' + i + '">' + d + '</span>'; });
  html += '</div></div>';
  html += '<div class="cp-actions">';
  if (!isNew) html += '<button class="btn btn-d" style="margin-right:auto;font-size:11px" onclick="calDeleteBlock(\'' + (block.id || block.recurId) + '\',' + !!block._recurring + ')">🗑 Delete</button>';
  html += '<button class="btn" onclick="calClosePopover()">Cancel</button>';
  html += '<button class="btn btn-p" onclick="calSavePopover(' + (isNew ? 'null' : '\'' + (block.id || block.recurId) + '\'') + ',' + (block ? !!block._recurring : false) + ')">' + (isNew ? 'Create' : 'Save') + '</button>';
  html += '</div></div>';
  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'cal-overlay';
  overlay.onclick = calClosePopover;
  document.body.appendChild(overlay);
  document.body.insertAdjacentHTML('beforeend', html);
  // Position — to the right of the block if possible, else fallback to cursor
  const pop = document.getElementById('cal-pop');
  let px, py;
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const gap = 8;
    const popW = 300;
    if (rect.right + gap + popW < window.innerWidth) {
      px = rect.right + gap;
    } else if (rect.left - gap - popW > 0) {
      px = rect.left - gap - popW;
    } else {
      px = Math.min(evt.clientX, window.innerWidth - 320);
    }
    py = Math.min(rect.top, window.innerHeight - 400);
  } else {
    px = Math.min(evt.clientX, window.innerWidth - 320);
    py = Math.min(evt.clientY, window.innerHeight - 400);
  }
  pop.style.left = px + 'px'; pop.style.top = py + 'px';
  document.getElementById('cp-title').focus();
  // Cat click
  pop.querySelectorAll('.cp-cat').forEach(el => el.addEventListener('click', function() {
    pop.querySelectorAll('.cp-cat').forEach(c => c.classList.remove('sel'));
    el.classList.add('sel');
  }));
  // Recur click
  pop.querySelectorAll('.cp-recur-opt').forEach(el => el.addEventListener('click', function() { el.classList.toggle('sel'); }));
}

function calClosePopover() {
  const pop = document.getElementById('cal-pop');
  if (pop) pop.remove();
  document.querySelectorAll('.cal-overlay').forEach(o => o.remove());
}

function calSavePopover(existingId, isRecurring) {
  const title = document.getElementById('cp-title').value.trim() || 'Untitled';
  const desc = document.getElementById('cp-desc').value.trim();
  const startParts = document.getElementById('cp-start').value.split(':');
  const endParts = document.getElementById('cp-end').value.split(':');
  const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || 0);
  const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || 0);
  if (endMin <= startMin) { alert('End must be after start.'); return; }
  const cat = document.querySelector('#cp-cats .cp-cat.sel')?.dataset.cat || 'misc';
  const recurDays = Array.from(document.querySelectorAll('#cp-recur .cp-recur-opt.sel')).map(el => parseInt(el.dataset.day));
  calClosePopover();
  if (recurDays.length > 0) {
    // Save as recurring
    const d = load(); if (!d.recurringBlocks) d.recurringBlocks = [];
    if (existingId && isRecurring) {
      const idx = d.recurringBlocks.findIndex(r => r.id === existingId);
      if (idx >= 0) Object.assign(d.recurringBlocks[idx], { title, desc, cat, startMin, endMin, days: recurDays });
    } else {
      // If converting a one-off block to recurring, remove the old one-off
      if (existingId && !isRecurring) {
        const vd = calViewDate();
        const dd2 = dayData(vd), day2 = dd2.days[vd];
        if (day2.calBlocks) { day2.calBlocks = day2.calBlocks.filter(b => b.id !== existingId); save(dd2); }
      }
      d.recurringBlocks.push({ id: 'rec_' + Date.now(), title, desc, cat, startMin, endMin, days: recurDays });
    }
    save(d);
  } else {
    // Save as one-off for today
    const vd = calViewDate();
    const dd = dayData(vd), day = dd.days[vd];
    if (!day.calBlocks) day.calBlocks = [];
    if (existingId && !isRecurring) {
      const idx = day.calBlocks.findIndex(b => b.id === existingId);
      if (idx >= 0) Object.assign(day.calBlocks[idx], { title, desc, cat, startMin, endMin });
      else day.calBlocks.push({ id: 'blk_' + Date.now(), title, desc, cat, startMin, endMin });
    } else {
      day.calBlocks.push({ id: 'blk_' + Date.now(), title, desc, cat, startMin, endMin });
    }
    save(dd);
  }
  renderCal(); addLog('action', 'Block: ' + title + ' ' + calTimeFmt(startMin) + '-' + calTimeFmt(endMin));
}

function calDeleteBlock(id, isRecurring) {
  const vd = calViewDate();
  if (isRecurring) {
    if (!confirm('Delete this recurring block from ALL days?')) return;
    const d = load(); d.recurringBlocks = (d.recurringBlocks || []).filter(r => r.id !== id); save(d);
  } else {
    const dd = dayData(vd), day = dd.days[vd];
    day.calBlocks = (day.calBlocks || []).filter(b => b.id !== id); save(dd);
  }
  calClosePopover(); renderCal(); addLog('action', 'Block deleted');
}

// Keep now-line updated
setInterval(function() {
  const el = document.getElementById('cal-now');
  if (el) { const now = new Date(), m = now.getHours() * 60 + now.getMinutes(); el.style.top = calMinToY(m) + 'px'; }
}, 60000);

// ===== ICS Export / Import =====
function exportICS() {
  const vd = calViewDate();
  const { effective } = getCalBlocks(vd);
  if (effective.length === 0) { alert('No blocks to export for ' + vd); return; }
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CommandCenter//EN\r\nCALSCALE:GREGORIAN\r\n';
  effective.forEach(b => {
    const dtStart = vd.replace(/-/g, '') + 'T' + calMinToTime(b.startMin).replace(':', '') + '00';
    const dtEnd = vd.replace(/-/g, '') + 'T' + calMinToTime(b.endMin).replace(':', '') + '00';
    ics += 'BEGIN:VEVENT\r\nDTSTART:' + dtStart + '\r\nDTEND:' + dtEnd + '\r\nSUMMARY:' + (b.title || 'Block') + '\r\nCATEGORIES:' + (b.cat || 'misc') + '\r\nUID:' + (b.id || b.recurId || Date.now()) + '@cmdcenter\r\nEND:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'schedule-' + vd + '.ics'; a.click();
}
function importICS(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const txt = e.target.result;
    const events = txt.split('BEGIN:VEVENT');
    let count = 0;
    const vd = calViewDate();
    const dd = dayData(vd), day = dd.days[vd];
    if (!day.calBlocks) day.calBlocks = [];
    events.forEach(ev => {
      const sm = ev.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      const em = ev.match(/DTEND[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      const nm = ev.match(/SUMMARY:(.*)/);
      if (sm && em) {
        const evDate = sm[1] + '-' + sm[2] + '-' + sm[3];
        if (evDate !== vd) return; // only import events matching viewed date
        const startMin = parseInt(sm[4]) * 60 + parseInt(sm[5]);
        const endMin = parseInt(em[4]) * 60 + parseInt(em[5]);
        const title = nm ? nm[1].trim() : 'Imported';
        day.calBlocks.push({ id: 'imp_' + Date.now() + '_' + count, title, cat: 'misc', startMin, endMin });
        count++;
      }
    });
    save(dd); renderCal();
    alert('Imported ' + count + ' events for ' + vd);
  };
  reader.readAsText(file);
  event.target.value = '';
}

// Legacy compat
function addBlock() {} function renderBlocks() { renderCal(); } function rmBlock() {}

// saveT3Intentions and loadT3Intentions moved to today.js (chip-based)
function updRC() {
  const txt = document.getElementById('refl-txt').value, wc = txt.trim().split(/\s+/).filter(w => w).length, el = document.getElementById('refl-wc');
  el.textContent = wc + ' / 200 words'; el.className = 'wc' + (wc > 0 && wc < 200 ? ' bad' : '');
  const dd = dayData(today()); dd.days[today()].reflection = txt; save(dd);
}


function sealDay() {
  if (!confirm('Lock all entries for today permanently?')) return;
  const dd = dayData(today()); dd.days[today()].sealed = true; save(dd); lockToday(); addLog('sealed', 'Day sealed: ' + today());
}

// ============ FLASHCARD REVIEW SHARED INFRASTRUCTURE ============

const FLASH_CARD_RULES = `Core Structure Rules:
- Each lexical item generates exactly two cards: one definition/translation card and one cloze card. These must be paired and adjacent.
- No orphan cards. Every word/expression must have both cards.

Definition / Translation Card Rules:
- The prompt side must NOT contain the target Italian word. The definition must be paraphrastic or translational.
- Default: Italian-language definition, idiomatic, modern, explanatory (not dictionary-literal).
- Exception: Use English on prompt side for discourse markers, stance-setting expressions, long propositional phrases.
- Answer side always includes: the Italian target word/expression + a brief English gloss.
- The gloss should flag register (colloquial, informal, legal, literary, vulgar, etc.) and if the term is archaic or has a more common modern alternative.
- Prefer natural Italian over calques.

Cloze Card Rules:
- The cloze must test productive knowledge (produce the target form, not just recognize it).
- Verbs must be conjugated in context. Never use infinitives as cloze answers.
- Prefer present tense or passato prossimo. No passato remoto unless unavoidable.
- Rich contextual cues are mandatory. The sentence must contain enough information that the word is inferable.
- Natural syntax and discourse flow take priority.

Register, Usage, and Accuracy Rules:
- Register must be explicit somewhere in the pair (especially colloquial/vulgar, legal/bureaucratic, literary/antiquated).
- Avoid over-formalization. Prefer contemporary usage.
- The two cards don't need to mirror each other structurally. Together they must lock down meaning, usage, and form.

Scope Rules:
- One lexical target per pair. No combining unrelated words.
- Mixed directionality (IT→EN or EN→IT) is allowed depending on learning value.
- Be explicit about markedness (odd, dated, sarcastic, regionally marked, unusually strong).`;

const COMPOSITION_EXTRACTION_RULES = `Extraction Rules from Corrected Composition Exercises (targeting C2-level control):

A. Extraction Priority (What to Pull First):
1. Corrections replacing English-shaped structures with Italian ones (absolute priority): argument framing, concessive structures, causal chains, stance softening/strengthening.
2. Upgraded verbs replacing generic ones (fare/dire/andare/mettere/avere → specific verb).
3. Discourse operators and meta-textual moves: framing moves, evaluation phrases, self-positioning.
4. Corrections that reduce explicitness without losing meaning (Italian prefers implication over specification).
5. Idiomatic compression: longer phrase replaced by shorter idiomatic unit.

B. What NOT to Extract:
- Pure grammar fixes (agreement, gender/number, article choice) with no semantic/stylistic upgrade.
- Transparent, obvious, predictable, stylistically neutral synonyms.
- Hyper-local phrasing that only works in that precise context and doesn't generalize.

C. Extraction Granularity:
- Prefer constructions over single words (verb+complement patterns, stance-setting frames, concessive/contrastive structures).
- Allow partial propositions ("da persona che + verbo", "non tanto X quanto Y", "il fatto che + congiuntivo").

D. Card Framing:
- Default to English-led definition cards (these encode thought moves, not objects).
- English prompt should describe the function, not literal wording.
- Cloze cards must recreate the rhetorical move, not just the word.

E. Frequency Control:
- Cap: 5-8 items per text. More dilutes salience and retention.
- Prefer recurrence over novelty.

F. C2 Calibration (before extracting, ask):
- Would a fluent C1 speaker plausibly avoid this? → extract.
- Does this change how the sentence positions the speaker? → extract.
- Would mastering this reduce future correction density? → extract.

G. Meta-Rule: Extraction is about control, not accumulation. Every item should reduce Anglicism, increase rhetorical flexibility, or improve stance precision.`;

// Shared state for active flashcard reviews
const _fcReviews = {};

function renderFlashcardReview(containerId, cards, context, tags) {
  const container = document.getElementById(containerId);
  if (!container) return;
  // Hide any previous success message
  const prevSuccess = document.getElementById(containerId + '-success');
  if (prevSuccess) prevSuccess.style.display = 'none';
  _fcReviews[containerId] = { cards: cards.map(c => ({...c})), context, tags };
  container.style.display = 'block';
  container.innerHTML = `
    <div class="fc-review">
      <h4 style="font-size:14px;margin-bottom:8px">🃏 Review Flashcards (${cards.length} cards)</h4>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Edit front/back, delete unwanted cards, then submit approved ones to your deck.</p>
      <div id="${containerId}-list" class="fc-review-list" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:8px"></div>
      <div class="flex mt8" style="gap:8px">
        <button class="btn btn-p" onclick="fcSubmitAll('${containerId}')">✅ Submit All to Deck</button>
        <span id="${containerId}-submit-status" style="font-size:12px;color:var(--muted)"></span>
      </div>
      <div class="fc-chat-section" style="margin-top:12px;border-top:1px dashed var(--border);padding-top:10px">
        <h4 style="font-size:13px;margin-bottom:6px">💬 Ask about these cards</h4>
        <div id="${containerId}-chat-log" style="max-height:200px;overflow-y:auto;font-size:12px;margin-bottom:6px"></div>
        <div class="flex" style="gap:6px">
          <input class="fin flex-1" id="${containerId}-chat-input" placeholder="Ask a follow-up question..." onkeydown="if(event.key==='Enter')fcChat('${containerId}')">
          <button class="btn btn-s" onclick="fcChat('${containerId}')">Send</button>
        </div>
      </div>
    </div>`;
  _fcRenderCards(containerId);
}

function _fcRenderCards(containerId) {
  const rev = _fcReviews[containerId];
  if (!rev) return;
  const list = document.getElementById(containerId + '-list');
  if (!list) return;
  list.innerHTML = rev.cards.length === 0 ?
    '<p style="color:var(--muted);font-size:12px;font-style:italic">No cards. Use the chat to request more.</p>' :
    rev.cards.map((c, i) => `
      <div class="fc-card-row" style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Front:</div>
          <textarea class="fin" style="width:100%;font-size:12px;min-height:36px;resize:vertical" id="${containerId}-f-${i}" onchange="fcEditCard('${containerId}',${i},'front',this.value)">${escHtml(c.front)}</textarea>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Back:</div>
          <textarea class="fin" style="width:100%;font-size:12px;min-height:36px;resize:vertical" id="${containerId}-b-${i}" onchange="fcEditCard('${containerId}',${i},'back',this.value)">${escHtml(c.back)}</textarea>
        </div>
        <button class="btn" style="font-size:10px;padding:4px 8px;margin-top:14px;color:var(--red)" onclick="fcDeleteCard('${containerId}',${i})">✕</button>
      </div>`).join('');
}

function fcEditCard(containerId, idx, field, val) {
  if (_fcReviews[containerId] && _fcReviews[containerId].cards[idx]) {
    _fcReviews[containerId].cards[idx][field] = val;
  }
}

function fcDeleteCard(containerId, idx) {
  if (_fcReviews[containerId]) {
    _fcReviews[containerId].cards.splice(idx, 1);
    _fcRenderCards(containerId);
  }
}

function fcSubmitAll(containerId) {
  const rev = _fcReviews[containerId];
  if (!rev || rev.cards.length === 0) { alert('No cards to submit.'); return; }
  let count = 0;
  rev.cards.forEach(c => {
    if (c.front.trim() && c.back.trim()) {
      addCard(c.front.trim(), c.back.trim(), rev.tags);
      count++;
    }
  });
  // Hide the review UI and show a success message below it
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = 'none';
    // Create or update success message after the container
    let successEl = document.getElementById(containerId + '-success');
    if (!successEl) {
      successEl = document.createElement('div');
      successEl.id = containerId + '-success';
      successEl.style.cssText = 'margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#16a34a;font-size:13px;font-weight:600';
      container.parentNode.insertBefore(successEl, container.nextSibling);
    }
    successEl.textContent = '✅ Added ' + count + ' cards to deck!';
    successEl.style.display = 'block';
  }
  rev.cards = [];
  delete _fcReviews[containerId];
  addLog('action', 'Submitted ' + count + ' reviewed cards (' + rev.tags + ')');
}

async function fcChat(containerId) {
  const rev = _fcReviews[containerId];
  if (!rev) return;
  const input = document.getElementById(containerId + '-chat-input');
  const log = document.getElementById(containerId + '-chat-log');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); return; }
  log.innerHTML += '<div style="margin-bottom:4px"><b style="color:var(--acc)">You:</b> ' + escHtml(q) + '</div>';
  log.innerHTML += '<div style="margin-bottom:4px;color:var(--muted)">⏳ Thinking...</div>';
  log.scrollTop = log.scrollHeight;
  try {
    const currentCards = rev.cards.map(c => 'Front: ' + c.front + ' | Back: ' + c.back).join('\n');
    const prompt = `Context: ${rev.context}\n\nCurrent flashcards:\n${currentCards}\n\nUser question: ${q}\n\nIf the user asks to add/modify/generate cards, return any new cards as a JSON array with "front" and "back" fields, wrapped in <cards>[...]</cards> tags, IN ADDITION to your normal response. Otherwise just answer the question helpfully.`;
    const resp = await callClaude(key, prompt);
    // Remove the "Thinking..." message
    const msgs = log.querySelectorAll('div');
    if (msgs.length > 0) msgs[msgs.length - 1].remove();
    // Check for new cards in response
    const cardMatch = resp.match(/<cards>([\s\S]*?)<\/cards>/);
    let cleanResp = resp.replace(/<cards>[\s\S]*?<\/cards>/, '').trim();
    log.innerHTML += '<div style="margin-bottom:6px"><b style="color:var(--green)">Claude:</b> ' + cleanResp.replace(/\n/g, '<br>') + '</div>';
    if (cardMatch) {
      try {
        const newCards = JSON.parse(cardMatch[1]);
        if (Array.isArray(newCards)) {
          newCards.forEach(c => {
            if (c.front && c.back) rev.cards.push({ front: c.front, back: c.back });
          });
          _fcRenderCards(containerId);
          log.innerHTML += '<div style="color:var(--green);font-size:11px;margin-bottom:4px">📥 Added ' + newCards.length + ' cards to review list.</div>';
        }
      } catch(e) { /* ignore parse errors */ }
    }
    log.scrollTop = log.scrollHeight;
  } catch (e) {
    const msgs = log.querySelectorAll('div');
    if (msgs.length > 0) msgs[msgs.length - 1].remove();
    log.innerHTML += '<div style="color:var(--red);margin-bottom:4px">Error: ' + escHtml(e.message) + '</div>';
  }
}

function _parseCardsJSON(resp) {
  try {
    // Strip markdown code fences if present
    let cleaned = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch(e) {
    // If JSON is truncated, try to salvage complete objects
    try {
      let cleaned = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      const arrMatch = cleaned.match(/\[[\s\S]*/);
      if (arrMatch) {
        let partial = arrMatch[0];
        // Find the last complete object (ends with })
        const lastBrace = partial.lastIndexOf('}');
        if (lastBrace > 0) {
          partial = partial.slice(0, lastBrace + 1) + ']';
          return JSON.parse(partial);
        }
      }
    } catch(e2) { /* give up */ }
  }
  return [];
}

// ============ REFLECTION SUBMIT (Daily Composition) ============
async function submitRefl() {
  const txt = document.getElementById('refl-txt').value.trim();
  const wc = txt.split(/\s+/).filter(w => w).length;
  if (wc < 200) { alert('Min 200 words required. Currently: ' + wc); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const res = document.getElementById('refl-res');
  res.style.display = 'block'; res.innerHTML = '<p>⏳ Sending to Claude for correction + flashcard generation...</p>';
  try {
    const feedbackPrompt = `Sei un tutor esperto di italiano a livello C1-C2. Lo studente ha scritto questa composizione giornaliera:\n\n"${txt}"\n\nIstruzioni:\n1. Per prima cosa, riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine — il testo intero, non solo frammenti.\n2. Poi elenca ogni errore: originale → corretto, con una spiegazione IN ITALIANO del perché era sbagliato.\n3. Valuta il livello (A2/B1/B2/C1/C2).\n\nSii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti. Solo correzioni e spiegazioni.\n\nFormatta la risposta con intestazioni chiare.`;
    const feedbackResp = await callClaude(key, feedbackPrompt);
    res.innerHTML = '<div style="background:var(--bg);padding:10px;border-radius:6px;font-size:13px;white-space:pre-wrap;border:1px solid var(--border)">' + escHtml(feedbackResp) + '</div>';
    // Save correction
    const d = getGlobal();
    d.corrections.push({ date: today(), text: txt, response: feedbackResp });
    save(d);
    // Now generate flashcards
    const cardPrompt = `You are generating flashcards from a corrected Italian composition exercise.\n\nOriginal student text:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${COMPOSITION_EXTRACTION_RULES}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections above, extract 5-8 flashcard items following the extraction and card construction rules. For each item, generate the paired definition card and cloze card.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('refl-card-review', cards, 'Daily composition:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'composition');
    }
    addLog('action', 'Italian composition submitted + corrected + ' + cards.length + ' cards generated');
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
  renderDailySummaries();
}
function addCWG() { const v = document.getElementById('cw-in').value.trim(), cat = document.getElementById('cw-cat').value; if (!v) return; const wk = weekId(), wd = weekData(wk); wd.weeks[wk].goals.push({ text: v, cat, done: false }); save(wd); document.getElementById('cw-in').value = ''; renderCWG(); }
function renderDailySummaries() {
  const container = document.getElementById('daily-summaries');
  if (!container) return;
  const wk = weekId();
  const mon = new Date(wk);
  const d = load();
  let html = '';
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayKey = today();
  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    const key = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    if (key === todayKey) continue;
    const notes = d.days && d.days[key] && d.days[key].notes;
    if (!notes || !notes.replace(/<[^>]*>/g,'').trim()) continue;
    const label = days[dt.getDay()] + ', ' + dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    html += '<details class="card" style="margin-bottom:6px"><summary style="cursor:pointer;font-weight:600;font-size:13px">' + label + ' — Daily Notes</summary><div style="padding:8px;font-size:13px;line-height:1.6">' + notes + '</div></details>';
  }
  container.innerHTML = html || '<p style="font-size:12px;color:var(--muted);font-style:italic">No daily notes from this week yet.</p>';
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
// Moved to dissertation.js

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

// ============ CARDS TAB (SM-2 Spaced Repetition) ============
function getCards() { const d = load(); if (!d.cards) d.cards = []; if (!d.cardSettings) d.cardSettings = { newPerDay: 20 }; return d; }
function todayDayNum() { return Math.floor(Date.now() / 86400000); }
function saveCardSettings() {
  const v = parseInt(document.getElementById('cards-new-limit').value) || 20;
  const d = getCards(); d.cardSettings = { newPerDay: Math.max(1, Math.min(200, v)) }; save(d);
  document.getElementById('cards-review-cap').textContent = v * 10;
  renderCards();
}
function getAnkiDailyTarget() {
  // Compute once at site open, cache for the day
  const key = 'anki_target_' + today();
  const cached = localStorage.getItem(key);
  if (cached !== null && parseInt(cached) > 0) return parseInt(cached);
  const d = getCards(), now = todayDayNum();
  const settings = d.cardSettings || { newPerDay: 20 };
  const dailyBonus = (settings.dailyBonusNew && settings.dailyBonusNew[today()]) || 0;
  const newLimit = settings.newPerDay + dailyBonus;
  const reviewCap = newLimit * 10;
  const dueReviews = d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1 && c.queue !== 0).length;
  const availableNew = Math.min(newLimit, d.cards.filter(c => c.queue === 0).length);
  // Cap to review cap — you can't study more than this in one day
  const target = Math.min(dueReviews + availableNew, reviewCap);
  if (d.cards.length > 0 && target > 0) localStorage.setItem(key, target);
  return target;
}

function updateAnkiHabitFromCards(totalReviewedToday) {
  // Auto-update the Anki habit based on cards studied today
  const dd = dayData(today());
  const day = dd.days[today()];
  const target = getAnkiDailyTarget();
  // Update the displayed count and target
  const ctEl = document.getElementById('anki-ct');
  if (ctEl) ctEl.textContent = totalReviewedToday;
  const tgtEl = document.getElementById('anki-target');
  if (tgtEl) tgtEl.textContent = target;
  // Auto-check/uncheck habit: done when all due cards are completed
  const chk = document.getElementById('h-anki');
  if (target > 0 && totalReviewedToday >= target) {
    if (chk) chk.checked = true;
    day.habits.anki = true;
    day.habits.ankiCount = totalReviewedToday;
  } else {
    if (chk) chk.checked = false;
    day.habits.anki = false;
    day.habits.ankiCount = totalReviewedToday;
  }
  save(dd);
}

function getNewIntroducedToday() {
  // Count cards that were new (queue===0) and got their first review today
  const d = getCards();
  return d.cards.filter(c => c.queue !== 0 && c.firstReviewDate === today()).length;
}
function getTotalReviewedToday() {
  const d = getCards();
  return d.cards.filter(c => c.reviewedToday === today()).length;
}

function sm2(card, quality) {
  // SM-2 algorithm: quality 1=Again, 2=Hard, 3=Good, 4=Easy
  const c = Object.assign({}, card);
  c.reps = (c.reps || 0);
  c.lapses = (c.lapses || 0);
  c.ease = c.ease || 2500; // factor * 1000
  c.ivl = c.ivl || 0;
  c.reviewedToday = today();
  // Track when a new card gets its first review
  if (card.queue === 0 && !c.firstReviewDate) c.firstReviewDate = today();

  if (quality === 1) { // Again
    c.lapses++; c.reps = 0; c.ivl = 0; c.ease = Math.max(1300, c.ease - 200);
    c.due = todayDayNum(); // re-show today (end of queue)
    c.queue = 1; // learning
  } else if (quality === 2) { // Hard
    if (c.ivl === 0) { c.ivl = 1; } else { c.ivl = Math.max(1, Math.round(c.ivl * 1.2)); }
    c.ease = Math.max(1300, c.ease - 150);
    c.due = todayDayNum() + c.ivl; c.reps++; c.queue = 2;
  } else if (quality === 3) { // Good
    if (c.ivl === 0) { c.ivl = 1; } else if (c.ivl === 1) { c.ivl = 6; } else { c.ivl = Math.round(c.ivl * c.ease / 1000); }
    c.due = todayDayNum() + c.ivl; c.reps++; c.queue = 2;
  } else if (quality === 4) { // Easy
    if (c.ivl === 0) { c.ivl = 4; } else { c.ivl = Math.round(c.ivl * c.ease / 1000 * 1.3); }
    c.ease += 150; c.due = todayDayNum() + c.ivl; c.reps++; c.queue = 2;
  }
  return c;
}

function fmtIvl(days) {
  if (days === 0) return '<1d'; if (days === 1) return '1d';
  if (days < 30) return days + 'd'; if (days < 365) return Math.round(days / 30.4) + 'mo';
  return (days / 365).toFixed(1) + 'y';
}

function previewIvl(card, quality) { return fmtIvl(sm2(card, quality).ivl); }

let studyQueue = [], studyIdx = 0, studyFlipped = false, lastCardAction = null;

function getDueCards() {
  const d = getCards(), now = todayDayNum();
  return d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1);
}
function getNewCards() { const d = getCards(); return d.cards.filter(c => c.queue === 0); }

function renderCards() {
  const d = getCards(), now = todayDayNum();
  // Auto-seed on first visit if deck is empty
  // BUT skip if sync is configured and initial pull hasn't finished yet
  if (d.cards.length === 0 && !renderCards._seeding) {
    const syncConfigured = !!localStorage.getItem('sync_passphrase');
    const pullDone = typeof FirebaseSync !== 'undefined' && FirebaseSync.isInitialPullDone ? FirebaseSync.isInitialPullDone() : true;
    if (syncConfigured && !pullDone) {
      // Sync not ready yet — show waiting message, don't auto-seed
      const el = document.getElementById('cards-limit-status');
      if (el) { el.innerHTML = '🟡 Waiting for sync...'; el.style.color = 'var(--yellow)'; }
      return;
    }
    renderCards._seeding = true;
    seedAnkiDeckAuto();
    return;
  }
  const settings = d.cardSettings || { newPerDay: 20 };
  const dailyBonus = (settings.dailyBonusNew && settings.dailyBonusNew[today()]) || 0;
  const newLimit = settings.newPerDay + dailyBonus;
  const reviewCap = newLimit * 10;

  // Load setting into UI
  document.getElementById('cards-new-limit').value = settings.newPerDay;
  document.getElementById('cards-review-cap').textContent = reviewCap;

  const dueReviews = d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1 && c.queue !== 0);
  const allNew = d.cards.filter(c => c.queue === 0);
  const newIntroducedToday = getNewIntroducedToday();
  const totalReviewedToday = getTotalReviewedToday();
  const newRemaining = Math.max(0, newLimit - newIntroducedToday);
  const reviewRemaining = Math.max(0, reviewCap - totalReviewedToday);

  // What's actually available this session
  const availableReviews = dueReviews.slice(0, reviewRemaining);
  const availableNew = allNew.slice(0, Math.min(newRemaining, Math.max(0, reviewRemaining - availableReviews.length)));
  const totalAvailable = availableReviews.length + availableNew.length;

  const learningCards = d.cards.filter(c => c.queue === 1 && (c.due || 0) <= now);
  document.getElementById('cards-new-remaining').textContent = Math.min(newRemaining, allNew.length);
  document.getElementById('cards-learning-ct').textContent = learningCards.length;
  document.getElementById('cards-review-remaining').textContent = availableReviews.length;

  // Count cards reviewed today
  document.getElementById('cards-reviewed-today').textContent = totalReviewedToday;

  // Limit status message
  const statusEl = document.getElementById('cards-limit-status');
  if (totalAvailable === 0 && (allNew.length > 0 || dueReviews.length > 0)) {
    if (totalReviewedToday >= reviewCap) {
      statusEl.innerHTML = '🎉 <b>Review cap reached!</b> Done for today.';
    } else if (newIntroducedToday >= newLimit && dueReviews.length === 0) {
      statusEl.innerHTML = '✅ All reviews done. New card limit reached (' + newLimit + '/' + newLimit + ').';
    }
    statusEl.style.color = 'var(--green)';
  } else if (totalAvailable === 0) {
    statusEl.innerHTML = '🎉 No cards due!';
    statusEl.style.color = 'var(--green)';
  } else {
    statusEl.innerHTML = '';
  }

  // Show "Add more" button whenever there are new cards available
  const addMoreBtn = document.getElementById('cards-add-more-btn');
  if (allNew.length > 0) {
    addMoreBtn.style.display = '';
    addMoreBtn.textContent = '➕ Add ' + Math.min(5, allNew.length) + ' more new cards';
  } else {
    addMoreBtn.style.display = 'none';
  }

  // Auto-update Anki habit based on cards studied today
  updateAnkiHabitFromCards(totalReviewedToday);

  renderCardBrowse();
}

async function seedAnkiDeckAuto() {
  const btn = document.getElementById('seed-anki-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Auto-importing...'; }
  try {
    const resp = await fetch('anki_cards.json');
    if (!resp.ok) throw new Error('Failed to fetch anki_cards.json: ' + resp.status);
    const imported = await resp.json();
    const d = getCards();
    const existingIds = new Set(d.cards.map(c => c.id));
    let added = 0;
    imported.forEach(c => { if (!existingIds.has(c.id)) { d.cards.push(c); added++; } });
    save(d);
    addLog('action', 'Auto-seeded ' + added + ' Anki cards');
  } catch (e) { console.error('Auto-seed failed:', e); }
  renderCards._seeding = false;
  if (btn) { btn.disabled = false; btn.textContent = '📦 Seed Anki Deck'; }
  renderCards();
}

function startStudy() {
  const d = getCards(), now = todayDayNum();
  const settings = d.cardSettings || { newPerDay: 20 };
  const dailyBonus = (settings.dailyBonusNew && settings.dailyBonusNew[today()]) || 0;
  const newLimit = settings.newPerDay + dailyBonus;
  const reviewCap = newLimit * 10;
  const newIntroducedToday = getNewIntroducedToday();
  const totalReviewedToday = getTotalReviewedToday();
  const reviewRemaining = Math.max(0, reviewCap - totalReviewedToday);

  if (reviewRemaining === 0) { alert('Review cap reached (' + reviewCap + ')! You\'re done for today. 🎉'); return; }

  // Due reviews first (respect review cap)
  const dueReviews = d.cards.filter(c => (c.due || 0) <= now && c.queue !== -1 && c.queue !== 0);
  const newRemaining = Math.max(0, newLimit - newIntroducedToday);
  const newC = d.cards.filter(c => c.queue === 0).slice(0, newRemaining);

  // Cap total queue to remaining review budget
  let queue = [...dueReviews, ...newC];
  if (queue.length > reviewRemaining) queue = queue.slice(0, reviewRemaining);

  if (queue.length === 0) { alert('No cards due! 🎉'); return; }
  // Shuffle to avoid always starting from the same place
  for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
  studyQueue = queue;
  studyIdx = 0; studyFlipped = false;
  document.getElementById('study-area').style.display = 'block';
  showStudyCard();
}

function addMoreCards() {
  const d = getCards();
  const settings = d.cardSettings || { newPerDay: 20 };
  const bump = 5;
  // Temporarily increase today's allowance by bumping the setting
  // We track via a daily override instead
  if (!d.cardSettings.dailyBonusNew) d.cardSettings.dailyBonusNew = {};
  const existing = d.cardSettings.dailyBonusNew[today()] || 0;
  d.cardSettings.dailyBonusNew[today()] = existing + bump;
  save(d);
  renderCards();
  addLog('action', 'Added ' + bump + ' bonus new cards for today');
}

function showStudyCard() {
  if (studyIdx >= studyQueue.length) { endStudy(); alert('Session complete! 🎉 Reviewed ' + studyQueue.length + ' cards.'); return; }
  const card = studyQueue[studyIdx];
  document.getElementById('study-front').innerHTML = escHtml(card.front);
  document.getElementById('study-back-content').innerHTML = escHtml(card.back);
  document.getElementById('study-back').style.display = 'none';
  document.getElementById('study-hint').style.display = '';
  const remaining = studyQueue.slice(studyIdx);
  const newLeft = remaining.filter(c => c.queue === 0).length;
  const learnLeft = remaining.filter(c => c.queue === 1).length;
  const revLeft = remaining.length - newLeft - learnLeft;
  document.getElementById('study-progress').innerHTML = '<span style="color:#3b82f6;font-weight:700">' + newLeft + '</span> + <span style="color:#ef4444;font-weight:700">' + learnLeft + '</span> + <span style="color:#22c55e;font-weight:700">' + revLeft + '</span>';
  document.getElementById('hard-ivl').textContent = previewIvl(card, 2);
  document.getElementById('good-ivl').textContent = previewIvl(card, 3);
  document.getElementById('easy-ivl').textContent = previewIvl(card, 4);
  studyFlipped = false;
}

function flipCard() {
  if (studyFlipped) return;
  studyFlipped = true;
  document.getElementById('study-back').style.display = 'block';
  document.getElementById('study-hint').style.display = 'none';
}

function rateCard(quality) {
  const d = getCards();
  const card = studyQueue[studyIdx];
  const idx = d.cards.findIndex(c => c.id === card.id);
  if (idx === -1) return;
  // Snapshot for undo
  lastCardAction = { cardId: card.id, cardBefore: JSON.parse(JSON.stringify(d.cards[idx])), studyIdxBefore: studyIdx, quality, queueLenBefore: studyQueue.length };
  const updated = sm2(d.cards[idx], quality);
  d.cards[idx] = updated;
  save(d);
  if (quality === 1) { // Again: re-queue at end
    studyQueue.push(updated);
  }
  studyIdx++;
  // Show undo button
  const undoBtn = document.getElementById('undo-card-btn');
  if (undoBtn) { undoBtn.style.opacity = '1'; undoBtn.style.pointerEvents = 'auto'; }
  // Live-update the reviewed-today counter
  const reviewedNow = getTotalReviewedToday();
  document.getElementById('cards-reviewed-today').textContent = reviewedNow;
  updateAnkiHabitFromCards(reviewedNow);
  showStudyCard();
}

function undoCardResponse() {
  if (!lastCardAction) return;
  const d = getCards();
  const idx = d.cards.findIndex(c => c.id === lastCardAction.cardId);
  if (idx === -1) { lastCardAction = null; return; }
  d.cards[idx] = lastCardAction.cardBefore;
  save(d);
  if (lastCardAction.quality === 1 && studyQueue.length > lastCardAction.queueLenBefore) {
    studyQueue.pop();
  }
  studyIdx = lastCardAction.studyIdxBefore;
  studyQueue[studyIdx] = lastCardAction.cardBefore;
  lastCardAction = null;
  const undoBtn = document.getElementById('undo-card-btn');
  if (undoBtn) { undoBtn.style.opacity = '.35'; undoBtn.style.pointerEvents = 'none'; }
  const reviewedNow = getTotalReviewedToday();
  document.getElementById('cards-reviewed-today').textContent = reviewedNow;
  updateAnkiHabitFromCards(reviewedNow);
  showStudyCard();
}

// Cmd+Z / Ctrl+Z undo listener for flashcard review
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    const studyArea = document.getElementById('study-area');
    if (studyArea && studyArea.style.display !== 'none' && lastCardAction) {
      e.preventDefault();
      undoCardResponse();
    }
  }
});

function endStudy() {
  document.getElementById('study-area').style.display = 'none';
  studyQueue = []; studyIdx = 0; lastCardAction = null;
  renderCards();
  addLog('action', 'Flashcard study session');
}

function addCard(front, back, tags) {
  const frontEl = document.getElementById('card-front');
  const backEl = document.getElementById('card-back');
  const tagsEl = document.getElementById('card-tags');
  front = front || (frontEl ? frontEl.value.trim() : '');
  back = back || (backEl ? backEl.value.trim() : '');
  tags = tags || (tagsEl ? tagsEl.value.trim() : '');
  if (!front || !back) return;
  const d = getCards();
  d.cards.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 8), front, back, tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [], queue: 0, due: todayDayNum(), ivl: 0, ease: 2500, reps: 0, lapses: 0, created: today(), reviewedToday: null });
  save(d);
  if (frontEl) frontEl.value = '';
  if (backEl) backEl.value = '';
  if (tagsEl) tagsEl.value = '';
  renderCards();
  addLog('action', 'Card added: ' + front);
}

function toggleBulkImport() { const el = document.getElementById('bulk-import'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function bulkImport() {
  const txt = document.getElementById('bulk-text').value.trim();
  if (!txt) return;
  let count = 0;
  // Try Front:/Back: pairs first
  const fbPairs = txt.match(/Front:\s*(.+?)[\n\r]+Back:\s*(.+?)(?=\nFront:|\n*$)/gs);
  if (fbPairs && fbPairs.length > 0) {
    fbPairs.forEach(pair => {
      const fm = pair.match(/Front:\s*(.+)/i);
      const bm = pair.match(/Back:\s*(.+)/i);
      if (fm && bm) { addCard(fm[1].trim(), bm[1].trim(), ''); count++; }
    });
  } else {
    // TSV: front\tback per line
    txt.split('\n').forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        addCard(parts[0].trim(), parts[1].trim(), ''); count++;
      }
    });
  }
  document.getElementById('bulk-text').value = '';
  if (count > 0) { alert('Imported ' + count + ' cards!'); renderCards(); }
  else { alert('No cards found. Use TSV (tab-separated) or Front:/Back: format.'); }
}

async function seedAnkiDeck() {
  const btn = document.getElementById('seed-anki-btn');
  if (!btn) return;
  // Two-click confirmation pattern (no confirm() dialog needed)
  if (!btn.dataset.ready) {
    btn.dataset.ready = '1';
    btn.textContent = '⚠️ Click again to import 3,663 cards';
    btn.style.background = '#e74c3c'; btn.style.color = '#fff';
    setTimeout(() => { delete btn.dataset.ready; btn.textContent = '📦 Seed Anki Deck'; btn.style.background = ''; btn.style.color = ''; }, 5000);
    return;
  }
  delete btn.dataset.ready;
  btn.disabled = true; btn.textContent = '⏳ Importing...'; btn.style.background = ''; btn.style.color = '';
  try {
    const resp = await fetch('anki_cards.json');
    if (!resp.ok) throw new Error('Failed to fetch anki_cards.json: ' + resp.status);
    const imported = await resp.json();
    const d = getCards();
    const existingIds = new Set(d.cards.map(c => c.id));
    let added = 0, skipped = 0;
    imported.forEach(c => {
      if (existingIds.has(c.id)) { skipped++; return; }
      d.cards.push(c); added++;
    });
    save(d);
    renderCards();
    alert('✅ Imported ' + added + ' cards! (' + skipped + ' duplicates skipped)\n\n📊 Due now: ' +
      d.cards.filter(c => (c.due || 0) <= todayDayNum() && c.queue === 2).length +
      ' | New: ' + d.cards.filter(c => c.queue === 0).length +
      ' | Total: ' + d.cards.length);
  } catch (e) {
    alert('❌ Import failed: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📦 Seed Anki Deck'; }
  }
}

// ============ ADD CARDS MODE SWITCHER ============
function showAddCardMode(mode) {
  ['manual', 'vocab', 'premade'].forEach(m => {
    const panel = document.getElementById('add-mode-' + m);
    const btn = document.getElementById('add-mode-' + m + '-btn');
    if (panel) panel.style.display = m === mode ? 'block' : 'none';
    if (btn) btn.style.background = m === mode ? 'var(--acc)' : '';
    if (btn) btn.style.color = m === mode ? '#fff' : '';
  });
}

// ============ VOCAB LIST → CLAUDE FLASHCARDS ============
let _csvData = null;

async function submitVocabList() {
  const txt = document.getElementById('vocab-list-text').value.trim();
  if (!txt) { alert('Enter some words or phrases first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const words = txt.split(/\n/).map(w => w.trim()).filter(w => w.length > 0);
  if (words.length === 0) { alert('No words found.'); return; }
  const status = document.getElementById('vocab-list-status');

  // Batch words into chunks of 10 to avoid token limit truncation
  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    batches.push(words.slice(i, i + BATCH_SIZE));
  }

  let allCards = [];
  let batchNum = 0;
  try {
    for (const batch of batches) {
      batchNum++;
      status.textContent = '⏳ Generating flashcards... batch ' + batchNum + '/' + batches.length + ' (' + allCards.length + ' cards so far)';
      const prompt = `You are generating flashcards for an Italian language learner at C1-C2 level.\n\nThe student wants flashcards for these words/phrases:\n${batch.map(w => '- ' + w).join('\n')}\n\n${FLASH_CARD_RULES}\n\nFor each word/phrase, generate the paired definition card and cloze card following the rules above.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. No markdown fences, no commentary — just the JSON array. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
      const resp = await callClaude(key, prompt, 8192);
      const cards = _parseCardsJSON(resp);
      allCards = allCards.concat(cards);
    }
    if (allCards.length > 0) {
      status.textContent = '✅ Generated ' + allCards.length + ' cards from ' + words.length + ' words. Review below.';
      renderFlashcardReview('vocab-list-card-review', allCards, 'Vocab list: ' + words.join(', '), 'vocab');
    } else {
      status.textContent = '⚠️ No cards parsed. Try again.';
    }
    addLog('action', 'Generated ' + allCards.length + ' cards from vocab list (' + words.length + ' words)');
  } catch (e) {
    if (allCards.length > 0) {
      status.textContent = '⚠️ Error on batch ' + batchNum + ', but got ' + allCards.length + ' cards from earlier batches. Review below.';
      renderFlashcardReview('vocab-list-card-review', allCards, 'Vocab list: ' + words.join(', '), 'vocab');
    } else {
      status.textContent = '❌ Error: ' + e.message;
    }
  }
}

// ============ CSV / TSV IMPORT ============
function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('csv-file-name').textContent = file.name;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    // Detect delimiter: tab, comma, or semicolon
    const firstLine = text.split('\n')[0] || '';
    let delim = ',';
    if (firstLine.includes('\t')) delim = '\t';
    else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delim = ';';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const rows = lines.map(l => {
      // Simple CSV parse (handles basic quoting)
      const result = [];
      let current = '', inQuotes = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (inQuotes) {
          if (ch === '"' && l[i+1] === '"') { current += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else current += ch;
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === delim) { result.push(current); current = ''; }
          else current += ch;
        }
      }
      result.push(current);
      return result;
    });
    if (rows.length === 0) { alert('File appears empty.'); return; }
    _csvData = { rows, hasHeader: false };
    // Guess if first row is a header (non-empty, text-like, different pattern)
    if (rows.length > 1) {
      const first = rows[0];
      const isHeader = first.every(c => c.length > 0 && c.length < 40 && !/\d{4}/.test(c));
      _csvData.hasHeader = isHeader;
    }
    // Populate column selectors
    const numCols = Math.max(...rows.map(r => r.length));
    const frontSel = document.getElementById('csv-front-col');
    const backSel = document.getElementById('csv-back-col');
    frontSel.innerHTML = '';
    backSel.innerHTML = '';
    for (let i = 0; i < numCols; i++) {
      const label = _csvData.hasHeader && rows[0][i] ? rows[0][i] : 'Column ' + (i + 1);
      frontSel.innerHTML += '<option value="' + i + '">' + escHtml(label) + '</option>';
      backSel.innerHTML += '<option value="' + i + '">' + escHtml(label) + '</option>';
    }
    frontSel.value = '0';
    backSel.value = numCols > 1 ? '1' : '0';
    document.getElementById('csv-preview').style.display = 'block';
    renderCSVPreview();
  };
  reader.readAsText(file);
}

function renderCSVPreview() {
  if (!_csvData) return;
  const frontCol = parseInt(document.getElementById('csv-front-col').value);
  const backCol = parseInt(document.getElementById('csv-back-col').value);
  const startRow = _csvData.hasHeader ? 1 : 0;
  const dataRows = _csvData.rows.slice(startRow);
  const preview = dataRows.slice(0, 10);
  const table = document.getElementById('csv-preview-table');
  let html = '<thead><tr><th style="font-size:11px">#</th><th style="font-size:11px">Front</th><th style="font-size:11px">Back</th></tr></thead><tbody>';
  preview.forEach((row, i) => {
    const f = (row[frontCol] || '').trim();
    const b = (row[backCol] || '').trim();
    html += '<tr><td style="font-size:11px;color:var(--muted)">' + (i + 1) + '</td><td style="font-size:12px">' + escHtml(f) + '</td><td style="font-size:12px">' + escHtml(b) + '</td></tr>';
  });
  if (dataRows.length > 10) html += '<tr><td colspan="3" style="font-size:11px;color:var(--muted);text-align:center">... and ' + (dataRows.length - 10) + ' more rows</td></tr>';
  html += '</tbody>';
  table.innerHTML = html;
  document.getElementById('csv-row-count').textContent = dataRows.length;
}

function importCSVCards() {
  if (!_csvData) { alert('No file loaded.'); return; }
  const frontCol = parseInt(document.getElementById('csv-front-col').value);
  const backCol = parseInt(document.getElementById('csv-back-col').value);
  const startRow = _csvData.hasHeader ? 1 : 0;
  const dataRows = _csvData.rows.slice(startRow);
  let count = 0;
  dataRows.forEach(row => {
    const f = (row[frontCol] || '').trim();
    const b = (row[backCol] || '').trim();
    if (f && b) { addCard(f, b, ''); count++; }
  });
  if (count > 0) {
    alert('✅ Imported ' + count + ' cards!');
    renderCards();
    // Reset
    _csvData = null;
    document.getElementById('csv-preview').style.display = 'none';
    document.getElementById('csv-file-name').textContent = '';
    document.getElementById('csv-file-input').value = '';
  } else {
    alert('No valid cards found. Check your column selection.');
  }
  addLog('action', 'CSV import: ' + count + ' cards');
}

function renderCardBrowse() {
  const d = getCards(), el = document.getElementById('card-browse');
  if (!el) return;
  const search = (document.getElementById('card-search') || {}).value || '';
  const filter = (document.getElementById('card-filter') || {}).value || 'all';
  const now = todayDayNum();
  let cards = d.cards;
  if (search) { const s = search.toLowerCase(); cards = cards.filter(c => c.front.toLowerCase().includes(s) || c.back.toLowerCase().includes(s)); }
  if (filter === 'new') cards = cards.filter(c => c.queue === 0);
  else if (filter === 'learning') cards = cards.filter(c => c.queue === 1);
  else if (filter === 'review') cards = cards.filter(c => c.queue === 2);
  else if (filter === 'due') cards = cards.filter(c => (c.due || 0) <= now);
  if (cards.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;font-style:italic">No cards match.</p>'; return; }
  el.innerHTML = cards.slice(0, 100).map(c => {
    const status = c.queue === 0 ? '<span class="label l-ital">New</span>' : c.queue === 1 ? '<span class="label l-gym">Learning</span>' : '<span class="label l-diss">Review</span>';
    const dueIn = (c.due || 0) - now;
    const dueStr = dueIn <= 0 ? '<span style="color:var(--red);font-weight:600">Due</span>' : fmtIvl(dueIn);
    return '<div class="iitem"><div class="itxt"><b>' + escHtml(c.front) + '</b><br><span style="font-size:12px;color:var(--muted)">' + escHtml(c.back) + '</span></div>' + status + '<span style="font-size:11px;color:var(--muted)">' + dueStr + '</span><button class="btn" style="font-size:10px;padding:2px 6px;color:var(--red)" onclick="deleteCard(\'' + c.id + '\')">✕</button></div>';
  }).join('');
}

function deleteCard(id) {
  if (!confirm('Delete this card?')) return;
  const d = getCards(); d.cards = d.cards.filter(c => c.id !== id); save(d); renderCardBrowse();
}

// ============ TRANSLATE TAB ============
let trArticleCards = [];
function renderTranslate() {
  const d = load();
  const history = d.readingHistory || [];
  const el = document.getElementById('tr-history');
  if (el) {
    el.innerHTML = history.length === 0 ? '<p style="color:var(--muted);font-size:13px;font-style:italic">No articles read yet.</p>' :
      history.slice(-20).reverse().map(h => '<div class="lentry action"><span class="lt">' + h.date + '</span> ' + escHtml(h.title || 'Untitled') + (h.cardCount ? ' — <b>' + h.cardCount + ' cards</b>' : '') + '</div>').join('');
  }
}

async function trFetchURL() {
  const url = document.getElementById('tr-url').value.trim();
  if (!url) { alert('Paste a URL first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('tr-status');
  status.textContent = '⏳ Fetching article...';
  try {
    // Try multiple CORS proxies in order
    const proxies = [
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      'https://corsproxy.io/?' + encodeURIComponent(url),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
    ];
    let html = null;
    for (const proxyUrl of proxies) {
      try {
        status.textContent = '⏳ Fetching article...';
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (resp.ok) { html = await resp.text(); break; }
      } catch (e) { continue; }
    }
    if (!html) {
      status.textContent = '⚠️ Could not fetch URL (CORS blocked). Paste the article text below instead.';
      document.querySelector('#tab-translate details').open = true;
      return;
    }
    // Extract article text from HTML
    status.textContent = '⏳ Extracting article text...';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Remove scripts, styles, nav, footer, ads
    doc.querySelectorAll('script,style,nav,footer,header,aside,iframe,.ad,.ads,.sidebar,.menu,.nav,.cookie,.banner,figure,figcaption').forEach(el => el.remove());
    // Try common article selectors
    let articleEl = doc.querySelector('article') || doc.querySelector('[role="main"]') || doc.querySelector('.post-content') || doc.querySelector('.article-body') || doc.querySelector('.entry-content') || doc.querySelector('.story-body') || doc.querySelector('main');
    let text = '';
    if (articleEl) {
      // Get paragraphs from article element
      const paras = articleEl.querySelectorAll('p, h1, h2, h3, blockquote');
      text = Array.from(paras).map(p => p.textContent.trim()).filter(t => t.length > 20).join('\n\n');
    }
    if (!text || text.length < 100) {
      // Fallback: get all paragraphs from body
      const allParas = doc.querySelectorAll('p');
      text = Array.from(allParas).map(p => p.textContent.trim()).filter(t => t.length > 30).join('\n\n');
    }
    if (!text || text.length < 50) {
      status.textContent = '⚠️ Could not extract article text. Paste it manually below.';
      document.querySelector('#tab-translate details').open = true;
      return;
    }
    // Try to get title
    const titleEl = doc.querySelector('h1') || doc.querySelector('title');
    const title = titleEl ? titleEl.textContent.trim() : '';
    status.textContent = '✅ Fetched! ' + text.split(/\s+/).length + ' words extracted. Sending to Claude...';
    // Put text in the raw textarea for reference
    document.getElementById('tr-raw').value = text;
    // Now translate it
    await trTranslateText(text, title);
  } catch (e) {
    status.textContent = '❌ Fetch error: ' + e.message + '. Try pasting the text below.';
    document.querySelector('#tab-translate details').open = true;
  }
}

async function trTranslateRaw() {
  const raw = document.getElementById('tr-raw').value.trim();
  if (!raw || raw.length < 50) { alert('Paste at least a paragraph of Italian text.'); return; }
  await trTranslateText(raw);
}

async function trTranslateText(raw, fetchedTitle) {
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('tr-status');
  status.textContent = '⏳ Translating with Claude... (this may take a moment)';
  try {
    const prompt = `You are a professional Italian-English translator. Translate the following Italian text paragraph by paragraph. 

Return ONLY a JSON array where each element is an object with "it" (Italian paragraph) and "en" (English translation). Keep paragraphs aligned. Preserve the original paragraph breaks.

Also include a "title" field at the top level if you can infer the article title, and a "difficulty" field (A2/B1/B2/C1/C2).

Return format:
{"title": "...", "difficulty": "...", "paragraphs": [{"it": "...", "en": "..."}, ...]}

Italian text:
${raw}`;

    const resp = await callClaude(key, prompt);
    // Try to parse JSON from response
    let data;
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      data = JSON.parse(jsonMatch ? jsonMatch[0] : resp);
    } catch {
      // Fallback: treat as plain text, split by double newlines
      const paras = raw.split(/\n\n+/).filter(p => p.trim());
      data = { title: 'Untitled Article', difficulty: '?', paragraphs: paras.map(p => ({ it: p.trim(), en: '(translation pending)' })) };
      // Try a simpler translation request
      status.textContent = '⏳ Retrying with simpler format...';
      const resp2 = await callClaude(key, 'Translate each paragraph from Italian to English. Return one English paragraph per line, separated by |||.\n\n' + paras.map(p => p.trim()).join('\n\n'));
      const translations = resp2.split('|||').map(t => t.trim());
      data.paragraphs = paras.map((p, i) => ({ it: p.trim(), en: translations[i] || '...' }));
    }

    // Render the result
    document.getElementById('tr-title').textContent = data.title || 'Article';
    document.getElementById('tr-meta').textContent = 'Difficulty: ' + (data.difficulty || '?') + ' | ' + data.paragraphs.length + ' paragraphs';
    const tbody = document.getElementById('tr-tbody');
    tbody.innerHTML = data.paragraphs.map(p =>
      '<tr><td class="it-col">' + escHtml(p.it) + '</td><td>' + escHtml(p.en) + '</td></tr>'
    ).join('');
    document.getElementById('tr-result-card').style.display = 'block';
    document.getElementById('tr-reflection-card').style.display = 'block';
    trArticleCards = [];
    trCollectedWords = [];
    const collCard = document.getElementById('tr-collected-card');
    if (collCard) collCard.style.display = 'none';
    status.textContent = '✅ Translation complete! Highlight Italian words to collect them for flashcards.';
    // Store current article data for logging
    CAL._currentArticle = { title: data.title, difficulty: data.difficulty, text: raw.slice(0, 200) };
    // Bind text selection for card creation
    trBindSelection();
    addLog('action', 'Translated article: ' + (data.title || 'Untitled'));
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

let trCollectedWords = [];

function trBindSelection() {
  const tbody = document.getElementById('tr-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('.it-col').forEach(td => {
    td.addEventListener('mouseup', trHandleSelection);
    td.addEventListener('touchend', trHandleSelection);
  });
}

function trHandleSelection(e) {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text || text.length < 2 || text.length > 100) return;
  // Add to collected words (no popup — just collect)
  if (trCollectedWords.some(w => w.toLowerCase() === text.toLowerCase())) return; // skip dupes
  trCollectedWords.push(text);
  trRenderCollected();
  // Brief visual feedback
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.cssText = 'background:var(--ol);border-radius:2px;padding:0 2px;transition:background .5s';
  range.surroundContents(span);
  sel.removeAllRanges();
}

function trRenderCollected() {
  const card = document.getElementById('tr-collected-card');
  const list = document.getElementById('tr-collected-list');
  const ct = document.getElementById('tr-coll-ct');
  if (!card || !list) return;
  card.style.display = trCollectedWords.length > 0 ? 'block' : 'none';
  // Also show reflection card when words are collected
  // Reflection card visibility is now controlled when article loads, not by collected words
  ct.textContent = trCollectedWords.length;
  list.innerHTML = trCollectedWords.map((w, i) =>
    '<div class="tr-card-item"><span class="front" style="flex:1">' + escHtml(w) + '</span>' +
    '<button class="btn" style="font-size:11px;padding:2px 6px;color:var(--red);border-color:var(--red)" onclick="trRemoveWord(' + i + ')">✕</button></div>'
  ).join('');
}

function trRemoveWord(i) {
  trCollectedWords.splice(i, 1);
  trRenderCollected();
}

function trClearCollected() {
  if (trCollectedWords.length && !confirm('Clear all ' + trCollectedWords.length + ' collected words?')) return;
  trCollectedWords = [];
  trRenderCollected();
  document.getElementById('tr-created-cards').style.display = 'none';
}

async function trSubmitWords() {
  if (!trCollectedWords.length) { alert('Highlight some Italian words first.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const status = document.getElementById('tr-words-status');
  status.textContent = '⏳ Generating flashcards for ' + trCollectedWords.length + ' words...';
  try {
    const article = CAL._currentArticle || {};
    const articleContext = article.title ? 'Article: "' + article.title + '" (' + (article.difficulty || '?') + ')\n' : '';
    const prompt = `You are generating flashcards for an Italian language learner at C1-C2 level.\n\n${articleContext}The student highlighted these words/phrases while reading:\n${trCollectedWords.map(w => '- ' + w).join('\n')}\n\n${FLASH_CARD_RULES}\n\nFor each word/phrase, generate the paired definition card and cloze card following the rules above.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields. Example:\n[{"front":"...","back":"..."},{"front":"...","back":"..."}]`;
    const resp = await callClaude(key, prompt);
    const cards = _parseCardsJSON(resp);
    if (cards.length > 0) {
      status.textContent = '✅ Generated ' + cards.length + ' cards. Review below.';
      renderFlashcardReview('tr-words-card-review', cards, articleContext + 'Collected words: ' + trCollectedWords.join(', '), 'reading');
    } else {
      status.textContent = '⚠️ No cards parsed. Try again.';
    }
    addLog('action', 'Generated ' + cards.length + ' cards from ' + trCollectedWords.length + ' collected words');
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
}

function trUpdReflWC() {
  const txt = document.getElementById('tr-refl-txt').value.trim();
  const wc = txt ? txt.split(/\s+/).filter(w => w).length : 0;
  const el = document.getElementById('tr-refl-wc');
  el.textContent = wc + ' / 50 words';
  el.className = 'wc' + (wc < 50 ? ' bad' : '');
}

function trGetNextArticleSlot() {
  const dd = dayData(today());
  const day = dd.days[today()];
  if (!day.habits || !day.habits.art1) return 1;
  return 2;
}

function trUpdateSubmitBtn() {
  const btn = document.getElementById('tr-refl-submit-btn');
  if (btn) btn.textContent = '✅ Submit as Article ' + trGetNextArticleSlot();
}

function trSubmitReflectionAuto() {
  trSubmitReflection(trGetNextArticleSlot());
}

async function trSubmitReflection(num) {
  const txt = document.getElementById('tr-refl-txt').value.trim();
  const wc = txt ? txt.split(/\s+/).filter(w => w).length : 0;
  if (wc < 50) { alert('Write at least 50 words in Italian.'); return; }
  const key = localStorage.getItem('cc_apikey');
  if (!key) { alert('Set your Anthropic API key in the Claude tab first.'); switchTab('claude'); return; }
  const article = CAL._currentArticle || {};
  const title = article.title || document.getElementById('tr-title').textContent || 'Untitled';
  const status = document.getElementById('tr-refl-status');
  status.textContent = '⏳ Sending reflection to Claude for feedback + flashcard generation...';
  try {
    const feedbackPrompt = `Lo studente ha letto un articolo italiano intitolato "${title}" e ha scritto questa riflessione in italiano:\n\n"${txt}"\n\nIstruzioni:\n1. Per prima cosa, riscrivi COMPLETAMENTE il testo corretto dall'inizio alla fine — il testo intero, non solo frammenti.\n2. Poi elenca ogni errore: originale → corretto, con una spiegazione IN ITALIANO del perché era sbagliato.\n3. Valuta il livello (A2/B1/B2/C1/C2).\n\nSii diretto e fattuale. Niente incoraggiamenti, niente complimenti, niente ammorbidimenti. Solo correzioni e spiegazioni.`;
    const feedbackResp = await callClaude(key, feedbackPrompt);
    document.getElementById('tr-refl-result').style.display = 'block';
    document.getElementById('tr-refl-feedback').innerHTML = feedbackResp.replace(/\n/g, '<br>');
    // Log as article on Today tab
    const titleEl = document.getElementById('art' + num + '-t');
    const thoughtsEl = document.getElementById('art' + num + '-th');
    if (titleEl) titleEl.value = title + (article.difficulty ? ' [' + article.difficulty + ']' : '');
    if (thoughtsEl) thoughtsEl.value = txt;
    const chk = document.getElementById('h-art' + num);
    if (chk) chk.checked = true;
    const st = document.getElementById('art' + num + '-status');
    if (st) st.textContent = '✅ ' + title;
    const d = load();
    if (!d.readingHistory) d.readingHistory = [];
    d.readingHistory.push({ date: today(), title, difficulty: article.difficulty, cardCount: 0, reflectionWords: wc });
    save(d);
    // Also persist article habit to day data so Today tab checkmark survives reload
    const dd2 = dayData(today());
    const dayObj = dd2.days[today()];
    const artKey = 'art' + num;
    dayObj.habits[artKey] = true;
    dayObj.habits[artKey + 'Title'] = title + (article.difficulty ? ' [' + article.difficulty + ']' : '');
    dayObj.habits[artKey + 'Thoughts'] = txt;
    save(dd2);
    // Now generate flashcards from the reflection corrections
    const cardPrompt = `You are generating flashcards from a corrected Italian reflection on an article.\n\nArticle: "${title}"\nStudent reflection:\n"${txt}"\n\nClaude's corrections:\n${feedbackResp}\n\n${FLASH_CARD_RULES}\n\nBased on the corrections and the student's text, generate 5-8 flashcard pairs (definition + cloze for each item) following the rules.\n\nReturn ONLY a JSON array of objects with "front" and "back" string fields.\n[{"front":"...","back":"..."}]`;
    const cardResp = await callClaude(key, cardPrompt);
    const cards = _parseCardsJSON(cardResp);
    if (cards.length > 0) {
      renderFlashcardReview('tr-refl-card-review', cards, 'Article: ' + title + '\nReflection:\n' + txt + '\n\nCorrections:\n' + feedbackResp, 'reading');
    }
    status.textContent = '✅ Feedback + ' + cards.length + ' cards generated. Logged as Article ' + num + '.';
    addLog('action', 'Article ' + num + ' reflection: ' + title + ' + ' + cards.length + ' cards');
    trUpdateSubmitBtn();
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
  }
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
function saveWeekNotes() {
  const el = document.getElementById('week-notes');
  if (!el) return;
  const wk = weekId();
  const wd = weekData(wk);
  wd.weeks[wk].notes = el.innerHTML;
  save(wd);
}
function loadWeekNotes() {
  const wk = weekId();
  const wd = weekData(wk);
  const el = document.getElementById('week-notes');
  if (el && wd.weeks[wk] && wd.weeks[wk].notes) el.innerHTML = wd.weeks[wk].notes;
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
  if (el.id !== 'today-notes' && el.id !== 'week-notes') return;

  const li = _notesListContext();
  if (!li) return; // only act when cursor is in a list item

  e.preventDefault();

  if (e.shiftKey) {
    // Outdent
    document.execCommand('outdent');
  } else {
    // Indent
    document.execCommand('indent');
  }

  // Fire save
  if (el.id === 'today-notes') saveTodayNotes();
  else saveWeekNotes();
}

// Auto-detect "1." or "1)" at the start of a line and convert to ordered list
function _handleAutoNumberedList(e) {
  const el = e.target;
  if (!el || el.getAttribute('contenteditable') !== 'true') return;
  if (el.id !== 'today-notes' && el.id !== 'week-notes') return;

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
    if (el.id === 'today-notes') saveTodayNotes();
    else saveWeekNotes();
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
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '8') {
      e.preventDefault(); document.execCommand('insertUnorderedList');
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

// ============ ARTICLE OF THE DAY ============
const AOTD_FEEDS = {
  italian: [
    { name: 'Il Post', url: 'https://www.ilpost.it/feed/' },
    { name: 'La Repubblica', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml' },
    { name: 'Internazionale', url: 'https://www.internazionale.it/sitemaps/rss.xml' },
    { name: 'Doppiozero', url: 'https://www.doppiozero.com/rss.xml' },
    { name: 'Il Fatto Quotidiano', url: 'https://www.ilfattoquotidiano.it/feed/' },
    { name: 'Fanpage', url: 'https://www.fanpage.it/feed/' },
    { name: 'ANSA', url: 'https://www.ansa.it/sito/ansait_rss.xml' },
    { name: 'Il Manifesto', url: 'https://ilmanifesto.it/feed' },
    { name: 'Rivista Studio', url: 'https://www.rivistastudio.com/feed/' },
    { name: 'Il Tascabile', url: 'https://www.iltascabile.com/feed/' },
    { name: 'Valigia Blu', url: 'https://www.vfrancia.me/valigiablu/feed/' },
    { name: 'Domani', url: 'https://www.editorialedomani.it/feed' },
    { name: 'Wired Italia', url: 'https://www.wired.it/feed/rss' },
    { name: 'Vita', url: 'https://www.vita.it/feed/' }
  ],
  english: [
    { name: 'Aeon', url: 'https://aeon.co/feed.rss' },
    { name: 'The Guardian Long Read', url: 'https://www.theguardian.com/news/series/the-long-read/rss' },
    { name: 'The Conversation', url: 'https://theconversation.com/articles.atom' },
    { name: 'ProPublica', url: 'https://feeds.propublica.org/propublica/main' },
    { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'The Intercept', url: 'https://theintercept.com/feed/?rss' },
    { name: 'Vox', url: 'https://www.vox.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/' },
    { name: 'Rest of World', url: 'https://restofworld.org/feed/' },
    { name: 'NYRB', url: 'https://www.nybooks.com/feed/' },
    { name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' }
  ],
  other: [
    { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
    { name: 'France 24', url: 'https://www.france24.com/fr/rss' },
    { name: 'Die Zeit', url: 'https://newsfeed.zeit.de/index' },
    { name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-de-all' },
    { name: 'Der Spiegel', url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
    { name: 'NZZ', url: 'https://www.nzz.ch/recent.rss' },
    { name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
    { name: 'BBC Mundo', url: 'https://www.bbc.com/mundo/rss.xml' },
    { name: 'The Wire (India)', url: 'https://thewire.in/feed' },
    { name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/feed/' },
    { name: 'NHK World', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml' },
    { name: 'Mediapart Blog', url: 'https://blogs.mediapart.fr/feed' }
  ]
};

const AOTD_PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
];

const AOTD_METHODOLOGY = `You are a reading advisor for a reader with advanced training in economics and the humanities.

TASK: From the pool of recent articles below, select ONE that best matches the following criteria. You may also REJECT the entire pool if nothing meets the bar.

SOURCE STRATEGY — aim for balance over time. Yesterday's pick was from the "{lastCat}" category. Prefer a different category today if quality allows.
Categories: Italian-language, English-language, Non-Anglophone/non-Italian

QUALITY CONTROL — this pool comes from ~40 feeds of varying quality. You MUST apply strict editorial judgment:
- REJECT clickbait, listicles, wire-service rewrites, aggregated news briefs, PR-driven announcements, and content-farm filler
- REJECT anything that merely describes events without analysis ("X happened yesterday")
- REJECT promotional or sponsored content, product announcements, celebrity gossip
- REJECT pieces shorter than ~800 words (based on description length — if the description is a single sentence with no substance, it's probably a brief)
- PREFER long-form: essays, reported features, investigations, serious reviews, deep analysis
- PREFER pieces with original reporting or a distinct intellectual argument
- PENALIZE duplicative coverage — if multiple outlets ran the same story, skip it unless one has a meaningfully different angle
- ASK: "Would this be worth 10+ minutes of focused reading for someone who reads seriously?" If no, skip it.

SUBJECT AREAS TO PRIORITIZE (at least one, preferably two):
- Political economy of technology (AI, data, platforms, measurement)
- Media, expertise, and knowledge production
- Migration, borders, categorization, and state capacity
- Cultural responses to economic or technological change
- Institutions whose public narratives diverge from their actual functioning

ACCESSIBILITY CONSTRAINT:
- The reader subscribes to: Il Post, New York Times, Wall Street Journal
- STRONGLY prefer articles that are either (a) from a subscribed outlet, (b) known to be freely accessible (e.g. Aeon, Guardian, BBC, NPR, ProPublica, The Conversation, Quanta, Rest of World, Al Jazeera, DW, France 24, BBC Mundo, NHK World), or (c) from outlets that typically don't paywall long-form content
- If recommending a paywalled piece from a non-subscribed outlet, add "⚠️ likely paywalled" at the start of the blurb
- Many feeds in this pool are free — lean toward those unless a subscribed or exceptional piece clearly wins

ANALYTICAL CONSTRAINTS:
- The article should interrogate a commonly accepted assumption rather than merely describe events
- Prefer pieces that link abstract concepts (incentives, norms, classification, legitimacy) to a concrete case
- Tone should be skeptical or analytical, not celebratory, alarmist, or moralizing
- Avoid culture-war framing, hype about "the future of X," or managerial optimism

AUDIENCE CALIBRATION:
- The reader is comfortable with theory and abstraction but impatient with jargon
- Do not pick articles that merely explain basic concepts unless doing so IS the argument

STYLE PREFERENCES:
- Clear argumentative spine; the core claim should be expressible in one sentence
- Bonus for authors who quietly dissent from a dominant narrative

BIAS RATING — after identifying the source, assign a political bias rating from this scale:
far-left | left | left-center | center | center-right | right | far-right
Base this on the outlet's overall editorial posture, not the individual article.

FAR-RIGHT EXCLUSION — STRONGLY avoid far-right publications. Only include one if the specific piece contains genuinely rigorous analysis that transcends the outlet's editorial posture — this should be extremely rare.

RESPONSE FORMAT — return ONLY valid JSON, no markdown fences:
If you find a worthy article:
{"title":"...","url":"...","source":"...","bias":"left|left-center|center|center-right|right","category":"italian|english|other","blurb":"One sentence on why this is worth reading","image":"image_url_or_null","paywalled":false}

If NOTHING in the pool meets the bar, respond with:
{"resample":true,"reason":"brief explanation of why the pool was weak"}`;

async function fetchWithProxy(url) {
  for (const mkProxy of AOTD_PROXIES) {
    try {
      const r = await fetch(mkProxy(url), { signal: AbortSignal.timeout(12000) });
      if (r.ok) return await r.text();
    } catch(e) { /* try next proxy */ }
  }
  return null;
}

function parseRSSItems(xml, sourceName) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return [];
    const items = [...doc.querySelectorAll('item')].slice(0, 15);
    return items.map(it => {
      const get = tag => { const el = it.querySelector(tag); return el ? el.textContent.trim() : ''; };
      let image = null;
      const media = it.querySelector('content[url]') || it.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
      if (media) image = media.getAttribute('url');
      if (!image) { const enc = it.querySelector('enclosure[url]'); if (enc && (enc.getAttribute('type')||'').startsWith('image')) image = enc.getAttribute('url'); }
      const desc = get('description').replace(/<[^>]+>/g, '').slice(0, 400);
      return { title: get('title'), link: get('link'), description: desc, pubDate: get('pubDate'), source: sourceName, image };
    }).filter(i => i.title && i.link);
  } catch(e) { return []; }
}

async function fetchAllRSSItems() {
  const allFeeds = [...AOTD_FEEDS.italian.map(f=>({...f,cat:'italian'})), ...AOTD_FEEDS.english.map(f=>({...f,cat:'english'})), ...AOTD_FEEDS.other.map(f=>({...f,cat:'other'}))];
  const results = await Promise.allSettled(allFeeds.map(async feed => {
    const xml = await fetchWithProxy(feed.url);
    if (!xml) return [];
    return parseRSSItems(xml, feed.name).map(item => ({ ...item, category: feed.cat }));
  }));
  let pool = [];
  results.forEach(r => { if (r.status === 'fulfilled') pool.push(...r.value); });
  // Sort by date (most recent first), dedupe by title
  pool.sort((a,b) => { try { return new Date(b.pubDate) - new Date(a.pubDate); } catch(e) { return 0; } });
  const seen = new Set();
  pool = pool.filter(i => { const k = i.title.toLowerCase().slice(0,60); if (seen.has(k)) return false; seen.add(k); return true; });
  return pool.slice(0, 60);
}

async function askClaudeForArticle(pool, lastCat, isRetry) {
  const key = localStorage.getItem('cc_apikey');
  if (!key) throw new Error('NO_KEY');
  const historyContext = getAotdHistorySummary();
  const prompt = AOTD_METHODOLOGY.replace('{lastCat}', lastCat || 'none') +
    historyContext +
    (isRetry ? '\n\nNOTE: This is a second pass. Nothing met the bar on the first attempt. Lower your threshold slightly but maintain core quality standards. If still nothing, pick the least-bad option and note it is a compromise in the blurb.' : '') +
    '\n\nARTICLE POOL (' + pool.length + ' items):\n' + JSON.stringify(pool.map(({title,link,source,description,category,image}) => ({title,url:link,source,description,category,image})), null, 0);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 512, messages: [{ role: 'user', content: prompt }] })
  });
  if (!resp.ok) throw new Error('Claude API error: ' + resp.status);
  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  // Extract JSON from response (handle possible markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');
  return JSON.parse(jsonMatch[0]);
}

function aotdTrack(action) {
  // action: 'click' (read), 'skip' (new pick), 'ignore' (day ended without click)
  const cached = localStorage.getItem('aotd_data');
  if (!cached) return;
  try {
    const article = JSON.parse(cached);
    const d = load();
    if (!d.aotdHistory) d.aotdHistory = [];
    // Don't double-log the same article+action
    const existing = d.aotdHistory.find(h => h.date === today() && h.title === article.title && h.action === action);
    if (existing) return;
    d.aotdHistory.push({
      date: today(),
      title: article.title,
      source: article.source,
      category: article.category,
      bias: article.bias || null,
      action: action,
      ts: new Date().toISOString()
    });
    // Keep last 100 entries (raw), consolidation handles the rest
    if (d.aotdHistory.length > 100) d.aotdHistory = d.aotdHistory.slice(-100);
    save(d);
    // Check if we've crossed a 20-entry threshold since last consolidation
    const lastConsolidatedAt = d.aotdConsolidatedAt || 0;
    const totalSinceConsolidation = d.aotdHistory.length - lastConsolidatedAt;
    if (totalSinceConsolidation >= 20) {
      aotdConsolidate(); // fire-and-forget async
    }
  } catch(e) { /* ignore */ }
}

async function aotdConsolidate() {
  const key = localStorage.getItem('cc_apikey');
  if (!key) return;
  const d = load();
  const hist = d.aotdHistory || [];
  if (hist.length < 20) return;
  const existingPrior = d.aotdPrior || '';
  const clicked = hist.filter(h => h.action === 'click');
  const skipped = hist.filter(h => h.action === 'skip');
  const prompt = `You are consolidating a reader's article recommendation history into a compact preference profile.

${existingPrior ? 'EXISTING PRIOR (from earlier consolidation):\n' + existingPrior + '\n\n' : ''}NEW DATA (${hist.length} entries since last consolidation):

Articles READ (${clicked.length}):
${clicked.map(h => '- "' + h.title + '" (' + h.source + ', ' + h.category + ')').join('\n') || '(none)'}

Articles SKIPPED (${skipped.length}):
${skipped.map(h => '- "' + h.title + '" (' + h.source + ', ' + h.category + ')').join('\n') || '(none)'}

TASK: Produce a COMPACT reader preference profile (max 300 words) that captures:
1. Source preferences (which outlets get read vs skipped)
2. Topic preferences (what subjects attract vs repel)
3. Category balance (Italian/English/Other reading ratio)
4. Any emerging patterns in what makes the reader click vs skip
5. Concrete guidance for future article selection

${existingPrior ? 'UPDATE the existing prior with these new signals — reinforce confirmed patterns, adjust any that new data contradicts.' : 'Create the initial profile from scratch.'}

Return ONLY the preference profile text, no JSON wrapping. Be direct and specific.`;

  try {
    const resp = await callClaude(key, prompt);
    const d2 = load();
    d2.aotdPrior = resp.trim();
    d2.aotdConsolidatedAt = (d2.aotdHistory || []).length;
    save(d2);
    addLog('action', 'AOTD preferences consolidated (' + hist.length + ' entries → compact prior)');
  } catch(e) {
    console.error('AOTD consolidation failed:', e);
  }
}

function getAotdHistorySummary() {
  const d = load();
  const hist = d.aotdHistory || [];
  const prior = d.aotdPrior || '';
  const consolidatedAt = d.aotdConsolidatedAt || 0;

  if (hist.length === 0 && !prior) return '';

  let summary = '\n\nUSER READING HISTORY (use this to calibrate future picks):\n';

  // If we have a consolidated prior, use it as the primary signal
  if (prior) {
    summary += '\n--- CONSOLIDATED PREFERENCE PROFILE (from ' + consolidatedAt + ' tracked articles) ---\n';
    summary += prior + '\n';
    summary += '--- END PROFILE ---\n';
  }

  // Only list individual entries SINCE the last consolidation
  const recentHist = hist.slice(consolidatedAt);
  if (recentHist.length === 0 && prior) {
    summary += '\nNo new articles tracked since last consolidation.\n';
    summary += '\nUse the preference profile above as a STRONG signal for source, topic, and category selection.';
    return summary;
  }

  // If no prior exists yet, show all entries; otherwise only recent ones
  const displayHist = prior ? recentHist : hist;
  const clicked = displayHist.filter(h => h.action === 'click');
  const skipped = displayHist.filter(h => h.action === 'skip');

  if (prior) {
    summary += '\nRECENT ACTIVITY (since last consolidation — ' + recentHist.length + ' new entries):\n';
  } else {
    summary += 'Total tracked: ' + hist.length + ' articles | Read: ' + clicked.length + ' | Skipped: ' + skipped.length + '\n';
  }

  if (clicked.length > 0) {
    summary += '\nArticles the user CLICKED (liked enough to read):\n';
    clicked.slice(-15).forEach(h => { summary += '- "' + h.title + '" (' + h.source + ', ' + h.category + ')\n'; });
  }
  if (skipped.length > 0) {
    summary += '\nArticles the user SKIPPED (hit New Pick — not interesting enough):\n';
    skipped.slice(-15).forEach(h => { summary += '- "' + h.title + '" (' + h.source + ', ' + h.category + ')\n'; });
  }

  // Compute source preferences from the display set
  const srcClicks = {}, srcSkips = {};
  clicked.forEach(h => { srcClicks[h.source] = (srcClicks[h.source] || 0) + 1; });
  skipped.forEach(h => { srcSkips[h.source] = (srcSkips[h.source] || 0) + 1; });
  const allSrcs = new Set([...Object.keys(srcClicks), ...Object.keys(srcSkips)]);
  if (allSrcs.size > 0) {
    summary += '\nSource hit rates' + (prior ? ' (recent only)' : '') + ':\n';
    allSrcs.forEach(s => {
      const c = srcClicks[s] || 0, sk = srcSkips[s] || 0;
      summary += '- ' + s + ': ' + c + ' read, ' + sk + ' skipped\n';
    });
  }

  // Category preferences from the display set
  const catClicks = {}, catSkips = {};
  clicked.forEach(h => { catClicks[h.category] = (catClicks[h.category] || 0) + 1; });
  skipped.forEach(h => { catSkips[h.category] = (catSkips[h.category] || 0) + 1; });
  summary += '\nCategory preferences' + (prior ? ' (recent)' : '') + ': ';
  ['italian','english','other'].forEach(c => {
    summary += c + ' (' + (catClicks[c]||0) + ' read / ' + (catSkips[c]||0) + ' skipped) ';
  });

  summary += '\n\n' + (prior ? 'Use the preference profile AND recent activity as STRONG signals.' : 'Use this data to favor sources and topics the user actually reads, and avoid sources/topics they consistently skip. This is a STRONG signal — weight it heavily.');
  return summary;
}

function renderAOTD(article) {
  document.getElementById('aotd-loading').style.display = 'none';
  document.getElementById('aotd-result').style.display = 'block';
  document.getElementById('aotd-nokey').style.display = 'none';
  document.getElementById('aotd-error').style.display = 'none';
  const linkEl = document.getElementById('aotd-link');
  linkEl.textContent = article.title;
  linkEl.href = article.url;
  const readLink = document.getElementById('aotd-read-link');
  readLink.href = article.url;
  readLink.onclick = function() { aotdTrack('click'); };
  const archEl = document.getElementById('aotd-archive-link');
  if (archEl) { if (article.archiveUrl) { archEl.href = article.archiveUrl; archEl.style.display = ''; } else { archEl.style.display = 'none'; } }
  document.getElementById('aotd-source').textContent = article.source + (article.bias ? ' · ' + article.bias : '');
  const catEl = document.getElementById('aotd-cat');
  catEl.textContent = article.category === 'italian' ? '🇮🇹 Italian' : article.category === 'english' ? '🇬🇧 English' : '🌍 International';
  catEl.className = 'aotd-cat ' + (article.category === 'italian' ? 'it' : article.category === 'english' ? 'en' : 'other');
  document.getElementById('aotd-blurb').textContent = article.blurb || '';
  const claimEl = document.getElementById('aotd-claim');
  claimEl.style.display = 'none';
  const iconEl = document.getElementById('aotd-icon');
  if (article.image) {
    iconEl.innerHTML = `<img src="${article.image}" alt="" onerror="this.parentElement.innerHTML='📰'">`;
  } else {
    try { const domain = new URL(article.url).hostname; iconEl.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" onerror="this.parentElement.innerHTML='📰'">`; } catch(e) { iconEl.innerHTML = '📰'; }
  }
}

async function fetchArticleOfTheDay(force) {
  const today = new Date().toISOString().slice(0, 10);
  const cached = localStorage.getItem('aotd_data');
  const cachedDate = localStorage.getItem('aotd_date');
  if (!force && cached && cachedDate === today) {
    try { renderAOTD(JSON.parse(cached)); return; } catch(e) { /* re-fetch */ }
  }
  const key = localStorage.getItem('cc_apikey');
  if (!key) {
    document.getElementById('aotd-loading').style.display = 'none';
    document.getElementById('aotd-nokey').style.display = 'block';
    return;
  }
  document.getElementById('aotd-loading').style.display = 'block';
  document.getElementById('aotd-result').style.display = 'none';
  document.getElementById('aotd-nokey').style.display = 'none';
  document.getElementById('aotd-error').style.display = 'none';
  try {
    const pool = await fetchAllRSSItems();
    if (pool.length === 0) throw new Error('No RSS feeds responded. Check your connection.');
    const lastCat = localStorage.getItem('aotd_lastCategory') || 'none';
    let result = await askClaudeForArticle(pool, lastCat, false);
    // Handle resample / reject
    if (result.resample) {
      console.log('AOTD: Claude rejected pool —', result.reason);
      result = await askClaudeForArticle(pool, lastCat, true);
      if (result.resample) {
        // Force pick: take the first item from a different category than last time
        const fallback = pool.find(i => i.category !== lastCat) || pool[0];
        result = { title: fallback.title, url: fallback.link, source: fallback.source, category: fallback.category, blurb: 'Auto-selected (Claude found no standout piece today). ' + (fallback.description || ''), claim: null, image: fallback.image };
      }
    }
    // Check Wayback Machine for an archive link
    try {
      const wbResp = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(result.url), { signal: AbortSignal.timeout(6000) });
      if (wbResp.ok) {
        const wbData = await wbResp.json();
        if (wbData.archived_snapshots && wbData.archived_snapshots.closest && wbData.archived_snapshots.closest.available) {
          result.archiveUrl = wbData.archived_snapshots.closest.url.replace(/^http:/, 'https:');
        }
      }
    } catch(e) { /* Wayback check is best-effort */ }
    localStorage.setItem('aotd_date', today);
    localStorage.setItem('aotd_data', JSON.stringify(result));
    localStorage.setItem('aotd_lastCategory', result.category || 'none');
    renderAOTD(result);
  } catch(e) {
    document.getElementById('aotd-loading').style.display = 'none';
    if (e.message === 'NO_KEY') {
      document.getElementById('aotd-nokey').style.display = 'block';
    } else {
      document.getElementById('aotd-error').style.display = 'block';
      document.getElementById('aotd-error-msg').textContent = '⚠ ' + e.message;
    }
  }
}

function forceNewArticle() {
  aotdTrack('skip');
  localStorage.removeItem('aotd_date');
  localStorage.removeItem('aotd_data');
  fetchArticleOfTheDay(true);
}
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
  loadWeekNotes();
  // Article of the Day — runs once daily on launch
  fetchArticleOfTheDay(false);
  // Auto-numbered list detection on notes
  ['today-notes', 'week-notes'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', _handleAutoNumberedList);
  });
});
