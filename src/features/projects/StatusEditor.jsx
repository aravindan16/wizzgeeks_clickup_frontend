import { useEffect, useState } from 'react';
import { STATUS_GROUPS, DEFAULT_SPACE_STATUSES } from '../tasks/tasksApi';
import { projectsApi } from './projectsApi';
import { useToast } from '../../components/Toast';
import Select from '../../components/Select';

// Swatch palette shown in the color popover (matches the ClickUp-style picker).
const PALETTE = ['#6647f0', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#d946ef', '#a16207', '#6b7280'];

let _seq = 0;
const uid = () => `st_${Date.now()}_${_seq++}`;
const withIds = (list) => list.map((s) => ({ ...s, _id: s._id || uid() }));

/**
 * ClickUp-style "Edit statuses" editor used inside the Create Space flow.
 * Add / edit / delete / reorder (drag & drop) / recolor statuses across the four
 * groups, pick a template, or save the current set as a reusable template.
 */
export default function StatusEditor({ open, onClose, initial, onApply, mode, onMode, title }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('custom');
  const [edited, setEdited] = useState(false);
  const [colorFor, setColorFor] = useState(null);
  const [dragId, setDragId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRows(withIds(initial?.length ? initial : DEFAULT_SPACE_STATUSES));
    setTemplateId('custom'); setEdited(false); setColorFor(null);
    projectsApi.statusTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, [open, initial]);

  if (!open) return null;

  const norm = (n) => (n || '').trim().toLowerCase();
  // Names that appear on more than one row (case-insensitive) — highlighted & block apply.
  const dupNames = (() => {
    const seen = new Set(); const dups = new Set();
    rows.forEach((r) => { const k = norm(r.name); if (!k) return; if (seen.has(k)) dups.add(k); else seen.add(k); });
    return dups;
  })();

  const mutate = (fn) => { setRows(fn); setEdited(true); };
  const setRow = (id, patch) => mutate((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const addStatus = (group) => mutate((rs) => {
    const existing = new Set(rs.map((r) => norm(r.name)));
    let name = 'NEW STATUS'; let i = 2;
    while (existing.has(norm(name))) { name = `NEW STATUS ${i}`; i += 1; }
    return [...rs, { _id: uid(), name, color: '#6b7280', group }];
  });
  const delStatus = (id) => mutate((rs) => rs.filter((r) => r._id !== id));

  const applyTemplate = (id) => {
    setTemplateId(id); setEdited(false);
    if (id === 'custom') return;
    const t = templates.find((x) => String(x.id) === String(id));
    if (t) setRows(withIds(t.statuses));
  };

  // Drag a row and drop before `targetId` (or at the end of `group`), changing its group.
  const drop = (targetId, group) => {
    if (!dragId) return;
    mutate((rs) => {
      const item = rs.find((r) => r._id === dragId);
      if (!item) return rs;
      const without = rs.filter((r) => r._id !== dragId);
      const moved = { ...item, group };
      if (targetId) {
        const to = without.findIndex((r) => r._id === targetId);
        without.splice(to < 0 ? without.length : to, 0, moved);
      } else {
        // append after the last row already in this group
        let idx = without.length;
        for (let i = without.length - 1; i >= 0; i -= 1) {
          if (without[i].group === group) { idx = i + 1; break; }
        }
        without.splice(idx, 0, moved);
      }
      return without;
    });
    setDragId(null);
  };

  const cleanRows = () => rows
    .filter((r) => (r.name || '').trim())
    .map(({ _id, ...r }) => ({ ...r, name: r.name.trim() }));

  const submit = () => {
    if (mode === 'inherit') { onApply([]); onClose(); return; }
    const clean = cleanRows();
    if (!clean.length) { toast.error('Add at least one status'); return; }
    // Status names must be unique (case-insensitive).
    const seen = new Set();
    for (const r of clean) {
      const k = r.name.toLowerCase();
      if (seen.has(k)) { toast.error(`Duplicate status name: “${r.name}”. Each status must have a unique name.`); return; }
      seen.add(k);
    }
    onApply(clean);
    onClose();
  };

  return (
    <div style={s.backdrop} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <button style={s.back} onClick={onClose} title="Back">‹</button>
          <strong style={{ fontSize: 17 }}>{title || 'Edit statuses'}</strong>
          <button style={s.close} onClick={onClose} title="Close">✕</button>
        </div>

        <div style={s.body}>
          <div style={s.left}>
            {mode !== undefined && (
              <>
                <div style={s.lbl}>Status type</div>
                <button type="button" style={s.radioRow} onClick={() => onMode('inherit')}>
                  <span style={{ ...s.radio, ...(mode === 'inherit' ? s.radioOn : {}) }}>{mode === 'inherit' && <span style={s.radioDot} />}</span>
                  Inherit from Space
                </button>
                <button type="button" style={s.radioRow} onClick={() => onMode('custom')}>
                  <span style={{ ...s.radio, ...(mode === 'custom' ? s.radioOn : {}) }}>{mode === 'custom' && <span style={s.radioDot} />}</span>
                  Use custom statuses
                </button>
                <div style={{ height: 16 }} />
              </>
            )}
            <div style={s.lbl}>Status template</div>
            <Select value={templateId} onChange={applyTemplate} disabled={mode === 'inherit'}
              options={[{ value: 'custom', label: `Custom${edited ? ' (edited)' : ''}` },
                ...templates.map((t) => ({ value: t.id, label: t.name }))]} />
          </div>

          <div style={s.right}>
            {mode === 'inherit' ? (
              <div style={s.inheritMsg}>
                This List inherits its statuses from the Space.<br />
                Switch to <strong>“Use custom statuses”</strong> to give this List its own workflow.
              </div>
            ) : STATUS_GROUPS.map((g) => (
              <div key={g.key} style={s.group}>
                <div style={s.groupHead}>
                  <span style={s.groupName}>{g.label}</span>
                  <button style={s.groupAdd} title="Add status" onClick={() => addStatus(g.key)}>+</button>
                </div>

                {rows.filter((r) => r.group === g.key).map((r) => (
                  <div key={r._id} style={{ ...s.row, ...(dupNames.has(norm(r.name)) ? s.rowDup : {}) }} draggable
                    onDragStart={() => setDragId(r._id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => drop(r._id, g.key)}>
                    <span style={s.handle} title="Drag to reorder">⠿</span>
                    <button style={{ ...s.swatch, background: r.color }}
                      title="Change color" onClick={() => setColorFor(colorFor === r._id ? null : r._id)} />
                    <input style={s.nameInput} value={r.name}
                      onChange={(e) => setRow(r._id, { name: e.target.value })} />
                    <button style={s.rowDel} title="Delete status" onClick={() => delStatus(r._id)}>✕</button>

                    {colorFor === r._id && (
                      <>
                        {/* full-screen catcher: clicking anywhere closes the picker */}
                        <div style={s.colorBackdrop} onMouseDown={() => setColorFor(null)} />
                        <div style={s.colorPop} onClick={(e) => e.stopPropagation()}>
                          <div style={s.colorGrid}>
                            {PALETTE.map((c) => (
                              <button key={c} title={c}
                                style={{ ...s.colorDot, background: c, outline: r.color === c ? '2px solid #111827' : 'none' }}
                                onClick={() => { setRow(r._id, { color: c }); setColorFor(null); }} />
                            ))}
                          </div>
                          <input style={s.hexInput} value={r.color}
                            onChange={(e) => setRow(r._id, { color: e.target.value })} placeholder="#hex" />
                          <button style={s.colorDone} onClick={() => setColorFor(null)}>Done</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <div style={s.addZone}
                  onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null, g.key)}
                  onClick={() => addStatus(g.key)}>+ Add status</div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.foot}>
          <button style={s.apply} onClick={submit}>Apply changes</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 90,
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '5vh 16px', overflowY: 'auto' },
  modal: { background: '#fff', borderRadius: 14, width: 760, maxWidth: '96vw', boxShadow: '0 24px 60px rgba(0,0,0,.3)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #f1f5f9' },
  back: { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#374151', lineHeight: 1 },
  close: { marginLeft: 'auto', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#6b7280' },
  body: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 360 },
  left: { borderRight: '1px solid #f1f5f9', padding: 20, width: 240, flexShrink: 0 },
  lbl: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  tmplSelect: { width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff' },
  radioRow: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 0', fontSize: 14, color: '#374151' },
  radio: { width: 18, height: 18, borderRadius: '50%', border: '2px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioOn: { borderColor: '#6647f0' },
  radioDot: { width: 9, height: 9, borderRadius: '50%', background: '#6647f0' },
  inheritMsg: { color: '#6b7280', fontSize: 14, lineHeight: 1.6, padding: '20px 4px', maxWidth: 360 },
  right: { padding: 20, maxHeight: '64vh', overflowY: 'auto', flex: 1 },
  group: { marginBottom: 18 },
  groupHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  groupName: { fontSize: 13, color: '#6b7280', fontWeight: 600 },
  groupAdd: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280', lineHeight: 1 },
  row: { position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, background: '#fff' },
  rowDup: { borderColor: '#ef4444', background: '#fef2f2' },
  handle: { color: '#9ca3af', cursor: 'grab', fontSize: 14, flexShrink: 0 },
  swatch: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #d1d5db', cursor: 'pointer', flexShrink: 0 },
  nameInput: { flex: 1, border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', background: 'transparent' },
  rowDel: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, flexShrink: 0 },
  addZone: { padding: '9px 12px', border: '1px dashed #d1d5db', borderRadius: 8, color: '#6b7280',
    fontSize: 14, cursor: 'pointer', textAlign: 'center' },
  colorBackdrop: { position: 'fixed', inset: 0, zIndex: 50 },
  colorPop: { position: 'absolute', top: 'calc(100% + 4px)', left: 30, zIndex: 51, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.2)', padding: 10, width: 200 },
  colorGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 8 },
  colorDot: { width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer' },
  hexInput: { width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 },
  colorDone: { width: '100%', marginTop: 8, padding: '7px 10px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  foot: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #f1f5f9' },
  tmplBtn: { padding: '9px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  apply: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
};
