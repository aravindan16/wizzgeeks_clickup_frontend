import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { labelsApi } from './labelsApi';
import { IconPlus, IconClose, IconSearch, IconCheck, Chevron } from '../../components/icons';

/**
 * Label editor for a task: chips (each with a remove ×) plus a picker listing the
 * global catalog with checkboxes. Selections are BUFFERED while the picker is open
 * and committed once (a single onChange → one API save) when it closes.
 *
 *   value:    string[]  — the task's current label names
 *   onChange: (names)   — called with the new array (once, on close)
 */
export default function LabelPicker({ value = [], onChange, variant = 'chips' }) {
  const names = Array.isArray(value) ? value : [];
  const field = variant === 'field';
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(null);
  const [draft, setDraft] = useState(names); // working selection while open
  const draftRef = useRef(draft);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const load = () => labelsApi.list().then(setCatalog).catch(() => setCatalog([]));
  useEffect(() => { load(); }, []);

  const openPicker = () => { setDraft(names); draftRef.current = names; setQuery(''); setOpen(true); };
  // Commit the buffered selection with a SINGLE onChange (one save), then close.
  const commitAndClose = () => {
    setOpen(false);
    const d = draftRef.current;
    const changed = d.length !== names.length || d.some((n) => !names.includes(n)) || names.some((n) => !d.includes(n));
    if (changed) onChange(d);
  };

  // Refresh the catalog when labels change elsewhere — NOT on every open (that
  // fired an API call each time the picker was opened).
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('wg-labels-changed', onChanged);
    return () => window.removeEventListener('wg-labels-changed', onChanged);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    const h = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      commitAndClose();
    };
    const esc = (e) => { if (e.key === 'Escape') commitAndClose(); };
    document.addEventListener('mousedown', h, true);
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h, true); document.removeEventListener('keydown', esc); };
  }, [open]); // eslint-disable-line

  // Position the portaled popover; flip above the trigger and cap its height so it
  // fits the viewport (and its list scrolls) — never clipped or run off-screen.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 240);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - width));
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const openUp = below < 252 && above > below;
      // Cap so the list shows ~5 rows then scrolls (search ~44 + 5×~40 + padding).
      const maxHeight = Math.max(150, Math.min(252, openUp ? above : below));
      setPos(openUp
        ? { left, width, maxHeight, bottom: window.innerHeight - r.top + 6 }
        : { left, width, maxHeight, top: r.bottom + 6 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  // Current selection = the draft while open, else the committed value.
  const current = open ? draft : names;
  const has = (name) => current.some((n) => n.toLowerCase() === name.toLowerCase());
  // Dropdown checkbox toggles are BUFFERED while open (committed once on close).
  const setSel = (next) => (open ? setDraft(next) : onChange(next));
  const addName = (name) => { const n = (name || '').trim(); if (!n || has(n)) return; setSel([...current, n]); };
  const toggleName = (name) => (has(name) ? setSel(current.filter((x) => x !== name)) : addName(name));
  // Clicking a chip's × is a direct action — persist IMMEDIATELY (one remove = one
  // save), and keep the draft in sync so closing doesn't re-commit.
  const removeChip = (name) => {
    const next = current.filter((x) => x !== name);
    setDraft(next); draftRef.current = next;
    onChange(next);
  };

  const q = query.trim();
  const lower = q.toLowerCase();
  const matches = q ? catalog.filter((l) => l.name.toLowerCase().includes(lower)) : catalog;
  const exactExists = catalog.some((l) => l.name.toLowerCase() === lower);

  const createAndAdd = async () => {
    if (!q || busy) return;
    setBusy(true);
    try {
      const created = await labelsApi.create(q);
      setCatalog((c) => (c.some((x) => x.id === created.id) ? c : [...c, created]));
      addName(created.name);
      setQuery('');
      window.dispatchEvent(new Event('wg-labels-changed'));
    } catch { /* surfaced by apiClient toast */ }
    finally { setBusy(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={field ? s.fieldTrigger : s.row}
        onClick={field ? () => (open ? commitAndClose() : openPicker()) : undefined}>
        <div style={s.chips}>
          {field && current.length === 0 && <span style={s.placeholder}>Select labels…</span>}
          {current.map((n) => (
            <span key={n} style={s.chip}>
              <span style={s.chipText}>{n}</span>
              <button className="wg-chip-x" style={s.chipX} title="Remove" onClick={(e) => { e.stopPropagation(); removeChip(n); }}><IconClose size={11} /></button>
            </span>
          ))}
        </div>
        {field
          ? <span style={s.caret}><Chevron open={open} size={13} /></span>
          : <button type="button" style={s.addBtn} title="Add label" onClick={() => (open ? commitAndClose() : openPicker())}><IconPlus size={15} /></button>}
      </div>

      {open && pos && createPortal(
        <div ref={menuRef} style={{ ...s.pop, position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight, display: 'flex', flexDirection: 'column' }}>
          <div className="wg-label-search-row" style={{ ...s.searchRow, flexShrink: 0 }}>
            <IconSearch size={14} />
            <input ref={inputRef} className="wg-label-search" style={s.search} placeholder="Search or create…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && q && !exactExists) createAndAdd(); }} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 4 }}>
            {matches.map((l) => {
              const sel = has(l.name);
              return (
                <button key={l.id} type="button" className="wg-menu-item" style={s.optRow} onClick={() => toggleName(l.name)}>
                  <span style={{ ...s.check, ...(sel ? s.checkOn : {}) }}>{sel && <IconCheck size={11} />}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                </button>
              );
            })}
            {q && !exactExists && (
              <button type="button" className="wg-menu-item" style={{ ...s.optRow, color: 'var(--c-primary)' }} onClick={createAndAdd} disabled={busy}>
                <span style={s.check} /><IconPlus size={13} /> {busy ? 'Creating…' : <>Create “<b>{q}</b>”</>}
              </button>
            )}
            {matches.length === 0 && !q && <div style={s.empty}>No labels yet — type to create one</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const s = {
  row: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  fieldTrigger: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10,
    boxShadow: '0 1px 2px rgba(16,24,40,.06)', cursor: 'pointer', minHeight: 40 },
  placeholder: { color: 'var(--c-faint)', fontSize: 13.5 },
  caret: { color: 'var(--c-muted)', display: 'inline-flex', flexShrink: 0 },
  // Wrap chips onto multiple lines so every chosen label is visible (identifiable).
  // `flex: 0 1 auto` (not `1`) keeps the container from stretching, so the "+" Add
  // button hugs the chips on the LEFT (under the "Labels" title) instead of being
  // pushed to the far right where it reads as unrelated to the field.
  chips: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: '0 1 auto', minWidth: 0 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 6px 3px 10px', borderRadius: 999,
    fontSize: 12.5, fontWeight: 600, flexShrink: 0, maxWidth: 150,
    background: 'color-mix(in srgb, var(--c-primary) 16%, transparent)', color: 'var(--c-primary)' },
  chipText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chipX: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none',
    cursor: 'pointer', padding: 0, width: 16, height: 16, opacity: 0.75, color: 'inherit', flexShrink: 0 },
  addBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
    border: '1px dashed var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)',
    borderRadius: '50%', cursor: 'pointer', flexShrink: 0 },
  pop: { zIndex: 2100, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 14px 34px rgba(16,24,40,.18)', padding: 8 },
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--c-border)',
    borderRadius: 8, color: 'var(--c-faint)' },
  search: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--c-text)' },
  optRow: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  check: { width: 16, height: 16, flexShrink: 0, borderRadius: 4, border: '1.5px solid var(--c-border)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  checkOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  empty: { padding: '10px', color: 'var(--c-faint)', fontSize: 13, textAlign: 'center' },
};
