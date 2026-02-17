// ============ PROGRESS TAB ============
let _progressCharts = {};
let _progressRange = '30d';

const _CHART_FONT_SIZE = 20;
const _CHART_TITLE_SIZE = 22;
const _CHART_LEGEND_SIZE = 18;
const _CHART_TICK_SIZE = 16;

function renderProgress() {
  const range = _progressRange;
  const dates = _getAllDatesInRange(range);
  if (dates.length === 0) {
    document.getElementById('progress-empty').style.display = 'block';
    return;
  }
  document.getElementById('progress-empty').style.display = 'none';

  // Highlight active range button
  document.querySelectorAll('.prog-range-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === range);
  });

  _renderAnkiChart(dates);
  _renderItalianChart(dates);
  _renderNutritionChart(dates);
  _renderWeightChart(dates);
}

function setProgressRange(r) {
  _progressRange = r;
  renderProgress();
}

// ---- date helpers ----
function _getAllDatesInRange(range) {
  const d = load();
  const dateSet = new Set();

  if (d.days) Object.keys(d.days).forEach(dt => dateSet.add(dt));
  (d.corrections || []).forEach(c => { if (c.date) dateSet.add(c.date); });
  (d.readingHistory || []).forEach(r => { if (r.date) dateSet.add(r.date); });

  const cd = _getCardsData();
  (cd.cards || []).forEach(c => {
    if (c.created) dateSet.add(c.created);
    if (c.reviewedToday) dateSet.add(c.reviewedToday);
  });

  let all = Array.from(dateSet).sort();

  const now = new Date();
  let cutoff = null;
  if (range === '7d') {
    cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 6);
  } else if (range === '14d') {
    cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 13);
  } else if (range === '30d') {
    cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 29);
  } else if (range === 'ytd') {
    cutoff = new Date(now.getFullYear(), 0, 1);
  }

  if (cutoff) {
    const cutStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
    all = all.filter(dt => dt >= cutStr);
  }

  if (all.length === 0) return [];
  const todayStr = today();
  const start = all[0] < todayStr ? all[0] : todayStr;
  const end = todayStr;
  const filled = [];
  const cur = new Date(start + 'T00:00:00');
  const endDt = new Date(end + 'T00:00:00');
  while (cur <= endDt) {
    filled.push(cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0'));
    cur.setDate(cur.getDate() + 1);
  }
  return filled;
}

function _getCardsData() {
  const d = load();
  if (!d.cards) d.cards = [];
  return d;
}

function _shortDate(dt) {
  const parts = dt.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1]) - 1] + ' ' + parseInt(parts[2]);
}

function _destroyChart(id) {
  if (_progressCharts[id]) {
    _progressCharts[id].destroy();
    delete _progressCharts[id];
  }
}

// ---- Chart 1: Anki Activity ----
function _renderAnkiChart(dates) {
  _destroyChart('anki');
  const cd = _getCardsData();
  const cards = cd.cards || [];

  const reviewedPerDay = {};
  const addedPerDay = {};
  cards.forEach(c => {
    if (c.reviewedToday) reviewedPerDay[c.reviewedToday] = (reviewedPerDay[c.reviewedToday] || 0) + 1;
    if (c.created) addedPerDay[c.created] = (addedPerDay[c.created] || 0) + 1;
  });

  const labels = dates.map(_shortDate);
  const addedData = dates.map(dt => addedPerDay[dt] || 0);

  const ctx = document.getElementById('chart-anki').getContext('2d');
  _progressCharts['anki'] = new Chart(ctx, {
    data: {
      labels: labels,
      datasets: [
        {
          type: 'scatter',
          label: 'Cards Reviewed',
          data: dates.map((dt, i) => ({ x: i, y: reviewedPerDay[dt] || 0 })),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          pointRadius: 8,
          pointHoverRadius: 12,
          yAxisID: 'y',
          order: 1
        },
        {
          type: 'bar',
          label: 'Cards Added',
          data: addedData,
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#555', font: { size: _CHART_LEGEND_SIZE } } },
        tooltip: {
          titleFont: { size: _CHART_TICK_SIZE },
          bodyFont: { size: _CHART_TICK_SIZE },
          callbacks: { title: function(items) { return dates[items[0].dataIndex] || ''; } }
        }
      },
      scales: {
        x: {
          type: 'category', labels: labels,
          ticks: { color: '#666', font: { size: _CHART_TICK_SIZE }, maxRotation: 45, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          position: 'left',
          title: { display: true, text: 'Reviewed', color: '#3b82f6', font: { size: _CHART_TITLE_SIZE } },
          ticks: { color: '#3b82f6', font: { size: _CHART_TICK_SIZE } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          beginAtZero: true
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Added', color: '#ef4444', font: { size: _CHART_TITLE_SIZE } },
          ticks: { color: '#ef4444', font: { size: _CHART_TICK_SIZE } },
          grid: { drawOnChartArea: false },
          beginAtZero: true
        }
      }
    }
  });
}

// ---- Chart 2: Italian Scores ----
function _renderItalianChart(dates) {
  _destroyChart('italian');
  const d = load();
  const corrections = d.corrections || [];
  const readings = d.readingHistory || [];

  const reflScores = {};
  corrections.forEach(c => {
    if (c.date && c.score && c.score.score != null) reflScores[c.date] = c.score.score;
  });
  const articleScores = {};
  readings.forEach(r => {
    if (r.date && r.score && r.score.score != null) articleScores[r.date] = r.score.score;
  });

  const labels = dates.map(_shortDate);
  const reflPoints = [];
  const artPoints = [];
  dates.forEach((dt, i) => {
    if (reflScores[dt] !== undefined) reflPoints.push({ x: i, y: reflScores[dt] });
    if (articleScores[dt] !== undefined) artPoints.push({ x: i, y: articleScores[dt] });
  });

  const ctx = document.getElementById('chart-italian').getContext('2d');
  _progressCharts['italian'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Daily Reflection',
          data: reflPoints,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgba(239, 68, 68, 1)',
          pointRadius: 9, pointHoverRadius: 13,
          showLine: true, tension: 0.3, borderWidth: 2
        },
        {
          label: 'Article Reflection',
          data: artPoints,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          pointRadius: 9, pointHoverRadius: 13,
          showLine: true, tension: 0.3, borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { labels: { color: '#555', font: { size: _CHART_LEGEND_SIZE } } },
        tooltip: {
          titleFont: { size: _CHART_TICK_SIZE },
          bodyFont: { size: _CHART_TICK_SIZE },
          callbacks: {
            title: function(items) { return dates[items[0].raw.x] || ''; },
            label: function(item) { return item.dataset.label + ': ' + item.raw.y + '/100'; }
          }
        }
      },
      scales: {
        x: {
          type: 'category', labels: labels,
          ticks: { color: '#666', font: { size: _CHART_TICK_SIZE }, maxRotation: 45, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          min: 0, max: 100,
          title: { display: true, text: 'Score', color: '#555', font: { size: _CHART_TITLE_SIZE } },
          ticks: { color: '#666', font: { size: _CHART_TICK_SIZE } },
          grid: { color: 'rgba(0,0,0,0.08)' }
        }
      }
    }
  });
}

// ---- Chart 3: Nutrition ----
function _renderNutritionChart(dates) {
  _destroyChart('nutrition');
  const d = load();
  const days = d.days || {};

  const calData = [];
  const protData = [];

  dates.forEach(dt => {
    const day = days[dt];
    let cal = 0, prot = 0;
    if (day && day.meals && day.meals.entries) {
      day.meals.entries.forEach(e => {
        const q = e.qty || 1;
        cal += (e.unitCal != null ? e.unitCal : (e.calories || 0)) * q;
        prot += (e.unitProt != null ? e.unitProt : (e.protein || 0)) * q;
      });
    }
    calData.push(Math.round(cal));
    protData.push(Math.round(prot));
  });

  const labels = dates.map(_shortDate);
  const ctx = document.getElementById('chart-nutrition').getContext('2d');

  _progressCharts['nutrition'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Calories (kcal)',
          data: calData,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3, fill: true,
          pointRadius: 6, pointHoverRadius: 10,
          borderWidth: 2, yAxisID: 'y'
        },
        {
          label: 'Protein (g)',
          data: protData,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3, fill: true,
          pointRadius: 6, pointHoverRadius: 10,
          borderWidth: 2, yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#555', font: { size: _CHART_LEGEND_SIZE } } },
        tooltip: { titleFont: { size: _CHART_TICK_SIZE }, bodyFont: { size: _CHART_TICK_SIZE } }
      },
      scales: {
        x: {
          ticks: { color: '#666', font: { size: _CHART_TICK_SIZE }, maxRotation: 45, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          position: 'left',
          title: { display: true, text: 'Calories', color: '#3b82f6', font: { size: _CHART_TITLE_SIZE } },
          ticks: { color: '#3b82f6', font: { size: _CHART_TICK_SIZE } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          beginAtZero: true
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Protein (g)', color: '#ef4444', font: { size: _CHART_TITLE_SIZE } },
          ticks: { color: '#ef4444', font: { size: _CHART_TICK_SIZE } },
          grid: { drawOnChartArea: false },
          beginAtZero: true
        }
      }
    }
  });
}

// ---- Chart 4: Weight ----
function _renderWeightChart(dates) {
  _destroyChart('weight');
  const d = load();
  const days = d.days || {};

  const weightData = [];
  const weightLabels = [];
  const weightDates = [];

  dates.forEach(dt => {
    const day = days[dt];
    if (day && day.meals && day.meals.weight) {
      weightData.push(day.meals.weight);
      weightLabels.push(_shortDate(dt));
      weightDates.push(dt);
    }
  });

  const ctx = document.getElementById('chart-weight').getContext('2d');

  if (weightData.length === 0) {
    _progressCharts['weight'] = new Chart(ctx, {
      type: 'line',
      data: { labels: ['No data'], datasets: [{ label: 'Weight (lbs)', data: [], borderColor: '#8b5cf6' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#555', font: { size: _CHART_LEGEND_SIZE } } },
          title: { display: true, text: 'Log weight on the Meals tab to see data here', color: '#999', font: { size: 14 } }
        }
      }
    });
    return;
  }

  _progressCharts['weight'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weightLabels,
      datasets: [{
        label: 'Weight (lbs)',
        data: weightData,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3, fill: true,
        pointRadius: 8, pointHoverRadius: 12,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#555', font: { size: _CHART_LEGEND_SIZE } } },
        tooltip: {
          titleFont: { size: _CHART_TICK_SIZE },
          bodyFont: { size: _CHART_TICK_SIZE },
          callbacks: {
            title: function(items) { return weightDates[items[0].dataIndex] || ''; },
            label: function(item) { return item.raw + ' lbs'; }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#666', font: { size: _CHART_TICK_SIZE }, maxRotation: 45, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          title: { display: true, text: 'Weight (lbs)', color: '#3b82f6', font: { size: _CHART_TITLE_SIZE } },
          ticks: { color: '#3b82f6', font: { size: _CHART_TICK_SIZE } },
          grid: { color: 'rgba(0,0,0,0.08)' }
        }
      }
    }
  });
}