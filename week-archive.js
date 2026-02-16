// ============ WEEK-ARCHIVE: Snapshot, Email, Log Rendering ============

// --- Archive a week's data into a frozen snapshot ---
function archiveWeek(wk) {
  const d = load();
  if (!d.weekArchives) d.weekArchives = {};
  if (d.weekArchives[wk]) return d.weekArchives[wk]; // already archived

  const wd = d.weeks && d.weeks[wk] ? d.weeks[wk] : { goals: [], review: null };
  const wg = d.weekGoals && d.weekGoals[wk] ? d.weekGoals[wk] : {};
  const dissGoals = d.dissWeeklyGoals && d.dissWeeklyGoals[wk] ? d.dissWeeklyGoals[wk] : '';

  // Collect daily summaries for each day of the week
  const dates = weekDates(wk);
  const dailySummaries = {};
  dates.forEach(date => {
    if (d.days && d.days[date]) {
      const day = d.days[date];
      dailySummaries[date] = {
        habits: day.habits || {},
        top3: day.top3 || [],
        reflection: day.reflection || '',
        notes: day.notes || '',
        sealed: day.sealed || false,
        dissTime: day.dissTime || 0,
        energy: day.energy || []
      };
    }
  });

  // Compute weekly actuals from daily data
  let totalDissMin = 0, gymDays = 0, ankiDone = 0, articlesDone = 0;
  let convoDone = 0, reflDone = 0, socialDone = 0;
  dates.forEach(date => {
    if (d.days && d.days[date]) {
      const day = d.days[date];
      totalDissMin += day.dissTime || 0;
      if (day.habits) {
        if (day.habits.gym) gymDays++;
        if (day.habits.anki) ankiDone++;
        if (day.habits.article) articlesDone++;
        if (day.habits.conversation) convoDone++;
        if (day.habits.reflection) reflDone++;
        if (day.habits.social) socialDone++;
      }
    }
  });

  const snapshot = {
    weekId: wk,
    dates: dates,
    customGoals: wd.goals || [],
    review: wd.review || null,
    pushGoal: wd.pushGoal || '',
    richGoals: { work: wg.work || '', school: wg.school || '', life: wg.life || '' },
    dissWeeklyGoals: dissGoals,
    dailySummaries,
    actuals: { dissHours: +(totalDissMin/60).toFixed(1), gymDays, ankiDone, articlesDone, convoDone, reflDone, socialDone },
    archivedAt: new Date().toISOString()
  };

  d.weekArchives[wk] = snapshot;
  save(d);
  addLog('archive', `Archived week ${wk}`);
  return snapshot;
}

// --- Generate plain-text email summary ---
function generateWeekEmailBody(snapshot) {
  const s = snapshot;
  const lines = [];
  lines.push(`WEEKLY SUMMARY: ${s.weekId}`);
  lines.push(`${s.dates[0]} to ${s.dates[6]}`);
  lines.push('');

  // Actuals
  lines.push('═══ WEEKLY ACTUALS ═══');
  lines.push(`Dissertation: ${s.actuals.dissHours} hours`);
  lines.push(`Gym: ${s.actuals.gymDays}/7 days`);
  lines.push(`Anki: ${s.actuals.ankiDone}/7 days`);
  lines.push(`Articles: ${s.actuals.articlesDone}/7 days`);
  lines.push(`Conversations: ${s.actuals.convoDone}/7 days`);
  lines.push(`Reflection: ${s.actuals.reflDone}/7 days`);
  lines.push(`Social: ${s.actuals.socialDone}/7 days`);
  lines.push('');

  // Custom goals
  if (s.customGoals.length) {
    lines.push('═══ WEEKLY GOALS ═══');
    s.customGoals.forEach(g => {
      lines.push(`[${g.done ? 'X' : ' '}] (${g.cat}) ${g.text}`);
    });
    lines.push('');
  }

  // Rich goals (strip HTML)
  const strip = html => { const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; };
  if (s.richGoals.work) { lines.push('═══ WORK GOALS ═══'); lines.push(strip(s.richGoals.work)); lines.push(''); }
  if (s.richGoals.school) { lines.push('═══ SCHOOL GOALS ═══'); lines.push(strip(s.richGoals.school)); lines.push(''); }
  if (s.richGoals.life) { lines.push('═══ LIFE GOALS ═══'); lines.push(strip(s.richGoals.life)); lines.push(''); }

  // Review
  if (s.review) {
    lines.push('═══ WEEKLY REVIEW ═══');
    if (s.review.well) lines.push(`What went well: ${s.review.well}`);
    if (s.review.bad) lines.push(`What didn't go well: ${s.review.bad}`);
    if (s.review.imp) lines.push(`To improve: ${s.review.imp}`);
    if (s.review.push) lines.push(`Push goal: ${s.review.push}`);
    lines.push('');
  }

  // Daily summaries
  lines.push('═══ DAILY SNAPSHOTS ═══');
  s.dates.forEach(date => {
    const ds = s.dailySummaries[date];
    if (!ds) { lines.push(`${date}: no data`); return; }
    const habits = Object.entries(ds.habits || {}).filter(([,v])=>v).map(([k])=>k).join(', ');
    lines.push(`${date}: ${habits || 'no habits'} | diss: ${ds.dissTime||0}m | ${ds.sealed ? 'sealed' : 'open'}`);
    if (ds.notes) {
      const noteText = strip(ds.notes).trim();
      if (noteText) lines.push(`  daily notes: ${noteText.substring(0,200)}${noteText.length>200?'...':''}`);
    }
    if (ds.reflection) lines.push(`  reflection: ${ds.reflection.substring(0,120)}${ds.reflection.length>120?'...':''}`);
  });

  return lines.join('\n');
}

function emailWeekSummary(wk) {
  const d = load();
  if (!d.weekArchives || !d.weekArchives[wk]) return;
  const snapshot = d.weekArchives[wk];
  const body = generateWeekEmailBody(snapshot);
  const subject = encodeURIComponent(`Weekly Summary: ${wk} (${snapshot.dates[0]} to ${snapshot.dates[6]})`);
  // mailto has ~2000 char limit in some browsers, but modern ones handle more
  const mailBody = encodeURIComponent(body.substring(0, 8000));
  window.open(`mailto:xmagnuson@gmail.com?subject=${subject}&body=${mailBody}`, '_blank');
}

// --- Manual archive (from Log tab button) ---
function manualArchiveWeek() {
  const wk = weekId();
  const snapshot = archiveWeek(wk);
  emailWeekSummary(wk);
  renderWeekArchives();
  alert(`Week ${wk} archived and email prepared.`);
}

// --- Auto-archive check (called on app init) ---
function checkWeekTransition() {
  const d = load();
  const currentWk = weekId();
  if (d.lastActiveWeek && d.lastActiveWeek !== currentWk) {
    // Previous week ended — archive it if not already
    if (!d.weekArchives || !d.weekArchives[d.lastActiveWeek]) {
      archiveWeek(d.lastActiveWeek);
      // Don't auto-email — just archive silently
    }
    // Clear old week's daily notes so they don't appear on the new week page
    const oldDates = weekDates(d.lastActiveWeek);
    oldDates.forEach(date => {
      if (d.days && d.days[date] && d.days[date].notes) {
        d.days[date].notes = '';
      }
    });
  }
  if (d.lastActiveWeek !== currentWk) {
    d.lastActiveWeek = currentWk;
    save(d);
  }
}

// --- Log page: collapsible Year → Month → Week rendering ---
function renderWeekArchives() {
  const el = document.getElementById('week-archives');
  if (!el) return;
  const d = load();
  const archives = d.weekArchives || {};
  const weeks = Object.keys(archives).sort().reverse();

  if (!weeks.length) { el.innerHTML = '<p style="color:#aaa;text-align:center;">No archived weeks yet.</p>'; return; }

  // Group by year → month
  const tree = {};
  weeks.forEach(wk => {
    const mon = weekMonday(wk);
    const yr = mon.getFullYear();
    const mo = mon.getMonth(); // 0-11
    if (!tree[yr]) tree[yr] = {};
    if (!tree[yr][mo]) tree[yr][mo] = [];
    tree[yr][mo].push(wk);
  });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let html = '';
  const years = Object.keys(tree).sort().reverse();

  years.forEach(yr => {
    html += `<details class="archive-year"><summary style="font-size:1.1em;font-weight:bold;cursor:pointer;padding:8px 0;color:#ffd700;">📅 ${yr}</summary>`;
    const months = Object.keys(tree[yr]).sort((a,b)=>b-a);
    months.forEach(mo => {
      html += `<details class="archive-month" style="margin-left:16px;"><summary style="cursor:pointer;padding:4px 0;color:#90caf9;">${monthNames[mo]}</summary>`;
      tree[yr][mo].forEach(wk => {
        const snap = archives[wk];
        html += renderArchiveWeekCard(snap);
      });
      html += '</details>';
    });
    html += '</details>';
  });

  el.innerHTML = html;
}

function renderArchiveWeekCard(snap) {
  const s = snap;
  const strip = html => { const tmp = document.createElement('div'); tmp.innerHTML = html; return (tmp.textContent || '').substring(0,200); };

  // Count completed custom goals
  const done = (s.customGoals||[]).filter(g=>g.done).length;
  const total = (s.customGoals||[]).length;

  let html = `<details class="archive-week" style="margin-left:32px;margin-bottom:8px;">
    <summary style="cursor:pointer;padding:4px 0;color:#e0e0e0;">
      <strong>Week of ${s.weekId}</strong> &nbsp; 
      <span style="color:#888;font-size:0.85em;">${s.dates[0]} → ${s.dates[6]} | Goals: ${done}/${total} | Diss: ${s.actuals.dissHours}h | Gym: ${s.actuals.gymDays}/7</span>
    </summary>
    <div style="padding:8px 12px;background:#1a1a2e;border-radius:6px;margin:4px 0;">`;

  // Actuals
  html += `<div style="margin-bottom:8px;"><strong style="color:#ffd700;">Actuals</strong><br>
    Dissertation: ${s.actuals.dissHours}h | Gym: ${s.actuals.gymDays}/7 | Anki: ${s.actuals.ankiDone}/7 | Articles: ${s.actuals.articlesDone}/7 | Convo: ${s.actuals.convoDone}/7 | Reflection: ${s.actuals.reflDone}/7 | Social: ${s.actuals.socialDone}/7
  </div>`;

  // Custom goals
  if (total) {
    html += `<div style="margin-bottom:8px;"><strong style="color:#ffd700;">Custom Goals</strong><ul style="margin:4px 0;padding-left:20px;">`;
    s.customGoals.forEach(g => {
      html += `<li style="color:${g.done?'#4caf50':'#ef5350'};">[${g.done?'✓':'○'}] (${escHtml(g.cat)}) ${escHtml(g.text)}</li>`;
    });
    html += '</ul></div>';
  }

  // Rich goals
  ['work','school','life'].forEach(cat => {
    if (s.richGoals[cat]) {
      html += `<div style="margin-bottom:6px;"><strong style="color:#90caf9;">${cat.charAt(0).toUpperCase()+cat.slice(1)} Goals:</strong> <span style="color:#ccc;">${strip(s.richGoals[cat])}${s.richGoals[cat].length>200?'...':''}</span></div>`;
    }
  });

  // Review
  if (s.review) {
    html += `<div style="margin-bottom:6px;"><strong style="color:#ffd700;">Review</strong><br>`;
    if (s.review.well) html += `<span style="color:#4caf50;">✓ ${escHtml(s.review.well)}</span><br>`;
    if (s.review.bad) html += `<span style="color:#ef5350;">✗ ${escHtml(s.review.bad)}</span><br>`;
    if (s.review.imp) html += `<span style="color:#ff9800;">↑ ${escHtml(s.review.imp)}</span><br>`;
    if (s.review.push) html += `<span style="color:#2196f3;">→ ${escHtml(s.review.push)}</span>`;
    html += '</div>';
  }

  // Daily snapshots
  html += `<details style="margin-top:6px;"><summary style="cursor:pointer;color:#888;font-size:0.9em;">Daily Details</summary><div style="padding:4px 8px;">`;
  s.dates.forEach(date => {
    const ds = s.dailySummaries[date];
    if (!ds) { html += `<div style="color:#555;">${date}: no data</div>`; return; }
    const habits = Object.entries(ds.habits||{}).filter(([,v])=>v).map(([k])=>k).join(', ');
    html += `<div style="margin:2px 0;color:#bbb;"><strong>${date}</strong>: ${habits||'—'} | diss:${ds.dissTime||0}m ${ds.sealed?'🔒':''}</div>`;
    if (ds.notes && ds.notes.replace(/<[^>]*>/g,'').trim()) {
      html += `<div style="margin:2px 0 8px 12px;padding:6px 10px;background:#222;border-left:3px solid #555;border-radius:4px;color:#ccc;font-size:0.9em;">${ds.notes}</div>`;
    }
  });
  html += '</div></details>';

  html += '</div></details>';
  return html;
}