import { useMemo, useState } from 'react';
import { IconSearch } from '../../components/icons';
import TaskTypeIcon from '../../components/TaskTypeIcon';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const TYPES = [
  { value: 'task', label: 'Task', icon: '☑️' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
];

const CATS = [
  { key: 'assignee', label: 'Assignee' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Work type' },
  { key: 'label', label: 'Labels' },
];

const EMPTY = { assignee: [], status: [], type: [], label: [] };

export function emptyFilters() { return { assignee: [], status: [], type: [], label: [] }; }
export function countFilters(v) { return CATS.reduce((n, c) => n + ((v?.[c.key]?.length) || 0), 0); }

/**
 * Jira-style two-pane filter popover. Left = category list, right = options with
 * checkboxes + search. Multiple values within a category are OR'd; categories AND.
 */
export default function BoardFilter({ members, tasks, statuses = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('assignee');
  const [q, setQ] = useState('');

  const v = value || EMPTY;
  const active = countFilters(v);

  const labels = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.labels || []))].sort(),
    [tasks],
  );

  const optionsFor = (key) => {
    switch (key) {
      case 'assignee':
        return [{ value: 'unassigned', label: 'Unassigned', avatar: null },
          ...members.map((m) => ({ value: m.user_id, label: m.full_name || m.email, avatar: m.full_name }))];
      case 'status':
        return statuses.map((st) => ({ value: st.key, label: st.name, color: st.color }));
      case 'type':
        return TYPES.map((t) => ({ value: t.value, label: t.label, icon: <TaskTypeIcon type={t.value} size={14} /> }));
      case 'label':
        return labels.map((l) => ({ value: l, label: l }));
      default:
        return [];
    }
  };

  const all = optionsFor(cat);
  const shown = q ? all.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : all;

  const toggle = (key, val) => {
    const cur = v[key] || [];
    const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    onChange({ ...v, [key]: next });
  };
  const clearCat = () => onChange({ ...v, [cat]: [] });
  const clearAll = () => onChange(emptyFilters());

  return (
    <div style={{ position: 'relative' }}>
      <button style={{ ...st.btn, ...(open || active ? st.btnActive : {}) }} onClick={() => setOpen((o) => !o)}>
        <span>≡ Filter</span>
        {active > 0 && <span style={st.badge}>{active}</span>}
      </button>

      {open && (
        <>
          <div style={st.backdrop} onClick={() => setOpen(false)} />
          <div style={st.pop}>
            <div style={st.body}>
              {/* left: categories */}
              <div style={st.left}>
                {CATS.map((c) => {
                  const n = (v[c.key] || []).length;
                  const isOn = cat === c.key;
                  return (
                    <button key={c.key} style={{ ...st.catRow, ...(isOn ? st.catRowActive : {}) }}
                      onClick={() => { setCat(c.key); setQ(''); }}>
                      <span>{c.label}</span>
                      {n > 0 && <span style={st.catCount}>{n}</span>}
                    </button>
                  );
                })}
              </div>

              {/* right: options */}
              <div style={st.right}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <span style={st.searchIcon}><IconSearch size={15} /></span>
                  <input style={st.search} placeholder={`Search ${CATS.find((c) => c.key === cat)?.label.toLowerCase()}`}
                    value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </div>
                <div style={st.optList}>
                  {shown.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13, padding: 8 }}>No options</div>}
                  {shown.map((o) => {
                    const checked = (v[cat] || []).includes(o.value);
                    return (
                      <label key={o.value} style={{ ...st.opt, ...(checked ? st.optChecked : {}) }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(cat, o.value)} style={st.cb} />
                        {cat === 'assignee' && (o.avatar
                          ? <span style={st.avatar}>{initials(o.avatar)}</span>
                          : <span style={st.avatarEmpty}>👤</span>)}
                        {o.icon && <span style={{ display: 'inline-flex', alignItems: 'center', color: '#6b7280' }}>{o.icon}</span>}
                        {cat === 'status' && (
                          <span style={{ ...st.statusChip, ...(o.color ? { background: `${o.color}22`, color: o.color } : {}) }}>
                            {o.label.toUpperCase()}
                          </span>
                        )}
                        {cat !== 'status' && <span style={{ flex: 1 }}>{o.label}</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={st.footRow}>
              <button style={st.footLink} onClick={clearAll} disabled={active === 0}>Clear all</button>
              <button style={{ ...st.footLink, marginLeft: 'auto' }} onClick={clearCat} disabled={(v[cat] || []).length === 0}>Clear</button>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{shown.length} of {all.length}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const st = {
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151', whiteSpace: 'nowrap' },
  btnActive: { borderColor: '#111827', color: '#111827', background: '#f3f4f6' },
  badge: { background: '#dbeafe', color: '#000000', borderRadius: 6, padding: '0 6px', fontSize: 12, fontWeight: 700 },
  backdrop: { position: 'fixed', inset: 0, zIndex: 60 },
  pop: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 61, width: 560, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.18)', overflow: 'hidden' },
  body: { display: 'grid', gridTemplateColumns: '180px 1fr', minHeight: 240 },
  left: { borderRight: '1px solid #f1f5f9', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 },
  catRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
    padding: '8px 10px', border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#374151' },
  catRowActive: { background: '#f3f4f6', color: '#111827', fontWeight: 600 },
  catCount: { background: '#dbeafe', color: '#000000', borderRadius: 6, padding: '0 6px', fontSize: 12, fontWeight: 700 },
  right: { padding: 12 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  search: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 30px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  optList: { maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 },
  opt: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  optChecked: { background: '#f3f4f6' },
  cb: { width: 16, height: 16, cursor: 'pointer' },
  avatar: { width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  avatarEmpty: { width: 22, height: 22, borderRadius: '50%', background: '#e5e7eb', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11 },
  statusChip: { flex: 1, fontSize: 11, fontWeight: 700, color: '#3730a3', background: '#e0e7ff', borderRadius: 4,
    padding: '2px 6px', width: 'fit-content', display: 'inline-block' },
  footRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderTop: '1px solid #f1f5f9' },
  footLink: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontSize: 13, padding: 0 },
};
