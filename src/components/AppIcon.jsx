import { ICON_MAP } from './iconLibrary';

/**
 * Renders an entity's icon value chosen from the IconPicker.
 * The value is a Lucide icon name (e.g. "Rocket") resolved via the curated ICON_MAP.
 * Legacy values saved as emoji before the library switch still render as plain text,
 * so nothing breaks. Returns null when there is no icon.
 */
export function hasIcon(v) {
  return !!(v && String(v).trim());
}

export default function AppIcon({ name, size = 16, style, className, strokeWidth = 2 }) {
  if (!hasIcon(name)) return null;
  const key = String(name).trim();
  const Cmp = ICON_MAP[key];
  if (Cmp) return <Cmp size={size} style={style} className={className} strokeWidth={strokeWidth} />;
  // Legacy emoji / plain-text icon.
  return <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }}>{key}</span>;
}
