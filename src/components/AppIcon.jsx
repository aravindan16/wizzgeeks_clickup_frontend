import { COLOR_ICON_MAP } from './colorIcons';
import { ICON_MAP } from './iconLibrary';

/**
 * Renders an entity's icon value chosen from the IconPicker.
 * New picks are Flat-Color icon names (e.g. "FcTodoList") → colorful glyph.
 * Older picks may be Lucide names (e.g. "Rocket") or raw emoji — both still render,
 * so nothing breaks. Returns null when there is no icon.
 */
export function hasIcon(v) {
  return !!(v && String(v).trim());
}

export default function AppIcon({ name, size = 16, style, className, strokeWidth = 2 }) {
  if (!hasIcon(name)) return null;
  const key = String(name).trim();

  const Color = COLOR_ICON_MAP[key];
  if (Color) return <Color size={size} style={style} className={className} />;

  const Line = ICON_MAP[key]; // legacy Lucide picks
  if (Line) return <Line size={size} style={style} className={className} strokeWidth={strokeWidth} />;

  // Legacy emoji / plain-text icon.
  return <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }}>{key}</span>;
}
