import { useEffect, useState } from 'react';
import { loadViews, saveViews, newView, defaultViews, isBuiltinView } from './viewsStore';

/**
 * Views state for a scope (a Space id or a List id). Handles load/persist,
 * active selection, inline rename, and add/remove (builtin views are protected).
 * Both the Space board and the List board share this so behaviour stays identical.
 */
// Prefer the Board view when opening a Space/List (ClickUp-style default),
// falling back to the first available view if there is no board view.
const boardIdOf = (v) =>
  (v.find((x) => x.type === 'board') || v.find((x) => x.id === 'board') || v[0] || {}).id || 'board';

export function useViews(scopeId) {
  const [views, setViews] = useState(() => loadViews(scopeId));
  const [activeId, setActiveId] = useState(() => boardIdOf(loadViews(scopeId)));
  const [renaming, setRenaming] = useState(null);

  useEffect(() => {
    const v = loadViews(scopeId);
    setViews(v);
    // Always land on the Board view when navigating into a Space/List.
    setActiveId(boardIdOf(v));
  }, [scopeId]);

  const save = (next) => { setViews(next); saveViews(scopeId, next); };
  const updateView = (vid, patch) => save(views.map((v) => (v.id === vid ? { ...v, ...patch } : v)));
  const addView = (type) => { const v = newView(type); save([...views, v]); setActiveId(v.id); };
  const removeView = (vid) => {
    if (isBuiltinView(views.find((v) => v.id === vid))) return;
    const next = views.filter((v) => v.id !== vid);
    const safe = next.length ? next : defaultViews();
    save(safe);
    setActiveId((a) => (a === vid ? safe[0].id : a));
  };

  const activeView = views.find((v) => v.id === activeId);
  return { views, activeId, setActiveId, renaming, setRenaming, updateView, addView, removeView, activeView };
}
