// ============ DAY CALENDAR ============
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
  const collapsed = CAL._collapsed !== undefined ? CAL._collapsed : true;
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
  const txt = document.getElementById('reflection-text').value, wc = txt.trim().split(/\s+/).filter(w => w).length, el = document.getElementById('reflection-wordcount');
  el.textContent = wc + ' / 200 words'; el.className = 'wc' + (wc > 0 && wc < 200 ? ' bad' : '');
  const dd = dayData(today()); dd.days[today()].reflection = txt; save(dd);
}


function sealDay() {
  if (!confirm('Lock all entries for today permanently?')) return;
  const dd = dayData(today()); dd.days[today()].sealed = true; save(dd); lockToday(); addLog('sealed', 'Day sealed: ' + today());
}

