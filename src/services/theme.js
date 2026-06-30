// Theme system: appearance MODE (light/dark/auto) + ACCENT color.
// Both are persisted in localStorage and applied as data-* attributes on <html>,
// so every style keyed to the CSS tokens follows automatically.
const MODE_KEY = 'wg_theme';     // 'light' | 'dark' | 'auto'
const ACCENT_KEY = 'wg_accent';  // one of ACCENTS[].key

// Accent palette. 'black' = the default neutral (keeps the light/dark button
// behaviour); the rest recolor the primary/brand token in both modes.
export const ACCENTS = [
  { key: 'black', label: 'Black', color: '#111827' },
  { key: 'purple', label: 'Purple', color: '#7c3aed' },
  { key: 'blue', label: 'Blue', color: '#2563eb' },
  { key: 'pink', label: 'Pink', color: '#ec4899' },
  { key: 'violet', label: 'Violet', color: '#6d28d9' },
  { key: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { key: 'orange', label: 'Orange', color: '#ea580c' },
  { key: 'teal', label: 'Teal', color: '#0d9488' },
  { key: 'bronze', label: 'Bronze', color: '#a16207' },
  { key: 'mint', label: 'Mint', color: '#10b981' },
];

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

// 'auto' resolves to the OS preference; light/dark pass through.
const resolveMode = (mode) => (mode === 'auto' ? (prefersDark() ? 'dark' : 'light') : mode);

export function getMode() {
  const m = localStorage.getItem(MODE_KEY);
  return m === 'dark' || m === 'auto' ? m : 'light';
}
export function getAccent() {
  const a = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.some((x) => x.key === a) ? a : 'black';
}

export function applyMode(mode) {
  const m = mode === 'dark' || mode === 'auto' ? mode : 'light';
  localStorage.setItem(MODE_KEY, m);
  document.documentElement.setAttribute('data-theme', resolveMode(m));
  return m;
}
export function applyAccent(accent) {
  const a = ACCENTS.some((x) => x.key === accent) ? accent : 'black';
  localStorage.setItem(ACCENT_KEY, a);
  document.documentElement.setAttribute('data-accent', a);
  return a;
}

export function initTheme() {
  applyMode(getMode());
  applyAccent(getAccent());
  // Keep 'auto' in sync with OS changes without a reload.
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getMode() === 'auto') document.documentElement.setAttribute('data-theme', resolveMode('auto'));
    });
  }
}

// --- Back-compat shims for older callers (dark-mode toggle) ---
export function getTheme() { return resolveMode(getMode()); }
export function applyTheme(theme) { return applyMode(theme); }
export function toggleTheme() { return applyMode(getTheme() === 'dark' ? 'light' : 'dark'); }
