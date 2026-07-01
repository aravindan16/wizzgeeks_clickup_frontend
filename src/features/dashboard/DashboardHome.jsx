import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { loadLegacyDashboards, clearLegacyDashboards } from './dashboardStore';
import { dashboardsApi } from './dashboardsApi';
import AddCardModal from './AddCardModal';
import DashboardCard from './DashboardCard';
import { IconPlus, IconEdit, IconTrash, Chevron } from '../../components/icons';

/**
 * ClickUp-style dashboards:
 *   - list view  → all of the user's dashboards; click one to open it
 *   - detail view → the cards (Portfolio, …) that live inside one dashboard
 * Everything persists per user in localStorage.
 */
export default function DashboardHome() {
  const { user } = useAuth();
  const uid = user?._id || user?.id;
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const { id: openId } = useParams(); // /dashboard/:id — the open dashboard, if any
  const [dashboards, setDashboards] = useState(null); // null = loading

  // Load from the DB; migrate any old localStorage dashboards on first run.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let { items } = await dashboardsApi.list();
        if (items.length === 0) {
          const legacy = loadLegacyDashboards(uid);
          if (legacy.length) {
            for (const d of legacy) {
              await dashboardsApi.create({ name: d.name || 'Dashboard', cards: d.cards || [] }).catch(() => {});
            }
            clearLegacyDashboards(uid);
            items = (await dashboardsApi.list()).items;
          }
        }
        if (alive) setDashboards(items);
      } catch {
        if (alive) setDashboards([]);
      }
    })();
    return () => { alive = false; };
  }, [uid]);

  const createDashboard = async () => {
    try {
      const d = await dashboardsApi.create({ name: 'Dashboard', cards: [] });
      setDashboards((cur) => [...(cur || []), d]);
      navigate(`/dashboard/${d.id}`); // jump straight into the new (empty) dashboard
    } catch { toast.error('Could not create dashboard'); }
  };

  // Optimistic local update + background save (rename, card add/remove/edit).
  const updateDashboard = (d) => {
    setDashboards((cur) => (cur || []).map((x) => (x.id === d.id ? d : x)));
    dashboardsApi.update(d.id, { name: d.name, cards: d.cards }).catch(() => toast.error('Could not save changes'));
  };

  const removeDashboard = async (d) => {
    if (!(await confirm({ title: 'Delete dashboard', message: `Delete "${d.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    setDashboards((cur) => (cur || []).filter((x) => x.id !== d.id));
    try { await dashboardsApi.remove(d.id); toast.success(`Dashboard "${d.name}" deleted`); }
    catch { toast.error('Could not delete dashboard'); }
  };

  if (dashboards === null) return <div style={{ padding: 24, color: 'var(--c-muted)' }}>Loading…</div>;

  const openDash = openId ? dashboards.find((d) => d.id === openId) : null;
  if (openId && openDash) {
    return (
      <DashboardDetail
        dashboard={openDash}
        onBack={() => navigate('/dashboard')}
        onChange={updateDashboard}
      />
    );
  }
  // Unknown id in the URL → fall back to the list.

  return (
    <DashboardList
      dashboards={dashboards}
      onOpen={(id) => navigate(`/dashboard/${id}`)}
      onCreate={createDashboard}
      onRename={updateDashboard}
      onDelete={removeDashboard}
    />
  );
}

/* ---------------------------------------------------------------- list view */
function DashboardList({ dashboards, onOpen, onCreate, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(null); // dashboard id
  const [draft, setDraft] = useState('');

  const startRename = (d) => { setRenaming(d.id); setDraft(d.name); };
  const commitRename = (d) => {
    const name = (draft || '').trim() || 'Dashboard';
    onRename({ ...d, name });
    setRenaming(null);
  };

  return (
    <div style={s.wrap}>
      <div style={s.headRow}>
        <h2 style={s.title}>Dashboards</h2>
        {dashboards.length > 0 && (
          <button style={s.addBtn} onClick={onCreate}><IconPlus size={16} /> New Dashboard</button>
        )}
      </div>

      {dashboards.length === 0 ? (
        <div style={s.emptyGrid}>
          <button style={s.scratch} onClick={onCreate}>
            <span style={s.scratchIcon}><IconPlus size={26} /></span>
            <span style={s.scratchTitle}>Start from scratch</span>
            <span style={s.scratchDesc}>Create a dashboard, then add cards to it.</span>
          </button>
        </div>
      ) : (
        <div style={s.listCard}>
          <div style={s.listHead}>
            <span style={s.colName}>Name</span>
            <span style={s.colMeta}>Cards</span>
            <span style={s.colActions} />
          </div>
          {dashboards.map((d) => (
            <div key={d.id} style={s.listRow}>
              {renaming === d.id ? (
                <input style={s.renameInput} value={draft} autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(d)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(d); if (e.key === 'Escape') setRenaming(null); }} />
              ) : (
                <button style={s.nameBtn} onClick={() => onOpen(d.id)} title="Open dashboard">
                  <span style={s.dashIcon}>{(d.name || 'D').charAt(0).toUpperCase()}</span>
                  <span style={s.dashName}>{d.name}</span>
                </button>
              )}
              <span style={s.colMeta}>{(d.cards || []).length}</span>
              <span style={s.colActions}>
                <button className="icon-btn" style={s.iconBtn} title="Rename" onClick={() => startRename(d)}><IconEdit size={15} /></button>
                <button className="icon-btn" style={s.iconBtn} title="Delete" onClick={() => onDelete(d)}><IconTrash size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- detail view */
function DashboardDetail({ dashboard, onBack, onChange }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // card being edited
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(dashboard.name);

  const cards = dashboard.cards || [];
  const setCards = (next) => onChange({ ...dashboard, cards: next });

  const saveCard = (card) => {
    setCards(cards.some((c) => c.id === card.id) ? cards.map((c) => (c.id === card.id ? card : c)) : [...cards, card]);
    setAdding(false); setEditing(null);
  };
  const removeCard = (id) => setCards(cards.filter((c) => c.id !== id));

  const commitName = () => {
    const v = (name || '').trim() || 'Dashboard';
    setName(v); onChange({ ...dashboard, name: v }); setEditingName(false);
  };

  return (
    <div style={s.wrap}>
      <div style={s.crumbs}>
        <button style={s.crumbLink} onClick={onBack}>Dashboards</button>
        <span style={s.crumbSep}><Chevron open={false} size={12} /></span>
        {editingName ? (
          <input style={s.crumbInput} value={name} autoFocus
            onChange={(e) => setName(e.target.value)} onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(dashboard.name); setEditingName(false); } }} />
        ) : (
          <span style={s.crumbCurrentWrap}>
            <span style={s.crumbCurrent}>{dashboard.name}</span>
            <button className="icon-btn" style={s.iconBtn} title="Rename dashboard" onClick={() => setEditingName(true)}><IconEdit size={14} /></button>
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button style={s.addBtn} onClick={() => setAdding(true)}><IconPlus size={16} /> Add card</button>
      </div>

      {cards.length === 0 ? (
        <div style={s.emptyGrid}>
          <button style={s.scratch} onClick={() => setAdding(true)}>
            <span style={s.scratchIcon}><IconPlus size={26} /></span>
            <span style={s.scratchTitle}>Add a card</span>
            <span style={s.scratchDesc}>Portfolio — more card types coming soon.</span>
          </button>
        </div>
      ) : (
        <div style={s.cards}>
          {cards.map((c) => (
            <DashboardCard key={c.id} card={c} onRemove={() => removeCard(c.id)} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}

      <AddCardModal open={adding || !!editing} editCard={editing}
        onClose={() => { setAdding(false); setEditing(null); }} onAdd={saveCard} />
    </div>
  );
}

const s = {
  wrap: { padding: '4px 0' },
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { margin: 0, color: 'var(--c-text-strong)' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--c-primary)',
    color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },

  // list view
  listCard: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', overflow: 'hidden' },
  listHead: { display: 'flex', alignItems: 'center', padding: '10px 16px', background: 'var(--c-surface-2)',
    fontSize: 12, fontWeight: 600, color: 'var(--c-muted)' },
  listRow: { display: 'flex', alignItems: 'center', padding: '6px 16px', borderTop: '1px solid var(--c-border-2)' },
  colName: { flex: 1 },
  colMeta: { width: 80, textAlign: 'center', color: 'var(--c-muted)', fontSize: 14 },
  colActions: { width: 80, display: 'inline-flex', justifyContent: 'flex-end', gap: 4 },
  nameBtn: { flex: 1, display: 'inline-flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
    cursor: 'pointer', padding: '8px 0', textAlign: 'left', color: 'var(--c-text-strong)' },
  dashIcon: { width: 26, height: 26, borderRadius: 7, background: 'var(--c-primary-weak)', color: 'var(--c-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  dashName: { fontWeight: 600, fontSize: 14.5 },
  renameInput: { flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--c-border)',
    background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600 },
  iconBtn: { border: 'none', color: 'var(--c-faint)', cursor: 'pointer', display: 'inline-flex', padding: 5, borderRadius: 6 },

  // detail view
  crumbs: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 18, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', display: 'inline-flex' },
  crumbCurrentWrap: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 18, fontWeight: 700 },
  crumbInput: { fontSize: 18, fontWeight: 700, color: 'var(--c-text-strong)', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '4px 10px', minWidth: 220 },

  // shared empty state
  emptyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 320px))', gap: 16 },
  scratch: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, minHeight: 200,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 24, cursor: 'pointer', boxShadow: 'var(--sh-xs)' },
  scratchIcon: { width: 48, height: 48, borderRadius: '50%', background: 'var(--c-surface-3)', color: 'var(--c-muted)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  scratchTitle: { fontWeight: 700, fontSize: 17, color: 'var(--c-text-strong)' },
  scratchDesc: { fontSize: 13, color: 'var(--c-muted)', textAlign: 'left' },
  cards: { display: 'flex', flexDirection: 'column', gap: 16 },
};
