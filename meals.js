// ============ MEALS TAB ============
const MEAL_TARGETS = {
  workout: { calories: 3400, protein: 230, carbs: 350, fat: 80 },
  rest:    { calories: 2800, protein: 220, carbs: 220, fat: 90 }
};

function getMealData() {
  const dd = dayData(today());
  if (!dd.days[today()].meals) {
    dd.days[today()].meals = { dayType: 'workout', entries: [] };
    save(dd);
  }
  return dd.days[today()].meals;
}

function getMealLibrary() {
  const d = getGlobal();
  if (!d.mealLibrary) { d.mealLibrary = []; save(d); }
  return d.mealLibrary;
}

// ---- Render ----
function renderMeals() {
  const m = getMealData();
  const targets = MEAL_TARGETS[m.dayType];
  // Day type toggle
  document.getElementById('meal-day-workout').classList.toggle('active', m.dayType === 'workout');
  document.getElementById('meal-day-rest').classList.toggle('active', m.dayType === 'rest');
  document.getElementById('meal-targets-display').innerHTML =
    '<b>' + targets.calories + '</b> kcal &nbsp; <b>' + targets.protein + 'g</b> P &nbsp; <b>' + targets.carbs + 'g</b> C &nbsp; <b>' + targets.fat + 'g</b> F';
  // Totals
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  (m.entries || []).forEach(e => {
    totals.calories += e.calories || 0;
    totals.protein += e.protein || 0;
    totals.carbs += e.carbs || 0;
    totals.fat += e.fat || 0;
  });
  renderMacroRings(totals, targets);
  renderMealLog(m.entries || []);
  renderStoredMeals('');
  // Clear autocomplete
  document.getElementById('meal-autocomplete').innerHTML = '';
  document.getElementById('meal-autocomplete').style.display = 'none';
}

function setDayType(type) {
  const dd = dayData(today());
  dd.days[today()].meals.dayType = type;
  save(dd);
  renderMeals();
}

// ---- Macro Ring Charts (SVG) ----
function renderMacroRings(totals, targets) {
  const container = document.getElementById('meal-rings');
  const metrics = [
    { label: 'Calories', key: 'calories', unit: 'kcal', color: '#3b82f6' },
    { label: 'Protein', key: 'protein', unit: 'g', color: '#22c55e' },
    { label: 'Carbs',   key: 'carbs',   unit: 'g', color: '#f97316' },
    { label: 'Fat',     key: 'fat',     unit: 'g', color: '#8b5cf6' }
  ];
  const r = 44, circ = 2 * Math.PI * r;
  container.innerHTML = metrics.map(m => {
    const val = totals[m.key], target = targets[m.key];
    const pct = target > 0 ? Math.min(val / target, 1.15) : 0;
    const displayPct = Math.round((val / target) * 100);
    let ringColor = m.color;
    if (displayPct > 100) ringColor = '#ef4444';
    else if (displayPct >= 80) ringColor = m.color;
    const offset = circ * (1 - Math.min(pct, 1));
    return '<div class="meal-ring-item">' +
      '<svg width="100" height="100" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="#e5e5e3" stroke-width="8"/>' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + ringColor + '" stroke-width="8" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" ' +
      'stroke-linecap="round" transform="rotate(-90 50 50)" style="transition:stroke-dashoffset .5s ease"/>' +
      '<text x="50" y="46" text-anchor="middle" font-size="14" font-weight="600" fill="' + ringColor + '">' + displayPct + '%</text>' +
      '<text x="50" y="62" text-anchor="middle" font-size="9" fill="#6b7280">' + val + '/' + target + '</text>' +
      '</svg>' +
      '<div class="meal-ring-label">' + m.label + '</div>' +
      '</div>';
  }).join('');
}

// ---- Meal Log ----
function renderMealLog(entries) {
  const el = document.getElementById('meal-log');
  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:10px">No food logged yet today.</p>';
    return;
  }
  el.innerHTML = entries.map((e, i) =>
    '<div class="meal-entry">' +
    '<div class="meal-entry-name">' + escHtml(e.name) + '</div>' +
    '<div class="meal-entry-macros">' + (e.calories||0) + ' kcal · ' + (e.protein||0) + 'g P · ' + (e.carbs||0) + 'g C · ' + (e.fat||0) + 'g F</div>' +
    '<button onclick="removeMealEntry(' + i + ')" title="Remove" style="background:none;border:none;color:var(--red);font-size:16px;padding:2px 6px;cursor:pointer">✕</button>' +
    '</div>'
  ).join('');
}

function removeMealEntry(idx) {
  const dd = dayData(today());
  dd.days[today()].meals.entries.splice(idx, 1);
  save(dd);
  renderMeals();
}

// ---- Stored Meals ----
function renderStoredMeals(filter) {
  const lib = getMealLibrary();
  const sorted = lib.slice().sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  const filtered = filter ? sorted.filter(m => m.name.toLowerCase().includes(filter.toLowerCase())) : sorted;
  const el = document.getElementById('meal-library-list');
  if (!filtered.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px">No stored meals' + (filter ? ' matching "' + escHtml(filter) + '"' : '') + '.</p>';
    return;
  }
  el.innerHTML = filtered.map(m =>
    '<div class="meal-lib-item">' +
    '<div class="meal-lib-info">' +
    '<span class="meal-lib-name">' + escHtml(m.name) + '</span>' +
    '<span class="meal-lib-macros">' + m.calories + ' kcal · ' + m.protein + 'g P · ' + m.carbs + 'g C · ' + m.fat + 'g F</span>' +
    '</div>' +
    '<div class="meal-lib-actions">' +
    '<button onclick="quickAddStoredMeal(\'' + m.id + '\')" title="Add to today" style="background:var(--green);color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:12px;cursor:pointer">+ Add</button>' +
    '<button onclick="editStoredMeal(\'' + m.id + '\')" title="Edit" style="background:none;border:none;font-size:14px;cursor:pointer">✏️</button>' +
    '<button onclick="deleteStoredMeal(\'' + m.id + '\')" title="Delete" style="background:none;border:none;color:var(--red);font-size:14px;cursor:pointer">🗑</button>' +
    '</div></div>'
  ).join('');
}

function toggleMealLibrary() {
  const body = document.getElementById('meal-library-body');
  const chevron = document.getElementById('meal-lib-chevron');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    chevron.textContent = '▼';
  } else {
    body.style.display = 'none';
    chevron.textContent = '▶';
  }
}

function filterMealLibrary() {
  const q = document.getElementById('meal-lib-search').value.trim();
  renderStoredMeals(q);
}

function quickAddStoredMeal(id) {
  const lib = getMealLibrary();
  const meal = lib.find(m => m.id === id);
  if (!meal) return;
  const dd = dayData(today());
  dd.days[today()].meals.entries.push({
    name: meal.name, calories: meal.calories, protein: meal.protein,
    carbs: meal.carbs, fat: meal.fat, timestamp: new Date().toISOString()
  });
  meal.usageCount = (meal.usageCount || 0) + 1;
  save(dd);
  const d = getGlobal(); save(d);
  renderMeals();
}

function deleteStoredMeal(id) {
  if (!confirm('Delete this stored meal?')) return;
  const d = getGlobal();
  d.mealLibrary = (d.mealLibrary || []).filter(m => m.id !== id);
  save(d);
  renderMeals();
}

function editStoredMeal(id) {
  const d = getGlobal();
  const meal = (d.mealLibrary || []).find(m => m.id === id);
  if (!meal) return;
  const name = prompt('Meal name:', meal.name); if (name === null) return;
  const cal = prompt('Calories:', meal.calories); if (cal === null) return;
  const prot = prompt('Protein (g):', meal.protein); if (prot === null) return;
  const carb = prompt('Carbs (g):', meal.carbs); if (carb === null) return;
  const fat = prompt('Fat (g):', meal.fat); if (fat === null) return;
  meal.name = name.trim() || meal.name;
  meal.calories = parseInt(cal) || meal.calories;
  meal.protein = parseInt(prot) || meal.protein;
  meal.carbs = parseInt(carb) || meal.carbs;
  meal.fat = parseInt(fat) || meal.fat;
  save(d);
  renderMeals();
}

// ---- Autocomplete ----
function mealNameInput() {
  const q = document.getElementById('meal-name-in').value.trim();
  const ac = document.getElementById('meal-autocomplete');
  if (q.length < 2) { ac.style.display = 'none'; ac.innerHTML = ''; return; }
  // Don't autocomplete if image is attached
  if (_mealPendingImage) { ac.style.display = 'none'; return; }
  const lib = getMealLibrary().slice().sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  const matches = lib.filter(m => m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  if (!matches.length) { ac.style.display = 'none'; ac.innerHTML = ''; return; }
  ac.style.display = 'block';
  ac.innerHTML = matches.map(m =>
    '<div class="meal-ac-item" onclick="selectAutocomplete(\'' + m.id + '\')">' +
    '<b>' + escHtml(m.name) + '</b> <span style="color:var(--muted);font-size:11px">' + m.calories + ' kcal</span></div>'
  ).join('');
}

function selectAutocomplete(id) {
  const lib = getMealLibrary();
  const meal = lib.find(m => m.id === id);
  if (!meal) return;
  document.getElementById('meal-name-in').value = meal.name;
  document.getElementById('meal-cal-in').value = meal.calories;
  document.getElementById('meal-prot-in').value = meal.protein;
  document.getElementById('meal-carb-in').value = meal.carbs;
  document.getElementById('meal-fat-in').value = meal.fat;
  document.getElementById('meal-autocomplete').style.display = 'none';
  _mealSelectedStoredId = meal.id;
}

// ---- Image handling ----
let _mealPendingImage = null;
let _mealSelectedStoredId = null;

function mealImageSelected(input) {
  const file = input.files[0];
  if (!file) return;
  _readImageFile(file);
}

function _readImageFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    _mealPendingImage = e.target.result; // base64 data URL
    document.getElementById('meal-img-preview').innerHTML =
      '<img src="' + _mealPendingImage + '" style="max-width:200px;max-height:150px;border-radius:6px;border:1px solid var(--border)">' +
      ' <button onclick="clearMealImage()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>';
    document.getElementById('meal-autocomplete').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearMealImage() {
  _mealPendingImage = null;
  document.getElementById('meal-img-preview').innerHTML = '';
  document.getElementById('meal-img-input').value = '';
}

function initMealPasteHandler() {
  const zone = document.getElementById('tab-meals');
  if (!zone) return;
  zone.addEventListener('paste', function(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) _readImageFile(file);
        return;
      }
    }
  });
}

// ---- Submit Food ----
async function submitFood() {
  const name = document.getElementById('meal-name-in').value.trim();
  const desc = document.getElementById('meal-desc-in').value.trim();
  const btn = document.getElementById('meal-submit-btn');

  // If a stored meal was selected via autocomplete and no image
  if (_mealSelectedStoredId && !_mealPendingImage) {
    const cal = parseInt(document.getElementById('meal-cal-in').value) || 0;
    const prot = parseInt(document.getElementById('meal-prot-in').value) || 0;
    const carb = parseInt(document.getElementById('meal-carb-in').value) || 0;
    const fat = parseInt(document.getElementById('meal-fat-in').value) || 0;
    _addFoodEntry(name || 'Meal', cal, prot, carb, fat);
    // Increment usage
    const lib = getMealLibrary();
    const m = lib.find(x => x.id === _mealSelectedStoredId);
    if (m) { m.usageCount = (m.usageCount || 0) + 1; const d = getGlobal(); save(d); }
    _clearMealForm();
    renderMeals();
    return;
  }

  // If manual macros entered (no image, no autocomplete)
  const manualCal = document.getElementById('meal-cal-in').value;
  if (!_mealPendingImage && manualCal) {
    const cal = parseInt(manualCal) || 0;
    const prot = parseInt(document.getElementById('meal-prot-in').value) || 0;
    const carb = parseInt(document.getElementById('meal-carb-in').value) || 0;
    const fat = parseInt(document.getElementById('meal-fat-in').value) || 0;
    _addFoodEntry(name || desc || 'Meal', cal, prot, carb, fat);
    _offerSaveMeal(name || desc || 'Meal', cal, prot, carb, fat);
    _clearMealForm();
    renderMeals();
    return;
  }

  // If image is present, call Claude Vision
  if (_mealPendingImage) {
    const key = localStorage.getItem('cc_apikey');
    if (!key) { alert('Set your API key in the Claude tab first.'); return; }
    btn.textContent = '⏳ Analyzing...';
    btn.disabled = true;
    try {
      const result = await analyzeFoodWithClaude(key, _mealPendingImage, name, desc);
      _addFoodEntry(result.name, result.calories, result.protein, result.carbs, result.fat);
      _offerSaveMeal(result.name, result.calories, result.protein, result.carbs, result.fat);
      _clearMealForm();
      renderMeals();
    } catch (e) {
      alert('Analysis failed: ' + e.message);
    } finally {
      btn.textContent = '➕ Add Food';
      btn.disabled = false;
    }
    return;
  }

  // Nothing useful provided
  if (!name && !desc && !_mealPendingImage) {
    alert('Enter a food name, description, or attach an image.');
  }
}

async function analyzeFoodWithClaude(key, imageDataUrl, name, description) {
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  let prompt = 'Analyze this food image and estimate its macronutrients. ';
  if (name) prompt += 'The food is: ' + name + '. ';
  if (description) prompt += 'Additional info: ' + description + '. ';
  prompt += 'Return ONLY a JSON object with these exact keys: {"name": "food name", "calories": number, "protein": number, "carbs": number, "fat": number}. Protein, carbs, fat in grams. Be as accurate as possible. If it\'s packaging, read the nutrition label.';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  if (!resp.ok) throw new Error('API error: ' + resp.status);
  const data = await resp.json();
  const text = data.content[0].text;
  // Extract JSON from response
  const jsonMatch = text.match(/\{[^}]+\}/);
  if (!jsonMatch) throw new Error('Could not parse response');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    name: parsed.name || name || 'Food',
    calories: parseInt(parsed.calories) || 0,
    protein: parseInt(parsed.protein) || 0,
    carbs: parseInt(parsed.carbs) || 0,
    fat: parseInt(parsed.fat) || 0
  };
}

function _addFoodEntry(name, cal, prot, carb, fat) {
  const dd = dayData(today());
  if (!dd.days[today()].meals) dd.days[today()].meals = { dayType: 'workout', entries: [] };
  dd.days[today()].meals.entries.push({
    name: name, calories: cal, protein: prot, carbs: carb, fat: fat,
    timestamp: new Date().toISOString()
  });
  save(dd);
}

function _offerSaveMeal(name, cal, prot, carb, fat) {
  if (!name || name === 'Food' || name === 'Meal') return;
  const lib = getMealLibrary();
  const existing = lib.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (existing) { existing.usageCount = (existing.usageCount || 0) + 1; const d = getGlobal(); save(d); return; }
  if (confirm('Save "' + name + '" to your meal library?')) {
    lib.push({
      id: 'ml_' + Date.now(),
      name: name, calories: cal, protein: prot, carbs: carb, fat: fat,
      usageCount: 1
    });
    const d = getGlobal(); save(d);
  }
}

function _clearMealForm() {
  document.getElementById('meal-name-in').value = '';
  document.getElementById('meal-desc-in').value = '';
  document.getElementById('meal-cal-in').value = '';
  document.getElementById('meal-prot-in').value = '';
  document.getElementById('meal-carb-in').value = '';
  document.getElementById('meal-fat-in').value = '';
  clearMealImage();
  _mealSelectedStoredId = null;
  document.getElementById('meal-autocomplete').style.display = 'none';
}