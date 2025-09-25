// Local Storage Interaction Layer
// Provides namespaced load/save/reset for the recipe scaler state.

const KEY = 'ingredient_part_scaler_v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore write errors (quota, privacy modes, etc.)
  }
}

export function clearState() {
  localStorage.removeItem(KEY);
}