import { useEffect, useRef, useState } from 'react';
import { labelsApi } from './labelsApi';
import { IconPlus, IconClose, IconSearch, Chevron } from '../../components/icons';

/**
 * Label editor for a task: shows the task's labels as colored chips (each with a
 * remove ×) plus a "+ Label" picker that lists the global catalog (existing
 * labels reusable across every Space/List) and lets you create a new one by
 * typing a name. Labels are stored on the task as an array of names.
 *
 *   value:    string[]  — the task's current label names
 *   onChange: (names)   — called with the new array
 */
export default function LabelPicker({ value = [], onChange, variant = 'chips' }) {
  const names = Array.isArray(value) ? value : [];
  const field = variant === 'field'; // render a Select-style trigger box
  const [catalog, setCatalog] = useState([]); // [{id,name,color}]
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const load = () => labelsApi.list().then(setCatalog).catch(() => setCatalog([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    load();
    // Focus WITHOUT scrolling — autoFocus makes the modal jump to reveal the input.
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h, true); };
  }, [open]);

  const add = (name) => {
    const n = (name || '').trim();
    if (!n || names.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    onChange([...names, n]);
  };
  const remove = (name) => onChange(names.filter((x) => x !== name));

  const q = query.trim();
  const lower = q.toLowerCase();
  const available = catalog.filter((l) => !names.some((n) => n.toLowerCase() === l.name.toLowerCase()));
  const matches = q ? available.filter((l) => l.name.toLowerCase().includes(lower)) : available;
  const exactExists = catalog.some((l) => l.name.toLowerCase() === lower);

  const pick = (l) => { add(l.name); setQuery(''); };
  const createAndAdd = async () => {
    if (!q || busy) return;
    setBusy(true);
    try {
      const created = await labelsApi.create(q);
      setCatalog((c) => (c.some((x) => x.id === created.id) ? c : [...c, created]));
      add(created.name);
      setQuery('');
      window.dispatchEvent(new Event('wg-labels-changed'));
    } catch { /* surfaced by apiClient toast */ }
    finally { setBusy(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={field ? s.fieldTrigger : s.row}
        onClick={field ? () => setOpen((o) => !o) : undefined}>
        <div style={s.chips}>
          {field && names.length === 0 && <span style={s.placeholder}>Select labels…</span>}
          {names.map((n) => (
            <span key={n} style={s.chip}>
              <span style={s.chipText}>{n}</span>
              <button style={s.chipX} title="Remove" onClick={(e) => { e.stopPropagation(); remove(n); }}><IconClose size={11} /></button>
            </span>
          ))}
        </div>
        {field
          ? <span style={s.caret}><Chevron open={open} size={13} /></span>
          : <button type="button" style={s.addBtn} title="Add label" onClick={() => setOpen((o) => !o)}><IconPlus size={15} /></button>}
      </div>

      {open && (
        <div style={s.pop}>
          <div style={s.searchRow}>
            <IconSearch size={14} />
            <input ref={inputRef} style={s.search} placeholder="Search or create…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && q && !exactExists) createAndAdd(); }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
            {matches.map((l) => (
              <button key={l.id} type="button" className="wg-menu-item" style={s.optRow} onClick={() => pick(l)}>
                <span style={s.dot} /> {l.name}
              </button>
            ))}
            {q && !exactExists && (
              <button type="button" className="wg-menu-item" style={{ ...s.optRow, color: 'var(--c-primary)' }} onClick={createAndAdd} disabled={busy}>
                <IconPlus size={13} /> {busy ? 'Creating…' : <>Create “<b>{q}</b>”</>}
              </button>
            )}
            {matches.length === 0 && !q && <div style={s.empty}>No labels yet — type to create one</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  // Single row: chips clip to one line (fade on the right when they overflow);
  // the "+ Label" button sits outside the clipped area so it's always visible.
  row: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  // Select-style trigger box (variant="field") — matches the app's dropdowns.
  fieldTrigger: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10,
    boxShadow: '0 1px 2px rgba(16,24,40,.06)', cursor: 'pointer', minHeight: 40 },
  placeholder: { color: 'var(--c-faint)', fontSize: 13.5 },
  caret: { color: 'var(--c-muted)', display: 'inline-flex', flexShrink: 0 },
  chips: { display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0,
    WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 14px), transparent)',
    maskImage: 'linear-gradient(to right, #000 calc(100% - 14px), transparent)' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 6px 3px 10px', borderRadius: 999,
    fontSize: 12.5, fontWeight: 600, flexShrink: 0, maxWidth: 150,
    background: 'color-mix(in srgb, var(--c-primary) 16%, transparent)', color: 'var(--c-primary)' },
  chipText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chipX: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none',
    cursor: 'pointer', padding: 0, opacity: 0.75, color: 'inherit', flexShrink: 0 },
  addBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
    border: '1px dashed var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)',
    borderRadius: '50%', cursor: 'pointer', flexShrink: 0 },
  pop: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: 260, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 14px 34px rgba(16,24,40,.18)', padding: 8 },
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', border: '1px solid var(--c-border)',
    borderRadius: 8, color: 'var(--c-faint)' },
  search: { flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--c-text)' },
  optRow: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  dot: { width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: 'var(--c-primary)' },
  empty: { padding: '10px', color: 'var(--c-faint)', fontSize: 13, textAlign: 'center' },
};
