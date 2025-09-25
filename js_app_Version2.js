import { uuid, getRoundingFunction, formatNumber, escapeHtml, parseNumberMaybe, debounce, deepClone } from './utils.js';
import { loadState, saveState, clearState } from './storage.js';

// ---------- Application State ----------
const initialIngredients = () => ([
  { id: uuid(), name: 'Chicken', parts: 50, available: "" },
  { id: uuid(), name: 'Cream Cheese', parts: 23, available: "" },
  { id: uuid(), name: 'Oat Flour', parts: 17, available: "" }
]);

const defaultState = () => ({
  version: 1,
  mode: 'single',               // 'single' | 'limit'
  rounding: '2',                // 'none' or 0..n
  autoCalc: true,
  ingredients: initialIngredients(),
  baseIngredientId: null
});

let state = hydrateState();

// ---------- Element References ----------
const els = {
  tableBody: document.querySelector('#recipeTable tbody'),
  totalParts: document.getElementById('totalParts'),
  addForm: document.getElementById('addForm'),
  baseSelect: document.getElementById('baseIngredient'),
  modeSelect: document.getElementById('mode'),
  roundingSelect: document.getElementById('rounding'),
  stats: document.getElementById('stats'),
  limitDetails: document.getElementById('limitDetails'),
  recalcBtn: document.getElementById('recalcBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  clearStorageBtn: document.getElementById('clearStorageBtn'),
  singleModeRow: document.getElementById('singleModeRow'),
  autoCalcToggle: document.getElementById('autoCalcToggle'),
  importPanel: document.getElementById('importPanel'),
  importTextarea: document.getElementById('importTextarea'),
  confirmImportBtn: document.getElementById('confirmImportBtn'),
  cancelImportBtn: document.getElementById('cancelImportBtn'),
  importError: document.getElementById('importError')
};

// ---------- Initialization ----------
renderAll();
if (state.autoCalc) calculate();

// ---------- Event Wiring ----------
els.addForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(els.addForm);
  const name = (fd.get('name') || '').toString().trim();
  const partsVal = Number(fd.get('parts'));
  if (!name || !partsVal || partsVal <= 0) return;
  state.ingredients.push({ id: uuid(), name, parts: partsVal, available: "" });
  if (!state.baseIngredientId) state.baseIngredientId = state.ingredients[0].id;
  els.addForm.reset();
  persist();
  renderAll();
  autoCalcMaybe();
});

els.tableBody.addEventListener('input', e => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.getAttribute('data-id');
  const ing = state.ingredients.find(i => i.id === id);
  if (!ing) return;
  const field = e.target.getAttribute('data-field');
  if (field === 'name') {
    ing.name = e.target.value;
    persist();
    renderBaseSelect();
    autoCalcMaybe();
    return;
  }
  if (field === 'parts') {
    const val = Number(e.target.value);
    if (val > 0) ing.parts = val;
    persist();
    updateTotals();
    autoCalcMaybe();
    return;
  }
  if (field === 'available') {
    ing.available = parseNumberMaybe(e.target.value);
    persist();
    autoCalcMaybe();
    return;
  }
});

els.tableBody.addEventListener('click', e => {
  const action = e.target.getAttribute('data-action');
  if (!action) return;
  const tr = e.target.closest('tr');
  const id = tr?.getAttribute('data-id');
  if (action === 'delete' && id) {
    const idx = state.ingredients.findIndex(i => i.id === id);
    if (idx !== -1) {
      state.ingredients.splice(idx,1);
      if (!state.ingredients.some(i => i.id === state.baseIngredientId)) {
        state.baseIngredientId = state.ingredients[0]?.id || null;
      }
      persist();
      renderAll();
      autoCalcMaybe();
    }
  }
});

els.modeSelect.addEventListener('change', () => {
  state.mode = els.modeSelect.value;
  persist();
  renderModeVisibility();
  autoCalcMaybe();
});

els.baseSelect.addEventListener('change', () => {
  state.baseIngredientId = els.baseSelect.value;
  persist();
  autoCalcMaybe();
});

els.roundingSelect.addEventListener('change', () => {
  state.rounding = els.roundingSelect.value;
  persist();
  autoCalcMaybe();
});

els.recalcBtn.addEventListener('click', calculate);

els.resetBtn.addEventListener('click', () => {
  if (!confirm('Reset to initial example ingredients? This does not clear local saved data unless you also Clear Saved. Proceed?')) return;
  state.ingredients = initialIngredients();
  if (!state.ingredients.some(i=> i.id === state.baseIngredientId)) {
    state.baseIngredientId = state.ingredients[0].id;
  }
  persist();
  renderAll();
  autoCalcMaybe();
});

els.clearStorageBtn.addEventListener('click', () => {
  if (!confirm('This will remove the saved state from LocalStorage (not the current on-screen state). Continue?')) return;
  clearState();
  alert('Saved state cleared.');
});

els.exportBtn.addEventListener('click', () => {
  const data = exportData();
  const text = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    flashButton(els.exportBtn, 'Copied!');
  }).catch(() => {
    downloadFile('recipe-export.json', text);
  });
});

els.importBtn.addEventListener('click', () => {
  els.importPanel.open = true;
  els.importTextarea.value = '';
  els.importError.hidden = true;
  els.importError.textContent = '';
  els.importTextarea.focus();
});

els.cancelImportBtn.addEventListener('click', () => {
  els.importPanel.open = false;
});

els.confirmImportBtn.addEventListener('click', () => {
  const txt = els.importTextarea.value.trim();
  if (!txt) return;
  try {
    const parsed = JSON.parse(txt);
    validateImport(parsed);
    state = mergeImported(parsed);
    persist();
    renderAll();
    autoCalcMaybe();
    els.importPanel.open = false;
  } catch (err) {
    els.importError.textContent = 'Import error: ' + err.message;
    els.importError.hidden = false;
  }
});

els.autoCalcToggle.addEventListener('change', () => {
  state.autoCalc = els.autoCalcToggle.checked;
  persist();
  autoCalcMaybe();
});

// Debounced to avoid excessive recalc when user typing quickly
const debouncedCalc = debounce(calculate, 120);

// ---------- Core Functions ----------
function hydrateState() {
  const loaded = loadState();
  if (!loaded) return defaultState();
  // Basic migrations if needed later
  const base = defaultState();
  return {
    ...base,
    ...loaded,
    ingredients: Array.isArray(loaded.ingredients) && loaded.ingredients.length
      ? loaded.ingredients.map(normalizeIngredient).filter(Boolean)
      : base.ingredients
  };
}

function normalizeIngredient(raw) {
  if (!raw) return null;
  const id = raw.id || uuid();
  const name = (raw.name || '').toString();
  const parts = Number(raw.parts);
  if (!name || !isFinite(parts) || parts <= 0) return null;
  const available = raw.available === "" || raw.available === null || raw.available === undefined
    ? ""
    : Number(raw.available);
  return { id, name, parts, available: isFinite(available) ? available : "" };
}

function persist() {
  saveState(state);
}

function exportData() {
  const { version, mode, rounding, ingredients, baseIngredientId, autoCalc } = state;
  return {
    version,
    mode,
    rounding,
    baseIngredientId,
    autoCalc,
    ingredients: deepClone(ingredients)
  };
}

function validateImport(obj) {
  if (typeof obj !== 'object' || !obj) throw new Error('Not an object');
  if (!Array.isArray(obj.ingredients)) throw new Error('Missing ingredients array');
  if (!obj.ingredients.length) throw new Error('Ingredients array empty');
  obj.ingredients.forEach((r,i) => {
    if (!r.name) throw new Error(`Ingredient #${i+1} missing name`);
    if (!isFinite(Number(r.parts)) || Number(r.parts) <= 0) {
      throw new Error(`Ingredient #${i+1} has invalid parts`);
    }
  });
}

function mergeImported(obj) {
  const base = defaultState();
  return {
    ...base,
    ...obj,
    ingredients: obj.ingredients.map(normalizeIngredient).filter(Boolean),
    baseIngredientId: obj.baseIngredientId &&
      obj.ingredients.some(i => i.id === obj.baseIngredientId)
        ? obj.baseIngredientId
        : (obj.ingredients[0]?.id || null)
  };
}

function renderAll() {
  renderBaseSelect();
  renderTable();
  renderModeVisibility();
  renderControls();
  updateTotals();
}

function renderControls() {
  els.modeSelect.value = state.mode;
  els.roundingSelect.value = state.rounding;
  els.autoCalcToggle.checked = state.autoCalc;
}

function renderBaseSelect() {
  const cur = state.baseIngredientId;
  els.baseSelect.innerHTML = state.ingredients.map(i =>
    `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
  if (cur && state.ingredients.some(i => i.id === cur)) {
    els.baseSelect.value = cur;
  } else if (state.ingredients.length) {
    state.baseIngredientId = state.ingredients[0].id;
    els.baseSelect.value = state.baseIngredientId;
  }
}

function renderModeVisibility() {
  els.singleModeRow.style.display = state.mode === 'single' ? '' : 'none';
}

function renderTable() {
  els.tableBody.innerHTML = state.ingredients.map(ing => {
    return `<tr data-id="${ing.id}">
      <td><input data-field="name" value="${escapeHtml(ing.name)}" /></td>
      <td><input data-field="parts" type="number" min="0.0001" step="0.0001" value="${ing.parts}" /></td>
      <td><input data-field="available" type="number" step="0.0001" value="${ing.available === "" ? "" : ing.available}" placeholder="(opt)" /></td>
      <td class="needed" data-col="needed"></td>
      <td class="leftover" data-col="leftover"></td>
      <td class="actions-col">
        <button type="button" data-action="delete" class="btn danger" title="Delete row">Del</button>
      </td>
    </tr>`;
  }).join('');
}

function updateTotals() {
  const total = state.ingredients.reduce((s,i)=> s + (Number(i.parts)||0), 0);
  const roundingFn = getRoundingFunction(state.rounding);
  els.totalParts.textContent = formatNumber(total, roundingFn);
}

function autoCalcMaybe() {
  if (state.autoCalc) {
    debouncedCalc();
  }
}

function calculate() {
  const roundingFn = getRoundingFunction(state.rounding);
  const mode = state.mode;
  let scale = 0;
  let baseIng = null;
  const totalParts = state.ingredients.reduce((s,i)=> s + (Number(i.parts)||0), 0);

  if (!totalParts) {
    showStatsMessage('Add ingredients to begin.');
    clearNeeded();
    return;
  }

  if (mode === 'single') {
    baseIng = state.ingredients.find(i => i.id === state.baseIngredientId) || state.ingredients[0];
    if (baseIng && baseIng.available !== "" && Number(baseIng.parts) > 0) {
      scale = Number(baseIng.available) / Number(baseIng.parts);
    } else {
      scale = 0;
    }
  } else {
    const candidateScales = state.ingredients
      .filter(i => i.available !== "" && Number(i.parts) > 0)
      .map(i => Number(i.available) / Number(i.parts))
      .filter(v => isFinite(v) && v >= 0);

    if (candidateScales.length) {
      scale = Math.min(...candidateScales);
    } else {
      scale = 0;
    }
  }

  applyScaleToTable(scale, roundingFn, mode);
}

function applyScaleToTable(scale, roundingFn, mode) {
  const rows = Array.from(els.tableBody.querySelectorAll('tr'));
  if (!scale || scale <= 0) {
    if (mode === 'single') {
      showStatsMessage('Provide an Available amount for the chosen base ingredient to scale.');
    } else {
      showStatsMessage('Enter at least one Available value to compute a limiting scale.');
    }
    clearNeeded();
    return;
  }

  let limitingNames = [];
  const eps = 1e-9;
  rows.forEach(row => {
    const id = row.getAttribute('data-id');
    const ing = state.ingredients.find(i => i.id === id);
    if (!ing) return;
    const neededCell = row.querySelector('[data-col="needed"]');
    const leftoverCell = row.querySelector('[data-col="leftover"]');
    const needed = scale * Number(ing.parts);
    const formattedNeeded = formatNumber(needed, roundingFn);
    neededCell.textContent = formattedNeeded;
    if (ing.available !== "") {
      const leftover = Number(ing.available) - needed;
      const formattedLeft = formatNumber(leftover, roundingFn);
      leftoverCell.textContent = formattedLeft;
      leftoverCell.classList.remove('limit','ok','over');
      if (leftover < -1e-9) {
        leftoverCell.classList.add('over');
      } else if (Math.abs(Number(ing.available) - needed) < (Math.max(1, Number(ing.available)) * 1e-6)) {
        leftoverCell.classList.add('limit');
        if (mode === 'limit') limitingNames.push(ing.name);
      } else {
        leftoverCell.classList.add('ok');
      }
    } else {
      leftoverCell.textContent = '';
      leftoverCell.className = 'leftover';
    }
  });

  const totalBatch = state.ingredients.reduce((s,i)=> s + scale * Number(i.parts), 0);
  const msg = `
    <div><strong>Scale:</strong> ${formatNumber(scale, roundingFn)}</div>
    <div><strong>Total Batch:</strong> ${formatNumber(totalBatch, roundingFn)}</div>
    <div><strong>Ingredients:</strong> ${state.ingredients.length}</div>
  `;
  els.stats.innerHTML = msg;

  if (mode === 'limit') {
    if (limitingNames.length) {
      els.limitDetails.innerHTML =
        'Limiting ingredient(s): ' +
        limitingNames.map(n => `<span class="badge">${escapeHtml(n)}</span>`).join(' ');
    } else {
      els.limitDetails.textContent = 'No limiting ingredient (only one constraint or extra capacity).';
    }
  } else {
    els.limitDetails.textContent = '';
  }
}

function showStatsMessage(msg) {
  els.stats.innerHTML = `<div>${escapeHtml(msg)}</div>`;
  els.limitDetails.textContent = '';
}

function clearNeeded() {
  Array.from(els.tableBody.querySelectorAll('[data-col="needed"], [data-col="leftover"]'))
    .forEach(cell => { cell.textContent=''; cell.className = cell.classList.contains('leftover') ? 'leftover' : cell.className; });
}

// ---------- UI Helpers ----------
function flashButton(btn, tempText) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = tempText;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1400);
}

function downloadFile(filename, content) {
  const blob = new Blob([content], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Expose calculate for console debugging if needed
window.__appDebug = { state, calculate };