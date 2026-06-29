import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi } from './projectsApi';
import { tasksApi, STATUS_LABELS, resolveStatuses } from '../tasks/tasksApi';
import KanbanBoard from '../tasks/KanbanBoard';
import TaskListView from '../tasks/TaskListView';
import TaskTableView from '../tasks/TaskTableView';
import ViewTabs from '../tasks/ViewTabs';
import { useViews } from '../tasks/useViews';
import BoardFilter, { emptyFilters, countFilters } from '../tasks/BoardFilter';
import { IconBoard, IconMembers, IconSearch, IconFolder } from '../../components/icons';
import TaskModal from '../tasks/TaskModal';
import TaskDetailModal from '../tasks/TaskDetailModal';
import ProjectModal from './ProjectModal';
import AddMembersModal from './AddMembersModal';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../../components/ConfirmDialog';
import { SkeletonBoard } from '../../components/Skeleton';

const EMPTY_FILTERS = { assignee: [], status: [], type: [], priority: [], label: [] };

/**
 * A Project behaves like a Jira "Space": opening it shows tabbed views — the
 * Board (Kanban of this project's tasks) by default, plus Overview (stats) and
 * Members. Tasks live inside the space rather than in a separate global tab.
 */
export default function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const confirm = useConfirm();
  const me = user?._id || user?.id;
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);

  // Views (List/Board/Table tabs) — persisted per Space, shared with the List board.
  const vs = useViews(id);
  const { activeId, setActiveId, updateView, activeView } = vs;
  const activeFilters = activeView?.filters || EMPTY_FILTERS;

  const canManageGlobal = can('project.member.manage');

  const loadTasks = useCallback(async () => {
    const res = await tasksApi.list({ project_id: id, limit: 200, sort_by: 'created_at', sort_dir: 1 });
    setTasks(res.items);
  }, [id]);

  const load = useCallback(async () => {
    try {
      // Tasks only need project_id (already in the URL), so fire that request in
      // the SAME wave as project/members instead of waiting for them. The board
      // content (heaviest call) no longer queues behind the space metadata.
      const [p, ms] = await Promise.all([
        projectsApi.get(id),
        projectsApi.members(id),
        loadTasks(),
      ]);
      setProject(p); setMembers(ms);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load project');
    }
  }, [id, loadTasks]);

  useEffect(() => { load(); }, [load]);

  // --- Memoized derivations (hooks must run before the early returns below) ---
  // member_id → name map: O(1) lookups instead of members.find() per task per render.
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const nameMap = useMemo(() => {
    const map = new Map();
    members.forEach((m) => map.set(m.user_id, m.full_name));
    return map;
  }, [members]);
  const statuses = useMemo(() => (project ? resolveStatuses(project) : []), [project]);

  // Search + filters recomputed only when tasks/query/filters change — not on
  // every unrelated re-render (modals opening, etc.).
  const visibleTasks = useMemo(() => {
    const tq = taskQuery.trim().toLowerCase();
    const matchesSearch = (t) => !tq || [t.key, t.title, t.status, STATUS_LABELS[t.status], t.priority, t.type,
      nameMap.get(t.assignee_id), nameMap.get(t.reporter_id)].filter(Boolean).join(' ').toLowerCase().includes(tq);
    const matchesFilters = (t) => {
      if (activeFilters.assignee.length && !activeFilters.assignee.includes(t.assignee_id || 'unassigned')) return false;
      if (activeFilters.status.length && !activeFilters.status.includes(t.status)) return false;
      if (activeFilters.type.length && !activeFilters.type.includes(t.type)) return false;
      if ((activeFilters.priority || []).length && !activeFilters.priority.includes(t.priority)) return false;
      if ((activeFilters.label || []).length && !(t.labels || []).some((l) => activeFilters.label.includes(l))) return false;
      return true;
    };
    return tasks.filter((t) => matchesSearch(t) && matchesFilters(t));
  }, [tasks, taskQuery, activeFilters, nameMap]);

  if (error) return <div className="card" style={{ color: '#991b1b' }}>{error}</div>;
  if (!project) return <div style={{ padding: '8px 0' }}><SkeletonBoard /></div>;

  const isOwner = project.owner_id && project.owner_id === me;
  const activeFilterCount = countFilters(activeFilters);
  const isMembersTab = activeId === 'members';
  // TODO: Re-introduce role-based permissions later. For now ANY member of the
  // space can manage members (add/remove/change role) — no specific role needed.
  const isMember = memberIds.has(me);
  const canManage = isOwner || isMember || canManageGlobal;
  const canArchive = can('project.update') || isOwner;
  // Only the person who created the space (owner) can delete it.
  const canDelete = isOwner;

  const removeMember = async (uid) => { await projectsApi.removeMember(id, uid); load(); };
  const archive = async () => { await projectsApi.archive(id); load(); };
  const del = async () => {
    const ok = await confirm({
      title: `Delete: ${project.name}`,
      message: 'This Space and all of its Lists and tasks will be deleted. This cannot be undone.',
    });
    if (ok) { await projectsApi.remove(id); navigate('/projects'); }
  };

  return (
    <div style={s.page}>
      <button style={s.back} onClick={() => navigate('/projects')}><span style={s.backChevron}>‹</span> Spaces</button>

      {/* Space header */}
      <div style={s.head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={s.spaceIcon}>{project.key?.[0]?.toUpperCase() || <IconFolder size={20} />}</div>
          <div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>{project.key}</div>
            <h2 style={{ margin: '2px 0' }}>{project.name}</h2>
            <span className={`badge ${project.status === 'archived' ? 'badge-err' : 'badge-ok'}`}>{project.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('task.create') && project.status !== 'archived' &&
            <button style={s.primary} onClick={() => setTaskOpen(true)}>+ Create Task</button>}
        </div>
      </div>

      {/* View tabs (List / Board / Table) + Members + "+ View". Double-click or
          right-click a tab to rename/delete; filters persist per view. */}
      <ViewTabs vs={vs} extraTabs={[{
        id: 'members', label: 'Members', icon: <IconMembers size={16} />,
        active: isMembersTab, onClick: () => setActiveId('members'),
      }]} />

      {/* Common search + filter toolbar for any task view. */}
      {!isMembersTab && (
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
      )}

      {/* Scrollable content area — header/tabs/toolbar above stay fixed */}
      <div style={{ ...s.viewArea, overflow: activeView?.type === 'board' ? 'hidden' : 'auto' }}>
      {!isMembersTab && activeView?.type === 'board' && (
        <KanbanBoard tasks={visibleTasks} onChanged={loadTasks} projectId={id} members={members}
          statuses={statuses} onOpenTask={setOpenTaskId} />
      )}

      {!isMembersTab && activeView?.type === 'list' && (
        <TaskListView tasks={visibleTasks} members={members} statuses={statuses} onChanged={loadTasks}
          onCreate={() => setTaskOpen(true)} onOpenTask={setOpenTaskId} />
      )}

      {!isMembersTab && activeView?.type === 'table' && (
        <TaskTableView tasks={visibleTasks} members={members} statuses={statuses}
          onCreate={() => setTaskOpen(true)} onOpenTask={setOpenTaskId} />
      )}

      {/* MEMBERS */}
      {isMembersTab && (
        <div>
          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button style={s.primary} onClick={() => setAddPeopleOpen(true)}>+ Add people</button>
            </div>
          )}
          <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'hidden' }}>
            <table style={s.table}>
              <thead><tr><Th>Name</Th><Th>Email</Th>{canManage && <Th>Actions</Th>}</tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <Td>{m.full_name || '—'}</Td>
                    <Td>{m.email || '—'}</Td>
                    {canManage && <Td><button style={s.link} onClick={() => removeMember(m.user_id)}>Remove</button></Td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)}
        onChanged={loadTasks} members={members} statuses={statuses} onOpenTask={setOpenTaskId} />
      <AddMembersModal open={addPeopleOpen} project={project} projectId={id}
        existingMemberIds={memberIds}
        onClose={() => setAddPeopleOpen(false)}
        onAdded={() => { setAddPeopleOpen(false); load(); }} />
      <TaskModal open={taskOpen} mode="create" projects={[project]} defaultProjectId={id} statuses={statuses}
        onClose={() => setTaskOpen(false)}
        onSaved={() => { setTaskOpen(false); load(); }} />
      <ProjectModal open={editOpen} mode="edit" project={project}
        onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); }} />
    </div>
  );
}

const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  // Full-height column: header/tabs/toolbar stay fixed, only viewArea scrolls.
  // height+negative margin consume the app's bottom padding so the board's
  // horizontal scrollbar sits at the very bottom of the viewport.
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100% + 24px)', marginBottom: -24 },
  viewArea: { flex: 1, minHeight: 0, paddingRight: 2 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none',
    border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: 14, padding: '4px 2px', fontSize: 14, fontWeight: 500 },
  backChevron: { fontSize: 18, lineHeight: 1, marginTop: -1 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  spaceIcon: { width: 44, height: 44, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-on-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0 },
  searchBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 32px', border: '1px solid #d1d5db', borderRadius: 8 },
  clearFilters: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  tabs: { display: 'flex', alignItems: 'center', gap: 4, margin: '16px 0', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' },
  tabWrap: { display: 'inline-flex', alignItems: 'center' },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 400 },
  viewMenu: { position: 'fixed', zIndex: 401, minWidth: 180, background: 'var(--c-surface)', color: 'var(--c-text)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 14px 34px rgba(0,0,0,.18)', padding: 6 },
  viewMenuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none',
    border: 'none', padding: '9px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  viewMenuItemDisabled: { color: 'var(--c-faint)', cursor: 'not-allowed' },
  renameInput: { font: 'inherit', fontSize: 14, fontWeight: 600, padding: '6px 8px', border: '1px solid var(--c-primary)',
    borderRadius: 7, background: 'var(--c-surface)', color: 'var(--c-text)', width: 120, outline: 'none' },
  addViewBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--c-muted)',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px 10px' },
  tab: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' },
  tabActive: { padding: '8px 16px', background: 'none', border: 'none', borderBottom: '2px solid #111827', cursor: 'pointer', fontWeight: 600 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12 },
  progressOuter: { background: '#e5e7eb', borderRadius: 999, height: 10, marginTop: 16, overflow: 'hidden' },
  progressInner: { background: '#111827', height: '100%', transition: 'width .3s' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 12, textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb' },
  td: { padding: '10px 14px', fontSize: 14 },
  select: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8 },
  addRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  primary: { padding: '8px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '8px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' },
  danger: { padding: '8px 14px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, cursor: 'pointer' },
  link: { background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0 },
};
