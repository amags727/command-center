// ============ WEEK-ARCHIVE: Snapshot, Email, Log/Diary Rendering ============

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
    // New: capture weekly reflection + stretch goals
    weeklyReflection: wd.weeklyReflection || null,
    stretchGoals: wd.stretchGoals || null,
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

  return lines.join('\n');
}

function emailWeekSummary(wk) {
  const d = load();
  if (!d.weekArchives || !d.weekArchives[wk]) return;
  const snapshot = d.weekArchives[wk];
  const body = generateWeekEmailBody(snapshot);
  const subject = encodeURIComponent(`Weekly Summary: ${wk} (${snapshot.dates[0]} to ${snapshot.dates[6]})`);
  const mailBody = encodeURIComponent(body.substring(0, 8000));
  window.open(`mailto:xmagnuson@gmail.com?subject=${subject}&body=${mailBody}`, '_blank');
}

// --- Manual archive (from Log tab button) ---
function manualArchiveWeek() {
  const wk = weekId();
  archiveWeek(wk);
  renderWeekArchives();
  alert(`Week ${wk} archived.`);
}

// --- Auto-archive check (called on app init) ---
function checkWeekTransition() {
  const d = load();
  const currentWk = weekId();
  if (d.lastActiveWeek && d.lastActiveWeek !== currentWk) {
    if (!d.weekArchives || !d.weekArchives[d.lastActiveWeek]) {
      archiveWeek(d.lastActiveWeek);
    }
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

// --- Diary page: collapsible Year → Month → Week rendering ---
function renderWeekArchives() {
  const el = document.getElementById('week-archives');
  if (!el) return;
  const d = load();
  const archives = d.weekArchives || {};
  const weeks = Object.keys(archives).sort().reverse();

  if (!weeks.length) { el.innerHTML = '<p style="color:#888;text-align:center;padding:20px;font-style:italic">No journal entries yet. Weeks are archived automatically.</p>'; return; }

  // Group by year → month
  const tree = {};
  weeks.forEach(wk => {
    const mon = weekMonday(wk);
    const yr = mon.getFullYear();
    const mo = mon.getMonth();
    if (!tree[yr]) tree[yr] = {};
    if (!tree[yr][mo]) tree[yr][mo] = [];
    tree[yr][mo].push(wk);
  });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let html = '';
  const years = Object.keys(tree).sort().reverse();

  years.forEach(yr => {
    html += `<details class="archive-year" open><summary style="font-size:1.1em;font-weight:bold;cursor:pointer;padding:10px 0;color:var(--blue)">📅 ${yr}</summary>`;
    const months = Object.keys(tree[yr]).sort((a,b)=>b-a);
    months.forEach(mo => {
      html += `<details class="archive-month" open style="margin-left:12px;"><summary style="cursor:pointer;padding:6px 0;color:var(--muted);font-weight:600">${monthNames[mo]}</summary>`;
      tree[yr][mo].forEach(wk => {
        const snap = archives[wk];
        html += renderDiaryEntry(snap);
      });
      html += '</details>';
    });
    html += '</details>';
  });

  el.innerHTML = html;
}

// --- Render a single week as a diary entry ---
function renderDiaryEntry(snap) {
  const s = snap;
  const strip = html => { const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent || ''; };
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Date range header
  const startDate = new Date(s.dates[0] + 'T00:00:00');
  const endDate = new Date(s.dates[6] + 'T00:00:00');
  const fmtDate = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const dateRange = fmtDate(startDate) + ' – ' + fmtDate(endDate) + ', ' + startDate.getFullYear();

  let html = `<details class="card" style="margin-bottom:16px;">
    <summary style="cursor:pointer;font-weight:700;font-size:1em;padding:4px 0">
      📓 ${dateRange}
    </summary>
    <div style="padding:8px 0;">`;

  // ── Weekly Reflection ──
  const refl = s.weeklyReflection;
  if (refl && refl.text && strip(refl.text).trim()) {
    html += `<div style="margin-bottom:16px;">
      <div style="font-size:var(--font-md);line-height:1.8;color:var(--text)">${refl.text}</div>`;
    // Reflection photos
    if (refl.photos && refl.photos.length) {
      html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">`;
      refl.photos.forEach(img => {
        html += `<img src="${img}" style="max-width:200px;max-height:200px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer" onclick="this.style.maxWidth=this.style.maxWidth==='200px'?'100%':'200px'">`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  } else {
    html += `<p style="color:var(--muted);font-style:italic;margin-bottom:16px">No reflection recorded for this week.</p>`;
  }

  // ── Completed Stretch Goals ──
  const sg = s.stretchGoals;
  if (sg && sg.goals) {
    const completed = sg.goals.filter(g => g.completed);
    if (completed.length) {
      html += `<div style="margin-bottom:16px;">
        <h4 style="font-size:var(--font-sm);font-weight:600;color:var(--green);margin-bottom:8px">✅ Completed Experiences</h4>`;
      completed.forEach(g => {
        const icon = g.type === 'italian-media' ? '📚' : '🎯';
        html += `<div style="margin-bottom:10px;padding:8px 12px;background:var(--gl);border-radius:6px;border-left:3px solid var(--green)">
          <div style="font-weight:600;font-size:var(--font-md)">${icon} ${escHtml(g.text)}</div>`;
        // Evidence
        const ev = g.completionEvidence;
        if (ev) {
          // Reflection text from experiential or composition from media
          if (ev.reflection && ev.reflection.trim()) {
            html += `<p style="margin-top:6px;font-size:var(--font-sm);line-height:1.6;color:var(--text);font-style:italic">"${escHtml(ev.reflection)}"</p>`;
          }
          if (ev.composition && ev.composition.trim()) {
            html += `<details style="margin-top:6px"><summary style="font-size:var(--font-sm);cursor:pointer;color:var(--muted)">View composition</summary>
              <p style="font-size:var(--font-sm);line-height:1.6;white-space:pre-wrap;margin-top:4px">${escHtml(ev.composition)}</p></details>`;
          }
          // Photos
          if (ev.images && ev.images.length) {
            html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">`;
            ev.images.forEach(img => {
              html += `<img src="${img}" style="width:100px;height:100px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer" onclick="this.style.width=this.style.width==='100px'?'300px':'100px';this.style.height='auto'">`;
            });
            html += `</div>`;
          }
        }
        html += `</div>`;
      });
      html += `</div>`;
    }
  }

  // ── Daily Entries ──
  let hasDailyContent = false;
  let dailyHtml = '';
  s.dates.forEach(date => {
    const ds = s.dailySummaries[date];
    if (!ds) return;
    const reflText = (ds.reflection || '').trim();
    const notesText = ds.notes ? strip(ds.notes).trim() : '';
    if (!reflText && !notesText) return;

    hasDailyContent = true;
    const dt = new Date(date + 'T00:00:00');
    const dayLabel = dayNames[dt.getDay()] + ', ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    dailyHtml += `<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px dashed var(--border)">
      <div style="font-weight:600;font-size:var(--font-sm);color:var(--blue);margin-bottom:4px">${dayLabel}</div>`;
    if (reflText) {
      dailyHtml += `<div style="margin-bottom:6px;padding:6px 10px;background:var(--ol);border-radius:4px;font-size:var(--font-sm);line-height:1.6;font-style:italic">📝 ${escHtml(reflText)}</div>`;
    }
    if (ds.notes && notesText) {
      dailyHtml += `<div style="font-size:var(--font-sm);line-height:1.6">${ds.notes}</div>`;
    }
    dailyHtml += `</div>`;
  });

  if (hasDailyContent) {
    html += `<details style="margin-top:8px">
      <summary style="cursor:pointer;font-size:var(--font-sm);font-weight:600;color:var(--muted)">📅 Daily Entries</summary>
      <div style="padding:8px 0">${dailyHtml}</div>
    </details>`;
  }

  html += `</div></details>`;
  return html;
}