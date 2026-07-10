import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ICON_COLORS, DEFAULT_ICON_COLOR, encodeIcon, decodeIcon } from './iconCodec';
import { useIconMap } from './useIconMap';
import { IconClose } from './icons';

/**
 * ClickUp-style icon picker: the full Font Awesome 6 set (loaded lazily), monochrome
 * and tinted to a COLOR chosen from a palette (or a custom colour). `onSelect(value)`
 * stores "IconName|#color". Rendered lazily (grows on scroll) so 2k+ icons stay smooth.
 */
// "FaArrowsToCircle" -> "arrows to circle"
const humanize = (n) => n.replace(/^(Fa|Fc)/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([0-9])([A-Za-z])/g, '$1 $2').toLowerCase();
const PAGE = 240; // icons rendered per "page" (more revealed as you scroll)

export default function IconPicker({ open, current, onSelect, onClose }) {
  const mono = useIconMap(open); // lazy-loads the FA6 set only when the picker is open
  const [q, setQ] = useState('');
  const [color, setColor] = useState(DEFAULT_ICON_COLOR);
  const [showColors, setShowColors] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const colorRef = useRef(null);

  const { name: curName, color: curColor } = decodeIcon(current);
  useEffect(() => { if (open) { setColor(curColor || DEFAULT_ICON_COLOR); setQ(''); setLimit(PAGE); } }, [open]); // eslint-disable-line
  useEffect(() => { setLimit(PAGE); }, [q]);
  useEffect(() => {
    if (!showColors) return undefined;
    const h = (e) => { if (colorRef.current && !colorRef.current.contains(e.target)) setShowColors(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [showColors]);

  const MAP = mono?.MONO_ICON_MAP;
  const ALL = useMemo(() => (mono?.MONO_NAMES ? mono.MONO_NAMES.map((n) => ({ n, h: humanize(n) })) : []), [mono]);
  const query = q.trim().toLowerCase();
  const matches = useMemo(() => (query ? ALL.filter((x) => x.h.includes(query)) : ALL), [query, ALL]);
  const shown = useMemo(() => matches.slice(0, limit), [matches, limit]);

  if (!open) return null;
  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) setLimit((n) => Math.min(n + PAGE, matches.length));
  };

  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Choose an icon</strong>
          <button className="icon-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div style={s.searchWrap}>
          <input autoFocus style={s.search} placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} />

          {/* Colour selector — a dot showing the current colour; opens a palette + custom picker. */}
          <div style={{ position: 'relative' }} ref={colorRef}>
            <button type="button" title="Icon colour" style={{ ...s.colorDot, background: color }}
              onClick={() => setShowColors((v) => !v)} />
            {showColors && (
              <div style={s.colorPop} onMouseDown={(e) => e.stopPropagation()}>
                <div style={s.swatchGrid}>
                  {ICON_COLORS.map((c) => (
                    <button key={c} type="button" title={c} onClick={() => { setColor(c); setShowColors(false); }}
                      style={{ ...s.swatch, background: c, color: c, ...(color === c ? s.swatchActive : {}) }} />
                  ))}
                </div>
                <label style={s.customRow}>
                  <span style={{ ...s.swatch, background: color, color }} />
                  <span>Custom colour</span>
                  <input type="color" style={s.nativeColor}
                    value={/^#([0-9a-f]{6})$/i.test(color) ? color : '#6b7280'}
                    onChange={(e) => setColor(e.target.value)} />
                </label>
              </div>
            )}
          </div>

          {current ? (
            <button type="button" style={s.remove} title="Remove icon" onClick={() => onSelect('')}>Remove</button>
          ) : null}
        </div>

        <div style={s.body} onScroll={onScroll}>
          {!mono ? (
            <div style={s.empty}>Loading icons…</div>
          ) : (
            <>
              <div style={s.secLabel}>{query ? `${matches.length} result${matches.length === 1 ? '' : 's'}` : 'All icons'}</div>
              {shown.length ? (
                <div style={s.grid}>
                  {shown.map(({ n }) => {
                    const Cmp = MAP[n];
                    return (
                      <button key={n} type="button" title={humanize(n)} className="wg-icon-cell"
                        style={{ ...s.cell, ...(curName === n ? s.cellActive : {}) }} onClick={() => onSelect(encodeIcon(n, color))}>
                        {Cmp ? <Cmp size={24} style={{ color }} /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : <div style={s.empty}>No icons match “{q}”.</div>}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: 440, maxWidth: '100%', height: 560, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', flexShrink: 0 },
  title: { fontSize: 17, color: 'var(--c-text-strong)' },
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },

  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', flexShrink: 0 },
  search: { flex: 1, height: 38, padding: '0 12px', fontSize: 14, color: 'var(--c-text-strong)', background: 'var(--c-surface-2)',
    border: '1px solid var(--c-border)', borderRadius: 10, outline: 'none' },
  remove: { height: 38, padding: '0 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--c-danger, #dc2626)', background: 'none',
    border: '1px solid var(--c-border)', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' },

  colorDot: { width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--c-surface)', boxShadow: '0 0 0 1px var(--c-border)',
    cursor: 'pointer', flexShrink: 0, padding: 0 },
  colorPop: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 5, width: 200, padding: 12,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.18)' },
  swatchGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 7 },
  swatch: { width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, boxSizing: 'border-box' },
  swatchActive: { boxShadow: '0 0 0 2px var(--c-surface), 0 0 0 4px currentColor' },
  customRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c-border)',
    fontSize: 13, color: 'var(--c-text)', cursor: 'pointer' },
  nativeColor: { marginLeft: 'auto', width: 28, height: 28, border: 'none', background: 'none', padding: 0, cursor: 'pointer' },

  body: { flex: 1, overflowY: 'auto', padding: '10px 16px 16px' },
  secLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--c-muted)', margin: '2px 2px 10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: 6 },
  cell: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 46, background: 'transparent',
    border: '1px solid transparent', borderRadius: 10, cursor: 'pointer', transition: 'background .12s' },
  cellActive: { borderColor: 'var(--c-primary)', background: 'var(--c-primary-weak)', boxShadow: '0 0 0 1px var(--c-primary)' },
  empty: { padding: '30px 10px', textAlign: 'center', color: 'var(--c-muted)', fontSize: 13 },
};
