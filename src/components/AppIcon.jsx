import { COLOR_ICON_MAP } from './colorIcons';
import { ICON_MAP } from './iconLibrary';
import { decodeIcon, isMonoName } from './iconCodec';
import { useIconMap } from './useIconMap';

/**
 * Renders an entity's icon value chosen from the IconPicker.
 * New picks are monochrome + colour: "FaRocket|#7c3aed" (tinted glyph, from the
 * lazily-loaded Font Awesome set). Also renders Flat-Color names ("FcTodoList"),
 * legacy Lucide names ("Rocket"), and raw emoji. Returns null when there's no icon.
 */
export function hasIcon(v) {
  return !!(v && String(v).trim());
}

export default function AppIcon({ name, size = 16, style, className, strokeWidth = 2 }) {
  const has = hasIcon(name);
  const { name: key, color } = decodeIcon(has ? String(name).trim() : '');
  // Only pull in the (heavy) FA chunk when this icon actually is an FA icon.
  const mono = useIconMap(has && isMonoName(key));
  if (!has) return null;

  // Monochrome (tintable) Font Awesome icon.
  if (mono) {
    const Mono = mono.MONO_ICON_MAP[key];
    if (Mono) return <Mono size={size} style={{ color: color || 'currentColor', ...style }} className={className} />;
  } else if (isMonoName(key)) {
    // Chunk still loading and this IS an FA icon → reserve space (avoid emoji flash).
    return <span className={className} style={{ display: 'inline-block', width: size, height: size, ...style }} />;
  }

  const Color = COLOR_ICON_MAP[key];
  if (Color) return <Color size={size} style={style} className={className} />;

  const Line = ICON_MAP[key]; // legacy Lucide picks
  if (Line) return <Line size={size} style={{ ...(color ? { color } : {}), ...style }} className={className} strokeWidth={strokeWidth} />;

  // Legacy emoji / plain-text icon.
  return <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }}>{key}</span>;
}
