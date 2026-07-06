import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { savedFiltersApi } from './savedFiltersApi';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { IconFilter, IconPlus, IconTrash, IconMembers } from '../../components/icons';
import FilterShareModal from './FilterShareModal';

/**
 * Filters landing page (route `/filters`): lists the user's saved filters.
 * Clicking one opens it at `/filters/:id`; "New filter" opens a fresh builder.
 */
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export default function FiltersIndex() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [shareId, setShareId] = useState(null);

  const load = () => savedFiltersApi.list().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
    try { localStorage.setItem('wg_active_filter', ''); } catch { /* ignore */ }
    window.dispatchEvent(new Event('wg-active-filter-changed'));
    const onChange = () => load();
    window.addEventListener('wg-saved-filters-changed', onChange);
    return () => window.removeEventListener('wg-saved-filters-changed', onChange);
  }, []);

  const del = async (e, sf) => {
    e.stopPropagation();
    if (!(await confirm({ title: 'Delete filter', message: `Delete "${sf.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await savedFiltersApi.remove(sf.id); toast.success('Filter deleted'); } catch { toast.error('Could not delete filter'); }
    window.dispatchEvent(new Event('wg-saved-filters-changed'));
    load();
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.title}><span style={s.titleIcon}><IconFilter size={20} /></span>Filters</h2>
        <button style={s.primary} onClick={() => navigate('/filters/new')}><IconPlus size={15} /> New filter</button>
      </div>

      <div className="wg-card" style={s.card}>
        {items === null && <div style={s.msg}>Loading…</div>}
        {items && items.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIcon}><IconFilter size={26} /></div>
            <div style={s.emptyTitle}>No saved filters yet</div>
            <div style={s.emptySub}>Create a filter to quickly find tasks across your Spaces.</div>
            <button style={{ ...s.primary, marginTop: 14 }} onClick={() => navigate('/filters/new')}><IconPlus size={15} /> New filter</button>
          </div>
        )}
        {items && items.length > 0 && (
          <table style={s.table}>
            <thead><tr><Th>Name</Th><Th w={170}>Created by</Th><Th w={140}>Created</Th><Th w={96} /></tr></thead>
            <tbody>
              {items.map((sf) => (
                <tr key={sf.id} className="wg-rel-row" style={s.row} onClick={() => navigate(`/filters/${sf.id}`)}>
                  <Td>
                    <span style={s.name}>
                      <span style={s.avatar}>{(sf.name || 'F').charAt(0).toUpperCase()}</span>
                      <span style={s.nameText}>{sf.name}</span>
                    </span>
                  </Td>
                  <Td><span style={s.muted}>{sf.owner_name || '—'}</span></Td>
                  <Td><span style={s.muted}>{fmtDate(sf.created_at)}</span></Td>
                  <Td>
                    <span style={s.rowActions}>
                      <button className="icon-btn" style={s.trash} title="Members" onClick={(e) => { e.stopPropagation(); setShareId(sf.id); }}><IconMembers size={16} /></button>
                      <button className="icon-btn" style={s.trash} title="Delete filter" onClick={(e) => del(e, sf)}><IconTrash size={16} /></button>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <FilterShareModal open={!!shareId} filterId={shareId} onClose={() => setShareId(null)} onChanged={load} />
    </div>
  );
}

const Th = ({ children, w }) => <th style={{ ...s.th, width: w }}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, color: 'var(--c-text-strong)' },
  titleIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  primary: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: 'var(--c-primary)',
    color: 'var(--c-on-primary)', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  card: { padding: 0, overflow: 'hidden' },
  msg: { padding: 28, textAlign: 'center', color: 'var(--c-muted)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '11px 18px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em',
    color: 'var(--c-muted)', background: 'var(--c-surface-2)' },
  td: { padding: '12px 18px', fontSize: 14, color: 'var(--c-text)', verticalAlign: 'middle' },
  row: { borderTop: '1px solid var(--c-border-2)', cursor: 'pointer' },
  name: { display: 'inline-flex', alignItems: 'center', gap: 11 },
  avatar: { width: 26, height: 26, borderRadius: 7, background: '#111827', color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  nameText: { color: 'var(--c-text-strong)', fontWeight: 600 },
  muted: { color: 'var(--c-muted)', fontSize: 13.5 },
  rowActions: { display: 'inline-flex', alignItems: 'center', gap: 2 },
  trash: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
    border: 'none', background: 'none', color: 'var(--c-muted)', cursor: 'pointer', borderRadius: 8 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '52px 20px' },
  emptyIcon: { width: 56, height: 56, borderRadius: 14, background: 'var(--c-surface-2)', color: 'var(--c-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  emptySub: { fontSize: 13.5, color: 'var(--c-muted)', marginTop: 4 },
};
