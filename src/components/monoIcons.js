// Full monochrome icon set — the ENTIRE Font Awesome 6 library (react-icons/fa6),
// the same source ClickUp uses. This module is HEAVY, so it is imported LAZILY
// (see ./useIconMap) and split into its own chunk; nothing imports it statically.
import * as Fa6 from 'react-icons/fa6';

// Every FA6 icon component, keyed by its export name (FaHouse, FaArrowsToCircle, …).
export const MONO_ICON_MAP = {};
for (const [name, Cmp] of Object.entries(Fa6)) {
  if (name.startsWith('Fa') && typeof Cmp === 'function') MONO_ICON_MAP[name] = Cmp;
}
// Alphabetical list of all names (for the grid + search).
export const MONO_NAMES = Object.keys(MONO_ICON_MAP).sort();

// Re-export the codec so existing importers of monoIcons keep working.
export { ICON_COLORS, DEFAULT_ICON_COLOR, encodeIcon, decodeIcon } from './iconCodec';
