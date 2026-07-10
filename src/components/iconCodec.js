// Lightweight icon helpers (NO heavy icon imports) — safe to import anywhere.
// The actual Font Awesome set lives in ./monoIcons and is loaded lazily.

// Palette shown in the picker (ClickUp-ish). First is a neutral default.
export const ICON_COLORS = [
  '#6b7280', '#111827', '#7c3aed', '#6d28d9', '#4f46e5', '#2563eb', '#0ea5e9', '#0d9488',
  '#059669', '#16a34a', '#65a30d', '#ca8a04', '#eab308', '#f59e0b', '#ea580c', '#ef4444',
  '#e11d48', '#ec4899', '#a855f7', '#a16207', '#78716c',
];
export const DEFAULT_ICON_COLOR = ICON_COLORS[0];

// Stored value format: "FaRocket|#7c3aed" (colour optional).
export const encodeIcon = (name, color) => (color ? `${name}|${color}` : name);
export const decodeIcon = (val) => {
  const s = String(val || '');
  const i = s.indexOf('|');
  return i === -1 ? { name: s, color: '' } : { name: s.slice(0, i), color: s.slice(i + 1) };
};

// A monochrome (Font Awesome) icon name — used to decide whether to wait for the
// lazily-loaded icon map before falling back to other renderers.
export const isMonoName = (key) => /^Fa[A-Z0-9]/.test(key);
