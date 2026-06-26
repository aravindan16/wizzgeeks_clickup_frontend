import { useEffect, useState } from 'react';
import { loadViews, saveViews, newView, defaultViews, isBuiltinView } from './viewsStore';

/**
 * Views state for a scope (a Space id or a List id). Handles load/persist,
 * active selection, inline rename, and add/remove (builtin views are protected).
 * Both the Space board and the List board share this so behaviour stays identical.
 */
export function useViews(scopeId) {
  const [views, setViews] = useState(() => loadViews(scopeId));
  const [activeId, setActiveId] = useState(() => loadViews(scopeId)[0]?.id || 'board');
  const [renaming, setRenaming] = useState(null);

  useEffect(() => {
    const v = loadViews(scopeId);
    setViews(v);
    setActiveId((cur) => (cur === 'members' || v.some((x) => x.id === cur)) ? cur : (v[0]?.id || 'board'));
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
