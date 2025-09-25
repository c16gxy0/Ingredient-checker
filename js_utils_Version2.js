// Utility helpers (formatting, rounding, DOM templating, etc.)

export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0;
    const v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

export function escapeHtml(str) {
  return (str + '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

export function parseNumberMaybe(v) {
  if (v === "" || v === null || v === undefined) return "";
  const num = Number(v);
  return isFinite(num) ? num : "";
}

export function getRoundingFunction(mode) {
  if (mode === 'none') return v => v;
  const decimals = Number(mode);
  return v => {
    if (!isFinite(v)) return "";
    return Number(v.toFixed(decimals));
  };
}

export function formatNumber(v, roundingFn) {
  if (v === "" || v === null || !isFinite(v)) return "";
  return roundingFn(v);
}

export function debounce(fn, delay=180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), delay);
  };
}

export function deepClone(obj) {
  return structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}