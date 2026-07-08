import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { COLOR_ICON_MAP, COLOR_CATEGORIES } from './colorIcons';
import { IconClose } from './icons';

/**
 * ClickUp / Jira-style icon picker backed by **react-icons Flat Color Icons** —
 * full-color, app-style glyphs (no monochrome line icons). Icons are referenced by
 * name and rendered straight from the library, so `onSelect(name)` stores a
 * Flat-Color icon name (e.g. "FcTodoList"). Search matches the humanised name.
 */
// "FcTodoList" -> "todo list", "FcBarChart" -> "bar chart"
const humanize = (n) => n.replace(/^Fc/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([0-9])([A-Za-z])/g, '$1 $2').toLowerCase();
const ALL = COLOR_CATEGORIES.flatMap((c) => c.names.map((n) => ({ n, h: humanize(n) })));

function Glyph({ name, size = 24 }) {
  const Cmp = COLOR_ICON_MAP[name];
  return Cmp ? <Cmp size={size} /> : null;
}

export default function IconPicker({ open, current, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(COLOR_CATEGORIES[0].id);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => (query ? ALL.filter((x) => x.h.includes(query)) : null), [query]);

  if (!open) return null;
  const activeCat = COLOR_CATEGORIES.find((c) => c.id === cat) || COLOR_CATEGORIES[0];
  const shown = query ? results.map((x) => x.n) : activeCat.names;

  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Choose an icon</strong>
          <button className="icon-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div style={s.searchWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input autoFocus style={s.search} placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} />
          {current ? (
            <button type="button" style={s.remove} title="Remove icon" onClick={() => onSelect('')}>Remove</button>
          ) : null}
        </div>

        {!query && (
          <div style={s.tabs}>
            {COLOR_CATEGORIES.map((c) => (
              <button key={c.id} type="button" title={c.label} className="wg-icon-tab"
                style={{ ...s.tab, ...(c.id === cat ? s.tabActive : {}) }} onClick={() => setCat(c.id)}>
                <Glyph name={c.names[0]} size={20} />
              </button>
            ))}
          </div>
        )}

        <div style={s.body}>
          <div style={s.secLabel}>{query ? 'Results' : activeCat.label}</div>
          {shown.length ? (
            <div style={s.grid}>
              {shown.map((n) => (
                <button key={n} type="button" title={humanize(n)} className="wg-icon-cell"
                  style={{ ...s.cell, ...(current === n ? s.cellActive : {}) }} onClick={() => onSelect(n)}>
                  <Glyph name={n} size={24} />
                </button>
              ))}
            </div>
          ) : <div style={s.empty}>No icons match “{q}”.</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: 440, maxWidth: '100%', height: 520, maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', flexShrink: 0 },
  title: { fontSize: 17, color: 'var(--c-text-strong)' },
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },

  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 10px', flexShrink: 0 },
  searchIcon: { position: 'absolute', marginLeft: 10, fontSize: 13, pointerEvents: 'none', opacity: .6 },
  search: { flex: 1, height: 38, padding: '0 12px 0 32px', fontSize: 14, color: 'var(--c-text-strong)', background: 'var(--c-surface-2)',
    border: '1px solid var(--c-border)', borderRadius: 10, outline: 'none' },
  remove: { height: 38, padding: '0 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--c-danger, #dc2626)', background: 'none',
    border: '1px solid var(--c-border)', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' },

  tabs: { display: 'flex', gap: 4, padding: '0 12px 8px', borderBottom: '1px solid var(--c-border)', flexShrink: 0, overflowX: 'auto' },
  tab: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 36, background: 'none',
    border: 'none', borderRadius: 8, cursor: 'pointer', opacity: .85 },
  tabActive: { background: 'var(--c-surface-2)', opacity: 1, boxShadow: 'inset 0 -2px 0 var(--c-primary)' },

  body: { flex: 1, overflowY: 'auto', padding: '10px 16px 16px' },
  secLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--c-muted)', margin: '2px 2px 10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: 6 },
  cell: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, background: 'transparent',
    border: '1px solid transparent', borderRadius: 10, cursor: 'pointer', transition: 'background .12s' },
  cellActive: { borderColor: 'var(--c-primary)', background: 'var(--c-primary-weak)', boxShadow: '0 0 0 1px var(--c-primary)' },
  empty: { padding: '30px 10px', textAlign: 'center', color: 'var(--c-muted)', fontSize: 13 },
};
