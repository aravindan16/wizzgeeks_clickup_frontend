import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi, PROJECT_ROLES } from './projectsApi';
import { tasksApi, STATUS_LABELS, resolveStatuses } from '../tasks/tasksApi';
import KanbanBoard from '../tasks/KanbanBoard';
import TaskListView from '../tasks/TaskListView';
import BoardFilter, { emptyFilters, countFilters } from '../tasks/BoardFilter';
import { IconBoard, IconMembers, IconSearch, IconFolder } from '../../components/icons';
import Select from '../../components/Select';
import TaskModal from '../tasks/TaskModal';
import TaskDetailModal from '../tasks/TaskDetailModal';
import ProjectModal from './ProjectModal';
import AddMembersModal from './AddMembersModal';
import SpaceSummary from './SpaceSummary';
import { useAuth } from '../auth/useAuth';
import { useTrackVisit } from '../recent/useTrackVisit';
import { useConfirm } from '../../components/ConfirmDialog';

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
  const [tab, setTab] = useState('board');
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [openTaskId, setOpenTaskId] = useState(null);

  const canManageGlobal = can('project.member.manage');

  const loadTasks = useCallback(async () => {
    const res = await tasksApi.list({ project_id: id, limit: 200, sort_by: 'created_at', sort_dir: 1 });
    setTasks(res.items);
  }, [id]);

  const load = useCallback(async () => {
    try {
      const [p, st, ms] = await Promise.all([
        projectsApi.get(id),
        projectsApi.stats(id),
        projectsApi.members(id),
      ]);
      setProject(p); setStats(st); setMembers(ms);
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load project');
    }
  }, [id, loadTasks]);

  useEffect(() => { load(); }, [load]);

  useTrackVisit(project ? {
    path: `/projects/${id}`, name: project.name, type: 'Space', icon: '📁', id,
  } : null);

  if (error) return <div className="card" style={{ color: '#991b1b' }}>{error}</div>;
  if (!project) return <p>Loading…</p>;

  const memberIds = new Set(members.map((m) => m.user_id));
  const isOwner = project.owner_id && project.owner_id === me;
  const statuses = resolveStatuses(project);

  // Common task search + filters — applied to both Board and List views.
  const nameOf = (uid) => members.find((m) => m.user_id === uid)?.full_name;
  const tq = taskQuery.trim().toLowerCase();
  const matchesSearch = (t) => !tq || [t.key, t.title, t.status, STATUS_LABELS[t.status], t.priority, t.type,
    nameOf(t.assignee_id), nameOf(t.reporter_id)].filter(Boolean).join(' ').toLowerCase().includes(tq);
  const matchesFilters = (t) => {
    if (filters.assignee.length && !filters.assignee.includes(t.assignee_id || 'unassigned')) return false;
    if (filters.status.length && !filters.status.includes(t.status)) return false;
    if (filters.type.length && !filters.type.includes(t.type)) return false;
    if (filters.label.length && !(t.labels || []).some((l) => filters.label.includes(l))) return false;
    return true;
  };
  const visibleTasks = tasks.filter((t) => matchesSearch(t) && matchesFilters(t));
  const activeFilterCount = countFilters(filters);
  const canManage = canManageGlobal || isOwner;
  const canArchive = can('project.update') || isOwner;
  const canDelete = can('project.delete') || isOwner;

  const changeRole = async (uid, role) => { await projectsApi.updateMember(id, uid, { user_id: uid, project_role: role }); load(); };
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

      {/* Space tabs */}
      <div style={s.tabs}>
        {/* Only Board for now; Summary/List can be re-enabled later. Members kept for people management. */}
        {[['board', 'Board', IconBoard], ['members', 'Members', IconMembers]].map(([key, label, Icon]) => (
          <button key={key} className={`wg-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon size={16} /> {label}</span>
          </button>
        ))}
      </div>

      {/* Common search toolbar for Board + List */}
      {tab === 'board' && (
        <div style={s.searchBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
              <span style={s.searchIcon}><IconSearch size={15} /></span>
              <input style={s.searchInput} placeholder="Search board" value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)} />
            </div>
            <BoardFilter members={members} tasks={tasks} statuses={statuses} value={filters} onChange={setFilters} />
            {activeFilterCount > 0 && (
              <button style={s.clearFilters} onClick={() => setFilters(emptyFilters())}>Clear filters</button>
            )}
          </div>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{visibleTasks.length} of {tasks.length}</span>
        </div>
      )}

      {/* Scrollable content area — header/tabs/toolbar above stay fixed */}
      <div style={s.viewArea}>
      {/* BOARD */}
      {tab === 'board' && (
        <KanbanBoard tasks={visibleTasks} onChanged={loadTasks} projectId={id} members={members}
          statuses={statuses} onOpenTask={setOpenTaskId} />
      )}

      {/* LIST */}
      {tab === 'list' && (
        <TaskListView tasks={visibleTasks} members={members} statuses={statuses} onChanged={loadTasks}
          onCreate={() => setTaskOpen(true)} onOpenTask={setOpenTaskId} />
      )}

      {/* SUMMARY */}
      {tab === 'summary' && <SpaceSummary tasks={tasks} members={members} statuses={statuses} />}

      {/* MEMBERS */}
      {tab === 'members' && (
        <div>
          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button style={s.primary} onClick={() => setAddPeopleOpen(true)}>+ Add people</button>
            </div>
          )}
          <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'hidden' }}>
            <table style={s.table}>
              <thead><tr><Th>Name</Th><Th>Email</Th><Th>Project Role</Th>{canManage && <Th>Actions</Th>}</tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <Td>{m.full_name || '—'}</Td>
                    <Td>{m.email || '—'}</Td>
                    <Td>
                      {canManage ? (
                        <Select style={{ minWidth: 140 }} value={m.project_role} onChange={(v) => changeRole(m.user_id, v)}
                          options={PROJECT_ROLES.map((r) => ({ value: r.value, label: r.label }))} />
                      ) : (PROJECT_ROLES.find((r) => r.value === m.project_role)?.label || m.project_role)}
                    </Td>
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

function Stat({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || '#111827' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{label}</div>
    </div>
  );
}

const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  // Full-height column: header/tabs/toolbar stay fixed, only viewArea scrolls.
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  viewArea: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'none',
    border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: 14, padding: '4px 2px', fontSize: 14, fontWeight: 500 },
  backChevron: { fontSize: 18, lineHeight: 1, marginTop: -1 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  spaceIcon: { width: 44, height: 44, borderRadius: 10, background: '#111827', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0 },
  searchBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 32px', border: '1px solid #d1d5db', borderRadius: 8 },
  clearFilters: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  tabs: { display: 'flex', gap: 4, margin: '16px 0', borderBottom: '1px solid #e5e7eb' },
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
  primary: { padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '8px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' },
  danger: { padding: '8px 14px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, cursor: 'pointer' },
  link: { background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0 },
};
