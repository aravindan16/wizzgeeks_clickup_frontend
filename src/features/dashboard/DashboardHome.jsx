import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import ResizableTable from '../../components/ResizableTable';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useAuth } from '../auth/useAuth';
import { useConfirm, usePrompt } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { loadLegacyDashboards, clearLegacyDashboards } from './dashboardStore';
import { dashboardsApi } from './dashboardsApi';
import { beginSilent, endSilent } from '../../services/apiClient';
import AddCardModal from './AddCardModal';
import DashboardCard from './DashboardCard';
import DashboardShareModal from './DashboardShareModal';
import { clearDashboardCache } from './useCardData';
import { IconPlus, IconEdit, IconTrash, IconMembers, IconBoard, IconGrip, Chevron } from '../../components/icons';

const Grid = WidthProvider(GridLayout);
// Default grid placement for a card with no saved layout yet (2-up, half width).
const defaultLayout = (card, i) => ({ x: (i % 2) * 6, y: Math.floor(i / 2) * 9, w: 6, h: 9 });

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
  const promptDialog = usePrompt();
  const toast = useToast();
  const navigate = useNavigate();
  const { id: openId } = useParams(); // /dashboard/:id — the open dashboard, if any
  const [dashboards, setDashboards] = useState(null); // null = loading
  const creatingRef = useRef(false);

  // Drop the shared card-data cache when leaving the dashboards area so the next
  // visit is fresh; within a visit the cache dedupes every card's fetches.
  useEffect(() => () => clearDashboardCache(), []);

  // Load from the DB; migrate any old localStorage dashboards on first run.
  useEffect(() => {
    let alive = true;
    const load = async () => {
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
    };
    load();
    // Stay in sync with the sidebar (create from there) and other tabs.
    const onChange = () => load();
    window.addEventListener('wg-dashboards-changed', onChange);
    return () => { alive = false; window.removeEventListener('wg-dashboards-changed', onChange); };
  }, [uid]);

  const notifyChanged = () => window.dispatchEvent(new Event('wg-dashboards-changed'));

  const createDashboard = async () => {
    const name = await promptDialog({
      title: 'Create dashboard', message: 'Give your dashboard a name.', placeholder: 'Dashboard name', confirmLabel: 'Create',
      // Inline validation — keeps the modal open and shows the error above Create.
      validate: (v) => ((dashboards || []).some((x) => (x.name || '').trim().toLowerCase() === v.toLowerCase())
        ? 'A dashboard with this name already exists' : ''),
    });
    if (!name || !name.trim()) return;
    if (creatingRef.current) return; // guard: never create twice for one action
    creatingRef.current = true;
    try {
      const d = await dashboardsApi.create({ name: name.trim(), cards: [] });
      setDashboards((cur) => [...(cur || []), d]);
      notifyChanged();
      toast.success(`Dashboard "${d.name}" created`);
      navigate(`/dashboard/${d.id}`); // route into the newly-created dashboard
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Could not create dashboard'); }
    finally { creatingRef.current = false; }
  };

  // Optimistic local update + background save (rename, card add/remove/edit).
  // opts.silent → drag/resize layout saves: no global loader, no sidebar refetch.
  const updateDashboard = (d, opts = {}) => {
    // Renaming to a name another dashboard already uses → instant message, no API/loader.
    const server = (dashboards || []).find((x) => x.id === d.id);
    if (server && d.name !== server.name
      && (dashboards || []).some((x) => x.id !== d.id && (x.name || '').trim().toLowerCase() === (d.name || '').trim().toLowerCase())) {
      toast.error('A dashboard with this name already exists');
      return;
    }
    setDashboards((cur) => (cur || []).map((x) => (x.id === d.id ? d : x)));
    if (opts.silent) {
      beginSilent();
      dashboardsApi.update(d.id, { name: d.name, cards: d.cards }).catch(() => {}).finally(endSilent);
    } else {
      dashboardsApi.update(d.id, { name: d.name, cards: d.cards })
        .then(notifyChanged)
        .catch((err) => { toast.error(err.response?.data?.error?.message || 'Could not save changes'); notifyChanged(); });
    }
  };

  const removeDashboard = async (d) => {
    if (!(await confirm({ title: 'Delete dashboard', message: `Delete "${d.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    setDashboards((cur) => (cur || []).filter((x) => x.id !== d.id));
    try { await dashboardsApi.remove(d.id); notifyChanged(); toast.success(`Dashboard "${d.name}" deleted`); }
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
        isNameTaken={(n) => (dashboards || []).some((x) => x.id !== openDash.id && (x.name || '').trim().toLowerCase() === n.trim().toLowerCase())}
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
  const slotEl = useHeaderSlot();
  const [renaming, setRenaming] = useState(null); // dashboard id
  const [draft, setDraft] = useState('');

  const startRename = (d) => { setRenaming(d.id); setDraft(d.name); };
  const commitRename = (d) => {
    const name = (draft || '').trim() || 'Dashboard';
    // Only hit the API when the name actually changed.
    if (name !== (d.name || '')) onRename({ ...d, name });
    setRenaming(null);
  };

  return (
    <div style={s.wrap}>
      {slotEl && createPortal(
        <>
          <span style={s.headerTitle}>Dashboards</span>
          <button style={{ ...s.addBtn, marginLeft: 'auto' }} onClick={onCreate}><IconPlus size={15} /> Dashboard</button>
        </>,
        slotEl,
      )}

      <div style={s.listCard}>
        <div style={s.listHead}>
          <span style={s.colName}>Name</span>
          <span style={s.colMeta}>Cards</span>
          <span style={s.colActions} />
        </div>
        {dashboards.map((d) => (
            <div key={d.id} className="wg-row-hover" style={s.listRow}>
              {renaming === d.id ? (
                <input style={s.renameInput} value={draft} autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(d)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(d); if (e.key === 'Escape') setRenaming(null); }} />
              ) : (
                <button style={s.nameBtn} onClick={() => onOpen(d.id)}>
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
          <div className="wg-row-hover" style={s.newRow} onClick={onCreate} role="button" tabIndex={0}>
            <span style={s.newRowIcon}><IconPlus size={15} /></span> New dashboard
          </div>
        </div>
    </div>
  );
}

/* -------------------------------------------------------------- detail view */
function DashboardDetail({ dashboard, onBack, onChange, isNameTaken }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { can } = useAuth();
  const canAddMembers = can('dashboard.member.add');
  const slotEl = useHeaderSlot();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // card open in the modal
  const [editSidebar, setEditSidebar] = useState(true); // modal opens with the filter panel shown?
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(dashboard.name);
  const [tab, setTab] = useState('view'); // view | members
  const [mShare, setMShare] = useState(false); // members "Add people" modal
  const [mReload, setMReload] = useState(0);   // bump to refresh the members table
  const [searchParams, setSearchParams] = useSearchParams();

  // Sidebar actions navigate here with ?add=1 → open the add-card modal; ?share=1 → Members tab.
  useEffect(() => {
    const add = searchParams.get('add') === '1';
    const share = searchParams.get('share') === '1';
    if (!add && !share) return;
    if (add) setAdding(true);
    if (share) setTab('members');
    const next = new URLSearchParams(searchParams);
    next.delete('add'); next.delete('share');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const cards = dashboard.cards || [];
  const setCards = (next) => onChange({ ...dashboard, cards: next });

  // Grid layout: derive from each card's saved x/y/w/h (or a default), and
  // write positions/sizes back onto the cards when the user drags/resizes.
  const layout = cards.map((c, i) => {
    const d = defaultLayout(c, i);
    return { i: c.id, x: c.x ?? d.x, y: c.y ?? d.y, w: c.w ?? d.w, h: c.h ?? d.h, minW: 3, minH: 4 };
  });
  // After a resize, apply the new size and immediately re-flow the whole board so
  // an enlarged card that no longer fits its row wraps to the next row right away
  // — no overlap, and no need for a second drag/click to tidy it up.
  const onResizeStopPack = (nextLayout) => {
    const byId = Object.fromEntries(nextLayout.map((l) => [l.i, l]));
    const sized = cards.map((c) => {
      const l = byId[c.id];
      return l ? { ...c, w: l.w, h: l.h } : c;
    });
    const next = packRows(sized);
    // Silent save — no page loader / no refetch when you resize a card.
    if (JSON.stringify(next) !== JSON.stringify(cards)) onChange({ ...dashboard, cards: next }, { silent: true });
  };

  // Pack an ordered list of cards left-to-right into rows using each card's OWN
  // width (like ClickUp) — narrow cards sit 2–3 per row, and cards never overlap.
  // Every card keeps its own size; only x/y are (re)assigned from the order.
  const packRows = (list) => {
    let cx = 0, cy = 0, rowH = 0;
    return list.map((c, i) => {
      const w = Math.min(c.w ?? defaultLayout(c, i).w, 12);
      const h = c.h ?? defaultLayout(c, i).h;
      if (cx + w > 12) { cx = 0; cy += rowH; rowH = 0; }
      const placed = { ...c, x: cx, y: cy, w, h };
      cx += w; rowH = Math.max(rowH, h);
      return placed;
    });
  };

  // Drop a card ONTO another → the two swap ORDER (each keeps its own size), then
  // the board re-flows so cards sit side-by-side with no overlap and no resizing.
  // Drop into empty space → the card just moves there.
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const onDragStopSwap = (nextLayout, oldItem, newItem) => {
    const draggedId = newItem.i;
    const target = layout.find((l) => l.i !== draggedId && overlaps(newItem, l));
    let next;
    if (target) {
      const di = cards.findIndex((c) => c.id === draggedId);
      const ti = cards.findIndex((c) => c.id === target.i);
      const reordered = cards.slice();
      [reordered[di], reordered[ti]] = [reordered[ti], reordered[di]];
      next = packRows(reordered);
    } else {
      next = cards.map((c) => (c.id === draggedId ? { ...c, x: newItem.x, y: newItem.y } : c));
    }
    if (JSON.stringify(next) !== JSON.stringify(cards)) onChange({ ...dashboard, cards: next }, { silent: true });
  };

  // Pack cards left-to-right into rows using each card's width (like ClickUp),
  // so narrow cards sit 2–3 per row instead of stacking one per row.
  const autoArrange = () => {
    onChange({ ...dashboard, cards: packRows(cards) }, { silent: true });
  };

  const saveCard = (card) => {
    if (cards.some((c) => c.id === card.id)) {
      setCards(cards.map((c) => (c.id === card.id ? card : c)));
    } else {
      // Place a brand-new card just below the LOWEST existing card (its real y+h),
      // so it never lands in a fixed index-based slot far below the resized layout.
      const bottom = cards.reduce((m, c, i) => {
        const d = defaultLayout(c, i);
        return Math.max(m, (c.y ?? d.y) + (c.h ?? d.h));
      }, 0);
      setCards([...cards, { ...card, x: 0, y: bottom, w: card.w ?? 6, h: card.h ?? 9 }]);
    }
    setAdding(false); setEditing(null);
  };
  const removeCard = async (id) => {
    const card = cards.find((c) => c.id === id);
    if (!(await confirm({ title: 'Delete card', message: `Delete "${card?.title || 'this card'}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    setCards(cards.filter((c) => c.id !== id));
  };

  const commitName = () => {
    const v = (name || '').trim() || 'Dashboard';
    setEditingName(false);
    // Only save (hit the API / show the loader) when the name actually changed.
    if (v === dashboard.name) { setName(dashboard.name); return; }
    // Instant client-side duplicate check — no API call / loader.
    if (isNameTaken?.(v)) { toast.error('A dashboard with this name already exists'); setName(dashboard.name); return; }
    setName(v);
    onChange({ ...dashboard, name: v });
  };

  // Breadcrumb ("Dashboards › <name>") lives in the shared topbar via a portal.
  const breadcrumb = (
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
    </div>
  );

  return (
    <div style={{ ...s.wrap, ...(tab === 'members' ? s.wrapFill : {}) }}>
      {slotEl && createPortal(breadcrumb, slotEl)}

      {/* Tabs (View · Members) with the primary action in the right corner. */}
      <div style={{ ...s.tabs, flexShrink: 0 }}>
        <div style={s.tabsLeft}>
          <button style={{ ...s.tab, ...(tab === 'view' ? s.tabActive : {}) }} onClick={() => setTab('view')}>
            <IconBoard size={15} /> View
          </button>
          <button style={{ ...s.tab, ...(tab === 'members' ? s.tabActive : {}) }} onClick={() => setTab('members')}>
            <IconMembers size={15} /> Members
          </button>
        </div>
        {tab === 'members'
          ? <button style={{ ...s.addBtn, ...(canAddMembers ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
              onClick={() => (canAddMembers ? setMShare(true) : toast.error("You don't have permission to add members"))}><IconPlus size={16} /> Add people</button>
          : <button style={s.addBtn} onClick={() => setAdding(true)}><IconPlus size={16} /> Add card</button>}
      </div>

      {tab === 'members' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DashboardMembers dashboardId={dashboard.id} reloadKey={mReload} />
        </div>
      ) : cards.length === 0 ? (
        <div style={s.emptyState}>No cards yet — use “+ Add card” to create one.</div>
      ) : (
        <Grid
          className="wg-dash-grid"
          cols={12}
          rowHeight={40}
          margin={[16, 16]}
          layout={layout}
          draggableHandle=".wg-card-head"
          compactType={null}
          allowOverlap
          resizeHandles={['s', 'e', 'w', 'se', 'sw']}
          onDragStop={onDragStopSwap}
          onResizeStop={onResizeStopPack}
        >
          {cards.map((c) => (
            <div key={c.id}>
              <DashboardCard card={c} fill
                onRemove={() => removeCard(c.id)}
                onEdit={() => { setEditSidebar(true); setEditing(c); }}
                onExpand={() => { setEditSidebar(false); setEditing(c); }} />
            </div>
          ))}
        </Grid>
      )}

      <AddCardModal open={adding || !!editing} editCard={editing}
        startWithSidebar={editing ? editSidebar : true}
        onDelete={() => { const id = editing?.id; setEditing(null); if (id) removeCard(id); }}
        onClose={() => { setAdding(false); setEditing(null); }} onAdd={saveCard} />
      <DashboardShareModal open={mShare} dashboardId={dashboard.id}
        onChanged={() => setMReload((x) => x + 1)}
        onClose={() => { setMShare(false); setMReload((x) => x + 1); }} />
    </div>
  );
}

/* ------------------------------------------------------- Members tab (table) */
function DashboardMembers({ dashboardId, reloadKey }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const canRemove = can('dashboard.member.remove');
  const [members, setMembers] = useState([]);

  const load = () => dashboardsApi.members(dashboardId).then((r) => setMembers(r.items || [])).catch(() => setMembers([]));
  useEffect(() => { load(); }, [dashboardId, reloadKey]);

  const remove = async (m) => {
    if (m.is_owner) return;
    if (!(await confirm({ title: 'Remove member', message: `Remove ${m.full_name || m.email}?`, confirmLabel: 'Remove', danger: true }))) return;
    try { await dashboardsApi.removeMember(dashboardId, m.user_id); load(); }
    catch { toast.error('Could not remove member'); }
  };

  return (
    <ResizableTable persistKey="wg_dash_members_cols" rowKey={(m) => m.user_id} rows={members} emptyText="No members yet." fillHeight
      columns={[
        { key: 'name', label: 'Name', width: 320, min: 140, render: (m) => <span style={s.mName}>{m.full_name || '—'}</span> },
        { key: 'email', label: 'Email', width: 320, min: 140, render: (m) => <span style={s.mEmail}>{m.email}</span> },
        { key: 'actions', label: 'Actions', width: 120, min: 90, align: 'right',
          render: (m) => (m.is_owner
            ? <span style={s.ownerTag}>Owner</span>
            : (canRemove
                ? <button className="wg-danger-link" style={s.removeLink} onClick={() => remove(m)}>Remove</button>
                : <span style={s.mEmail}>—</span>)) },
      ]} />
  );
}

const s = {
  wrap: { padding: 0, marginTop: -10 },
  // Members tab only: fill the page height so the table's pager pins to the bottom.
  // +34 = 24px (main's bottom padding) + 10px (wrap's own marginTop:-10 offset).
  wrapFill: { height: 'calc(100% + 34px)', marginBottom: -24, display: 'flex', flexDirection: 'column' },
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  newRow: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    padding: '11px 16px', borderTop: '1px solid var(--c-border-2)',
    cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--c-muted)' },
  newRowIcon: { width: 26, height: 26, borderRadius: 7, background: 'var(--c-surface-2)', color: 'var(--c-muted)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, color: 'var(--c-text-strong)' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--c-primary)',
    color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  shareBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--c-surface)',
    color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },

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
  crumbs: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 20 },

  // tabs (View / Members) — tabs on the left, primary action in the right corner
  tabs: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    borderBottom: '1px solid var(--c-border)', marginBottom: 16 },
  tabsLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  tab: { display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer',
    padding: '10px 6px', margin: '0 6px', fontSize: 14, fontWeight: 600, color: 'var(--c-muted)',
    borderBottom: '2px solid transparent', marginBottom: -1 },
  tabActive: { color: 'var(--c-text-strong)', borderBottom: '2px solid var(--c-text-strong)' },
  mCard: { border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--c-surface)' },
  mTable: { width: '100%', borderCollapse: 'collapse' },
  mTh: { textAlign: 'left', padding: '11px 18px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em',
    color: 'var(--c-muted)', background: 'var(--c-surface-2)' },
  mRow: { borderTop: '1px solid var(--c-border-2)' },
  mTd: { padding: '13px 18px', fontSize: 14, color: 'var(--c-text)' },
  mName: { color: 'var(--c-text-strong)', fontWeight: 600 },
  mEmail: { color: 'var(--c-muted)' },
  mEmpty: { padding: 24, textAlign: 'center', color: 'var(--c-muted)' },
  removeLink: { border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    padding: '5px 12px', borderRadius: 8 },
  ownerTag: { fontSize: 11.5, fontWeight: 700, color: 'var(--c-muted)', background: 'var(--c-surface-3)', borderRadius: 999, padding: '3px 12px' },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', display: 'inline-flex' },
  crumbCurrentWrap: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 15, fontWeight: 700 },
  crumbInput: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '4px 10px', minWidth: 200 },

  // shared empty state
  emptyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 320px))', gap: 16 },
  emptyState: { padding: '40px 4px', color: 'var(--c-muted)', fontSize: 14 },
  scratch: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, minHeight: 200,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 24, cursor: 'pointer', boxShadow: 'var(--sh-xs)' },
  scratchIcon: { width: 48, height: 48, borderRadius: '50%', background: 'var(--c-surface-3)', color: 'var(--c-muted)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  scratchTitle: { fontWeight: 700, fontSize: 17, color: 'var(--c-text-strong)' },
  scratchDesc: { fontSize: 13, color: 'var(--c-muted)', textAlign: 'left' },
  cards: { display: 'flex', flexDirection: 'column', gap: 16 },
};
