import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconCheck } from './icons';

/**
 * Custom dropdown that replaces the native <select> so the open list can be
 * fully styled (rounded corners, hover/selected states, shadow). Drop-in:
 *   <Select value={v} onChange={setV} options={[{value,label}]} />
 * The menu is position:fixed (anchored to the trigger) so it never clips, and
 * flips above the trigger when there isn't room below.
 */
export default function Select({ value, onChange, options = [], placeholder = 'Select…', disabled, style, highlight = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const vh = window.innerHeight;
      const below = vh - r.bottom;
      const above = r.top;
      const openUp = below < 240 && above > below;
      const maxHeight = Math.min(300, (openUp ? above : below) - 12);
      setPos({
        left: r.left, width: r.width, maxHeight,
        top: openUp ? undefined : r.bottom + 4,
        bottom: openUp ? vh - r.top + 4 : undefined,
      });
    };
    place();
    // Menu is portaled to <body>, so treat clicks inside it (via menuRef) as inside too.
    const onDoc = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    // Capture phase so a parent modal's stopPropagation() can't swallow the outside-click.
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc, true); document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Drop focus after choosing so the trigger doesn't keep a "selected"/focused
  // border once the value is set.
  const pick = (v) => { onChange(v); setOpen(false); btnRef.current?.blur(); };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button ref={btnRef} type="button" disabled={disabled} className="wg-select-trigger"
        style={{ ...s.trigger, ...(highlight && !open ? s.triggerHighlight : {}), ...(open ? s.triggerOpen : {}), ...(disabled ? s.disabled : {}) }}
        onClick={() => !disabled && setOpen((o) => !o)}>
        <span style={{ ...s.value, color: selected ? '#1f2430' : '#9ca3af' }}>{selected ? selected.label : placeholder}</span>
        <span style={{ ...s.chev, transform: open ? 'rotate(180deg)' : 'none' }}><IconChevronDown size={16} /></span>
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="listbox"
          style={{ ...s.menu, left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}>
          {options.length === 0 && <div style={s.empty}>No options</div>}
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button key={String(o.value)} type="button" role="option" aria-selected={sel}
                className="wg-select-opt" style={{ ...s.option, ...(sel ? s.optionSel : {}) }}
                onClick={() => pick(o.value)}>
                <span style={s.optLabel}>{o.label}</span>
                {sel && <span style={s.check}><IconCheck size={15} /></span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

const s = {
  trigger: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 10,
    boxShadow: '0 1px 2px rgba(16,24,40,.06)', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, letterSpacing: '.01em',
    textAlign: 'left', transition: 'border-color .12s, box-shadow .12s',
  },
  triggerOpen: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 3px var(--c-primary-weak)' },
  triggerHighlight: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 2px var(--c-primary-weak)' },
  disabled: { background: 'var(--c-surface-3)', color: 'var(--c-faint)', cursor: 'not-allowed', boxShadow: 'none' },
  value: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chev: { color: 'var(--c-muted)', display: 'inline-flex', transition: 'transform .15s', flexShrink: 0 },
  menu: {
    position: 'fixed', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12,
    boxShadow: '0 16px 40px rgba(16,24,40,.18)', zIndex: 400, overflowY: 'auto',
    animation: 'wg-pop 140ms ease', fontFamily: 'inherit',
    // Stack options with a small gap so a hovered item's grey never abuts the
    // selected item's tint. Keep `padding` equal to `gap` so the space above the
    // first item and below the last matches the gap between items (uniform all round).
    display: 'flex', flexDirection: 'column', gap: 4, padding: 4,
  },
  // NOTE: no `background` here — the .wg-select-opt CSS controls hover/idle/selected bg
  // (an inline background would override the :hover rule).
  option: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
    padding: '9px 11px', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, letterSpacing: '.01em',
    color: 'var(--c-text)', textAlign: 'left',
  },
  optionSel: { color: 'var(--c-text-strong)', fontWeight: 600 },
  optLabel: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  check: { color: 'var(--c-text-strong)', display: 'inline-flex', flexShrink: 0 },
  empty: { padding: '10px', color: 'var(--c-faint)', fontSize: 13, textAlign: 'center' },
};
