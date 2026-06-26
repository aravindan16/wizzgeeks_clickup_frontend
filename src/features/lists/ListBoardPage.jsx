import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listsApi } from './listsApi';
import { projectsApi } from '../projects/projectsApi';
import { tasksApi, STATUS_LABELS, resolveStatuses } from '../tasks/tasksApi';
import KanbanBoard from '../tasks/KanbanBoard';
import TaskListView from '../tasks/TaskListView';
import TaskModal from '../tasks/TaskModal';
import TaskDetailModal from '../tasks/TaskDetailModal';
import { useAuth } from '../auth/useAuth';
import BoardFilter, { emptyFilters, countFilters } from '../tasks/BoardFilter';
import { IconBoard, IconList, IconSearch } from '../../components/icons';
import { SkeletonBoard } from '../../components/Skeleton';

/**
 * A List inside a Space: shows only this List's tasks. Reuses the Board / List
 * views and the Space's status workflow + members. Tasks created here are scoped
 * to the List (list_id).
 */
export default function ListBoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [taskOpen, setTaskOpen] = useState(false);
  const [list, setList] = useState(null);
  const [space, setSpace] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('board');
  const [taskQuery, setTaskQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [openTaskId, setOpenTaskId] = useState(null);

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
    if (filters.assignee.length && !filters.assignee.includes(t.assignee_id || 'unassigned')) return false;
    if (filters.status.length && !filters.status.includes(t.status)) return false;
    if (filters.type.length && !filters.type.includes(t.type)) return false;
    if (filters.label.length && !(t.labels || []).some((l) => filters.label.includes(l))) return false;
    return true;
  };
  const visibleTasks = tasks.filter((t) => matchesSearch(t) && matchesFilters(t));
  const activeFilterCount = countFilters(filters);

  return (
    <div style={s.page}>
      <button style={s.back} onClick={() => navigate(`/projects/${space._id}`)}><span style={s.backChevron}>‹</span> {space.name}</button>

      <div style={s.head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={s.listIcon}>≡</div>
          <div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>{list.key || space.key} · List</div>
            <h2 style={{ margin: '2px 0' }}>{list.name} {list.privacy === 'private' && <span title="Private">🔒</span>}</h2>
          </div>
        </div>
        {can('task.create') && (
          <button className="btn btn-primary" onClick={() => setTaskOpen(true)}>+ Task</button>
        )}
      </div>

      <div style={s.tabs}>
        {[['board', 'Board', IconBoard], ['list', 'List', IconList]].map(([key, label, Icon]) => (
          <button key={key} className={`wg-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon size={16} /> {label}</span>
          </button>
        ))}
      </div>

      <div style={s.searchBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
            <span style={s.searchIcon}><IconSearch size={15} /></span>
            <input style={s.searchInput} placeholder="Search list" value={taskQuery}
              onChange={(e) => setTaskQuery(e.target.value)} />
          </div>
          <BoardFilter members={members} tasks={tasks} statuses={statuses} value={filters} onChange={setFilters} />
          {activeFilterCount > 0 && (
            <button style={s.clearFilters} onClick={() => setFilters(emptyFilters())}>Clear filters</button>
          )}
        </div>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{visibleTasks.length} of {tasks.length}</span>
      </div>

      <div style={{ ...s.viewArea, overflow: tab === 'board' ? 'hidden' : 'auto' }}>
        {tab === 'board' && (
          <KanbanBoard tasks={visibleTasks} onChanged={() => loadTasks(id)} projectId={space._id}
            listId={list._id} members={members} statuses={statuses} onOpenTask={setOpenTaskId} />
        )}
        {tab === 'list' && (
          tasks.length === 0 ? (
            <div className="wg-empty"><span className="wg-empty-emoji">≡</span>No tasks in this list yet. Use “+ Create” on the board.</div>
          ) : (
            <TaskListView tasks={visibleTasks} members={members} statuses={statuses}
              onChanged={() => loadTasks(id)} onOpenTask={setOpenTaskId} />
          )
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
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100% + 24px)', marginBottom: -24 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none',
    border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: 14, padding: '4px 2px', fontSize: 14, fontWeight: 500 },
  backChevron: { fontSize: 18, lineHeight: 1, marginTop: -1 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  listIcon: { width: 44, height: 44, borderRadius: 10, background: '#f1f2f4', color: '#000000',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, flexShrink: 0 },
  tabs: { display: 'flex', gap: 4, margin: '16px 0', borderBottom: '1px solid #e5e7eb' },
  searchBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 32px', border: '1px solid #d1d5db', borderRadius: 8 },
  clearFilters: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  viewArea: { flex: 1, minHeight: 0, paddingRight: 2 },
};
