import { useEffect, useState } from 'react';
import AddViewMenu from './AddViewMenu';
import { isBuiltinView } from './viewsStore';
import { IconBoard, IconList, IconListCheck, IconEdit, IconTrash } from '../../components/icons';

const viewIcon = (type) =>
  (type === 'board' ? <IconBoard size={16} /> : type === 'table' ? <IconListCheck size={16} /> : <IconList size={16} />);

/**
 * View tab bar shared by the Space and List boards. Renders the List/Board/Table
 * tabs with inline rename + a right-click menu (Rename / Delete view — Delete is
 * disabled for the builtin views), a "+ View" picker, and any extra tabs
 * (e.g. Members) passed in.
 */
export default function ViewTabs({ vs, extraTabs = [] }) {
  const { views, activeId, setActiveId, renaming, setRenaming, updateView, addView, removeView } = vs;
  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { id, x, y }

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onEsc = (e) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('scroll', close, true); document.removeEventListener('keydown', onEsc); };
  }, [menu]);

  return (
    <div style={s.tabs}>
      {views.map((v) => (
        <span key={v.id} style={s.tabWrap}>
          {renaming === v.id ? (
            <input autoFocus value={v.name} style={s.renameInput}
              onChange={(e) => updateView(v.id, { name: e.target.value })}
              onBlur={() => setRenaming(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenaming(null); }} />
          ) : (
            <button className={`wg-tab${activeId === v.id ? ' active' : ''}`}
              onClick={() => setActiveId(v.id)} onDoubleClick={() => setRenaming(v.id)}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ id: v.id, x: e.clientX, y: e.clientY }); }}
              title="Right-click for options">
              <span style={s.tabInner}>{viewIcon(v.type)} {v.name}</span>
            </button>
          )}
        </span>
      ))}

      {extraTabs.map((t) => (
        <button key={t.id} className={`wg-tab${t.active ? ' active' : ''}`} onClick={t.onClick}>
          <span style={s.tabInner}>{t.icon} {t.label}</span>
        </button>
      ))}

      <span style={{ position: 'relative' }}>
        <button style={s.addViewBtn} onClick={() => setAddOpen((o) => !o)}>+ View</button>
        <AddViewMenu open={addOpen} onClose={() => setAddOpen(false)} onPick={addView} />
      </span>

      {menu && (() => {
        const v = views.find((x) => x.id === menu.id);
        if (!v) return null;
        const builtin = isBuiltinView(v);
        return (
          <>
            <div style={s.menuBackdrop} onClick={() => setMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
            <div style={{ ...s.viewMenu, left: menu.x, top: menu.y }}>
              <button className="wg-menu-item" style={s.viewMenuItem}
                onClick={() => { setRenaming(v.id); setMenu(null); }}>
                <IconEdit size={15} /> Rename
              </button>
              <button className="wg-menu-item"
                style={{ ...s.viewMenuItem, ...(builtin ? s.disabled : { color: '#ef4444' }) }}
                disabled={builtin}
                title={builtin ? "Default views can't be deleted" : 'Delete this view'}
                onClick={() => { if (!builtin) { removeView(v.id); setMenu(null); } }}>
                <IconTrash size={15} /> Delete view
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

const s = {
  tabs: { display: 'flex', alignItems: 'center', gap: 4, margin: '16px 0', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' },
  tabWrap: { display: 'inline-flex', alignItems: 'center' },
  tabInner: { display: 'inline-flex', alignItems: 'center', gap: 7 },
  renameInput: { font: 'inherit', fontSize: 14, fontWeight: 600, padding: '6px 8px', border: '1px solid var(--c-primary)',
    borderRadius: 7, background: 'var(--c-surface)', color: 'var(--c-text)', width: 130, outline: 'none' },
  addViewBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--c-muted)',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px 10px' },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 400 },
  viewMenu: { position: 'fixed', zIndex: 401, minWidth: 180, background: 'var(--c-surface)', color: 'var(--c-text)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 14px 34px rgba(0,0,0,.18)', padding: 6 },
  viewMenuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none',
    border: 'none', padding: '9px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  disabled: { color: 'var(--c-faint)', cursor: 'not-allowed' },
};
