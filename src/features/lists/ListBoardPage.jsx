import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { listsApi } from './listsApi';
import { projectsApi } from '../projects/projectsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { useCardFields } from '../tasks/cardFieldsStore';
import CardFieldsMenu from '../tasks/CardFieldsMenu';
import { tasksApi, STATUS_LABELS, resolveStatuses } from '../tasks/tasksApi';
import KanbanBoard from '../tasks/KanbanBoard';
import TaskListView from '../tasks/TaskListView';
import TaskTableView from '../tasks/TaskTableView';
import ViewTabs from '../tasks/ViewTabs';
import { useViews } from '../tasks/useViews';
import TaskModal from '../tasks/TaskModal';
import TaskDetailModal from '../tasks/TaskDetailModal';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../../components/Toast';
import BoardFilter, { emptyFilters, countFilters } from '../tasks/BoardFilter';
import { IconSearch, IconEdit } from '../../components/icons';
import { SkeletonBoard } from '../../components/Skeleton';

const EMPTY_FILTERS = { assignee: [], status: [], type: [], priority: [], label: [] };

/**
 * A List inside a Space: shows only this List's tasks. Reuses the Board / List
 * views and the Space's status workflow + members. Tasks created here are scoped
 * to the List (list_id).
 */
export default function ListBoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const slotEl = useHeaderSlot();
  const { can } = useAuth();
  const toast = useToast();
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [list, setList] = useState(null);
  const [space, setSpace] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [taskQuery, setTaskQuery] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [cardCustomFields, setCardCustomFields] = useState([]); // List's custom fields (for the Customize-view menu + card chips)

  // Which fields show on each board card (Customize view) — persisted per List.
  const cf = useCardFields(id);

  // Views (List/Board/Table) — persisted per List in localStorage; filters per view.
  const vs = useViews(id);
  const { activeId, updateView, activeView } = vs;
  const activeFilters = activeView?.filters || EMPTY_FILTERS;

  // Inline rename of the List from the header breadcrumb (like the dashboard header).
  const startRename = () => { setNameDraft(list?.name || ''); setEditingName(true); };
  const commitName = async () => {
    const v = (nameDraft || '').trim();
    setEditingName(false);
    if (!v || v === list.name) return;
    setList((l) => ({ ...l, name: v }));
    try {
      await listsApi.update(list._id, { name: v });
      toast.success('List renamed');
      window.dispatchEvent(new Event('wg:list-updated'));
    } catch { toast.error('Could not rename list'); }
  };

  const loadTasks = useCallback(async (listId) => {
    const res = await tasksApi.list({ list_id: listId, limit: 200, sort_by: 'created_at', sort_dir: 1 });
    setTasks(res.items);
  }, []);

  const load = useCallback(async () => {
    try {
      // Tasks only need the list id (already in the URL), so fire that request
      // immediately — in parallel with the list/space/members chain — instead of
      // waiting for them. The board content (the heaviest call) no longer queues
      // behind list → space → members, removing the open-list delay.
      const tasksP = loadTasks(id);
      const l = await listsApi.get(id);
      setList(l);
      const [sp, ms] = await Promise.all([
        projectsApi.get(l.space_id),
        projectsApi.members(l.space_id).catch(() => []),
      ]);
      setSpace(sp); setMembers(ms);
      await tasksP;
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load list');
    }
  }, [id, loadTasks]);

  useEffect(() => { load(); }, [load]);

  // Load the List's custom fields for the Customize-view menu + card chips.
  useEffect(() => {
    if (!space?._id || !list?._id) return;
    customFieldsApi.list(space._id, list._id, undefined, { _silent: true })
      .then((fs) => setCardCustomFields((fs || []).filter((f) =>
        ['dropdown', 'text', 'relationship'].includes(f.type) && f.enabled !== false)))
      .catch(() => setCardCustomFields([]));
  }, [space?._id, list?._id]);

  // Reflect List changes (e.g. custom statuses edited from the sidebar) immediately.
  useEffect(() => {
    const onUpdate = (e) => { if (e.detail?.listId === id) load(); };
    window.addEventListener('wg:list-updated', onUpdate);
    return () => window.removeEventListener('wg:list-updated', onUpdate);
  }, [id, load]);


  if (error) return <div className="card" style={{ color: '#991b1b' }}>{error}</div>;
  if (!list || !space) return <div style={{ padding: '8px 0' }}><SkeletonBoard /></div>;

  // A List with custom statuses overrides the Space's workflow.
  const statusSource = (list.status_mode === 'custom' && list.statuses?.length) ? list : space;
  const statuses = resolveStatuses(statusSource);
  const nameOf = (uid) => members.find((m) => m.user_id === uid)?.full_name;
  const tq = taskQuery.trim().toLowerCase();
  const matchesSearch = (t) => !tq || [t.key, t.title, t.status, STATUS_LABELS[t.status], t.priority, t.type,
    nameOf(t.assignee_id)].filter(Boolean).join(' ').toLowerCase().includes(tq);
  const matchesFilters = (t) => {
    if (activeFilters.assignee.length && !activeFilters.assignee.includes(t.assignee_id || 'unassigned')) return false;
    if (activeFilters.status.length && !activeFilters.status.includes(t.status)) return false;
    if (activeFilters.type.length && !activeFilters.type.includes(t.type)) return false;
    if ((activeFilters.priority || []).length && !activeFilters.priority.includes(t.priority)) return false;
    if ((activeFilters.label || []).length && !(t.labels || []).some((l) => activeFilters.label.includes(l))) return false;
    return true;
  };
  const visibleTasks = tasks.filter((t) => matchesSearch(t) && matchesFilters(t));
  const activeFilterCount = countFilters(activeFilters);

  return (
    <div style={s.page}>
      {/* Breadcrumb (Space › List) lives in the shared topbar. */}
      {slotEl && createPortal(
        <span style={s.crumbs}>
          <button style={s.crumbLink} onClick={() => navigate(`/projects/${space._id}`)}>{space.name}</button>
          <span style={s.crumbSep}>›</span>
          {editingName ? (
            <input style={s.crumbInput} value={nameDraft} autoFocus
              onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }} />
          ) : (
            <span style={s.crumbCurrentWrap}>
              <span style={s.crumbCurrent}>{list.name} {list.privacy === 'private' && <span title="Private">🔒</span>}</span>
              <button className="icon-btn" style={s.crumbEdit} title="Rename list" onClick={startRename}><IconEdit size={14} /></button>
            </span>
          )}
        </span>,
        slotEl,
      )}

      <ViewTabs vs={vs} rightSlot={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {activeView?.type === 'board' && <CardFieldsMenu cf={cf} customFields={cardCustomFields} />}
          {can('task.create') && <button className="btn btn-primary" style={s.taskBtn} onClick={() => setTaskOpen(true)}>+ Task</button>}
        </span>} />

      <div style={s.searchBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
            <span style={s.searchIcon}><IconSearch size={15} /></span>
            <input style={s.searchInput} placeholder={`Search ${activeView?.name?.toLowerCase() || 'tasks'}`} value={taskQuery}
              onChange={(e) => setTaskQuery(e.target.value)} />
          </div>
          <BoardFilter members={members} tasks={tasks} statuses={statuses} value={activeFilters}
            onChange={(f) => updateView(activeId, { filters: f })} />
          {activeFilterCount > 0 && (
            <button style={s.clearFilters} onClick={() => updateView(activeId, { filters: emptyFilters() })}>Clear filters</button>
          )}
        </div>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{visibleTasks.length} of {tasks.length}</span>
      </div>

      <div style={{ ...s.viewArea, overflow: activeView?.type === 'board' ? 'hidden' : 'auto' }}>
        {activeView?.type === 'board' && (
          <KanbanBoard tasks={visibleTasks} onChanged={() => loadTasks(id)} projectId={space._id}
            listId={list._id} members={members} statuses={statuses} onOpenTask={setOpenTaskId}
            cardFields={cf.std} cardCustom={cardCustomFields.filter((f) => cf.isOn(`cf:${f._id}`, false))} />
        )}
        {activeView?.type === 'list' && (
          <TaskListView tasks={visibleTasks} members={members} statuses={statuses}
            onChanged={() => loadTasks(id)} onCreate={() => setTaskOpen(true)} onOpenTask={setOpenTaskId} />
        )}
        {activeView?.type === 'table' && (
          <TaskTableView tasks={visibleTasks} members={members} statuses={statuses}
            onCreate={() => setTaskOpen(true)} onOpenTask={setOpenTaskId} />
        )}
      </div>

      <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)}
        onChanged={() => loadTasks(id)} members={members} statuses={statuses} onOpenTask={setOpenTaskId} />
      <TaskModal open={taskOpen} mode="create" projects={[space]} defaultProjectId={space._id} listId={list._id}
        listName={list.name} statuses={statuses}
        onClose={() => setTaskOpen(false)} onSaved={() => { setTaskOpen(false); loadTasks(id); }} />
    </div>
  );
}

const s = {
  // height+negative margin consume the app's bottom padding so the board's
  // horizontal scrollbar sits at the very bottom of the viewport.
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100% + 24px)', marginTop: -14, marginBottom: -24 },
  crumbs: { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', fontSize: 15 },
  crumbCurrentWrap: { display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  crumbEdit: { color: 'var(--c-faint)', padding: 4, borderRadius: 6 },
  crumbInput: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '4px 10px', minWidth: 160 },
  taskBtn: { padding: '7px 13px', fontSize: 13 },
  tabs: { display: 'flex', gap: 4, margin: '16px 0', borderBottom: '1px solid #e5e7eb' },
  searchBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 32px', border: '1px solid #d1d5db', borderRadius: 8 },
  clearFilters: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  viewArea: { flex: 1, minHeight: 0, paddingRight: 2 },
};
