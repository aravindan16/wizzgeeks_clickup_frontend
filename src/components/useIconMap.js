import { useEffect, useState } from 'react';

// Lazily loads the heavy Font Awesome map (./monoIcons) as a separate chunk and
// caches it process-wide, so the main bundle stays lean. Returns the module
// namespace ({ MONO_ICON_MAP, MONO_NAMES, … }) or null until it has loaded.
let MODULE = null;
let promise = null;

export function loadIconMap() {
  if (MODULE) return Promise.resolve(MODULE);
  if (!promise) promise = import('./monoIcons').then((m) => { MODULE = m; return m; });
  return promise;
}

// Pass enabled=false to avoid loading the chunk (e.g. an entity with no FA icon).
export function useIconMap(enabled = true) {
  const [mod, setMod] = useState(MODULE);
  useEffect(() => {
    if (!enabled) return undefined;
    if (MODULE) { if (!mod) setMod(MODULE); return undefined; }
    let active = true;
    loadIconMap().then((m) => { if (active) setMod(m); });
    return () => { active = false; };
  }, [enabled]); // eslint-disable-line
  return mod;
}
