import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { projectsApi } from './projectsApi';
import { tasksApi, STATUS_LABELS, resolveStatuses } from '../tasks/tasksApi';
import KanbanBoard from '../tasks/KanbanBoard';
import TaskListView from '../tasks/TaskListView';
import TaskTableView from '../tasks/TaskTableView';
import ViewTabs from '../tasks/ViewTabs';
import { useViews } from '../tasks/useViews';
import FilterBuilder, { newGroup, activeRuleCount } from '../filters/FilterBuilder';
import { filterTasks } from '../filters/filterEval';
import { labelsApi } from '../labels/labelsApi';
import { listsApi } from '../lists/listsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { IconBoard, IconMembers, IconSearch, IconFilter, IconChevronDown } from '../../components/icons';
import TaskModal from '../tasks/TaskModal';
import TaskDetailModal from '../tasks/TaskDetailModal';
import ProjectModal from './ProjectModal';
import SpaceSettingsMenu from './SpaceSettingsMenu';
import AddMembersModal from './AddMembersModal';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { SkeletonBoard } from '../../components/Skeleton';
import ResizableTable from '../../components/ResizableTable';

const DEFAULT_CARDS = [newGroup()]; // stable default builder tree (one empty rule)

/**
 * A Project behaves like a Jira "Space": opening it shows tabbed views — the
 * Board (Kanban of this project's tasks) by default, plus Overview (stats) and
 * Members. Tasks live inside the space rather than in a separate global tab.
 */
export default function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const slotEl = useHeaderSlot();
  const { can, user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
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
  const [labels, setLabels] = useState([]);
  const [spaceLists, setSpaceLists] = useState([]);
  const [spaceFields, setSpaceFields] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Close the filter modal on Escape.
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onEsc = (e) => e.key === 'Escape' && setFilterOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [filterOpen]);

  // Views (List/Board/Table tabs) — persisted per Space, shared with the List board.
  const vs = useViews(id);
  const { activeId, setActiveId, updateView, activeView } = vs;

  // Filter builder (same as the Filters tab), persisted per view under fcards/fconj.
  const fcards = activeView?.fcards?.length ? activeView.fcards : DEFAULT_CARDS;
  const fconj = activeView?.fconj || 'AND';
  const setFcards = (u) => updateView(activeId, { fcards: typeof u === 'function' ? u(fcards) : u });
  const setFconj = (v) => updateView(activeId, { fconj: v });

  useEffect(() => {
    labelsApi.list().then(setLabels).catch(() => setLabels([]));
    listsApi.forSpace(id).then(setSpaceLists).catch(() => setSpaceLists([]));
    customFieldsApi.list(id).then(setSpaceFields).catch(() => setSpaceFields([]));
  }, [id]);

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
  const filterOptions = useMemo(() => ({
    projects: project ? [project] : [],
    lists: spaceLists.map((l) => ({ value: l._id, label: l.name })),
    statuses: statuses.map((st) => ({ value: st.key, label: st.name })),
    users: members.map((m) => ({ user_id: m.user_id, full_name: m.full_name, email: m.email })),
    labels: labels.map((l) => ({ value: l.name, label: l.name })),
    customFields: spaceFields.map((c) => ({ key: `cf:${c._id}`, label: c.name, type: c.type, config: c.config })),
    tasks, myId: me,
  }), [project, spaceLists, statuses, members, labels, spaceFields, tasks, me]);

  const visibleTasks = useMemo(() => {
    const tq = taskQuery.trim().toLowerCase();
    const matchesSearch = (t) => !tq || [t.key, t.title, t.status, STATUS_LABELS[t.status], t.priority, t.type,
      nameMap.get(t.assignee_id), nameMap.get(t.reporter_id)].filter(Boolean).join(' ').toLowerCase().includes(tq);
    return filterTasks(tasks, fcards, fconj, { myId: me }).filter(matchesSearch);
  }, [tasks, taskQuery, fcards, fconj, nameMap, me]);

  const activeFilterCount = activeRuleCount(fcards);

  if (error) return <div className="card" style={{ color: '#991b1b' }}>{error}</div>;
  if (!project) return <div style={{ padding: '8px 0' }}><SkeletonBoard /></div>;

  const isOwner = project.owner_id && project.owner_id === me;
  const isMembersTab = activeId === 'members';
  // TODO: Re-introduce role-based permissions later. For now ANY member of the
  // space can manage members (add/remove/change role) — no specific role needed.
  const isMember = memberIds.has(me);
  const canManage = isOwner || isMember || canManageGlobal;
  // Adding / removing people is separately gated (backend requires these). Mirror the
  // backend so the buttons only show when the action will actually succeed.
  const canAddPeople = can('project.member.add') || canManageGlobal;
  const canRemovePeople = can('project.member.remove') || canManageGlobal;
  const canArchive = can('project.update') || isOwner;
  // Only the person who created the space (owner) can delete it.
  const canDelete = isOwner;

  const removeMember = async (m) => {
    if (!(await confirm({ title: 'Remove member', message: `Remove ${m.full_name || m.email} from this Space?`, confirmLabel: 'Remove', danger: true }))) return;
    await projectsApi.removeMember(id, m.user_id);
    toast.success('Member removed');
    load();
  };
  const archive = async () => { await projectsApi.archive(id); load(); };
  const del = async () => {
    const ok = await confirm({
      title: `Delete: ${project.name}`,
      message: 'This Space and all of its Lists and tasks will be deleted. This cannot be undone.',
    });
    if (ok) { await projectsApi.remove(id); toast.success('Space deleted'); navigate('/projects'); }
  };

  return (
    <div style={s.page}>
      {/* Breadcrumb ("Spaces › Space name") lives in the shared topbar. */}
      {slotEl && createPortal(
        <span style={s.crumbs}>
          <button style={s.crumbLink} onClick={() => navigate('/projects')}>Spaces</button>
          <span style={s.crumbSep}>›</span>
          <span style={s.crumbCurrent}>{project.name}</span>
        </span>,
        slotEl,
      )}

      {/* View tabs (List / Board / Table) + Members + "+ View". The primary action
          (Create Task, or Add people on the Members tab) sits at the right corner.
          Double-click or right-click a tab to rename/delete; filters persist per view. */}
      <ViewTabs vs={vs} extraTabs={[{
        id: 'members', label: 'Members', icon: <IconMembers size={16} />,
        active: isMembersTab, onClick: () => setActiveId('members'),
      }]} rightSlot={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <SpaceSettingsMenu onSpaceSetting={() => navigate(`/projects/${id}/settings`)} />
          {isMembersTab
            ? <button className="btn btn-primary" style={{ ...s.taskBtn, ...(canAddPeople ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
                onClick={() => (canAddPeople ? setAddPeopleOpen(true) : toast.error("You don't have permission to add members"))}>+ Add people</button>
            : (can('task.create') && project.status !== 'archived'
                ? <button className="btn btn-primary" style={s.taskBtn} onClick={() => setTaskOpen(true)}>+ Task</button>
                : null)}
        </span>} />

      {/* Common search + filter toolbar for any task view. */}
      {!isMembersTab && (
        <div style={s.searchBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
              <span style={s.searchIcon}><IconSearch size={15} /></span>
              <input style={s.searchInput} placeholder={`Search ${activeView?.name?.toLowerCase() || 'tasks'}`} value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)} />
            </div>
            <button type="button" className="btn" style={{ ...s.filterToggle, ...(filterOpen ? s.filterToggleActive : {}) }}
              onClick={() => setFilterOpen((o) => !o)}>
              <IconFilter size={15} /> Filter
              {activeFilterCount > 0 && <span style={s.filterBadge}>{activeFilterCount}</span>}
              <span style={{ display: 'inline-flex', transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><IconChevronDown size={13} /></span>
            </button>
          </div>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{visibleTasks.length} of {tasks.length}</span>
        </div>
      )}

      {!isMembersTab && filterOpen && createPortal(
        <div style={s.filterBackdrop} onClick={() => setFilterOpen(false)}>
          <div style={s.filterModal} onClick={(e) => e.stopPropagation()}>
            <div style={s.filterModalHead}>
              <span style={s.filterModalTitle}>
                <IconFilter size={16} /> Filters
                {activeFilterCount > 0 && <span style={s.filterBadge}>{activeFilterCount}</span>}
              </span>
              <button type="button" className="icon-btn wg-x-btn" style={s.filterModalClose}
                onClick={() => setFilterOpen(false)} aria-label="Close">✕</button>
            </div>
            <div style={s.filterModalBody}>
              <FilterBuilder cards={fcards} onCards={setFcards} conj={fconj} onConj={setFconj} options={filterOptions} />
            </div>
            <div style={s.filterModalFoot}>
              <button type="button" className="wg-clear-btn"
                onClick={() => { setFcards([newGroup()]); setFconj('AND'); }}>Clear all</button>
              <button type="button" className="btn btn-primary" onClick={() => setFilterOpen(false)}>Done</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Scrollable content area — header/tabs/toolbar above stay fixed */}
      <div style={{ ...s.viewArea,
        overflow: (isMembersTab || ['table', 'board', 'list'].includes(activeView?.type)) ? 'hidden' : 'auto',
        ...((isMembersTab || activeView?.type === 'table') ? { display: 'flex', flexDirection: 'column' } : {}) }}>
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
        <ResizableTable persistKey="wg_space_members_cols" rowKey={(m) => m._id} rows={members} emptyText="No members yet." fillHeight
          columns={[
            { key: 'name', label: 'Name', width: 320, min: 140, render: (m) => m.full_name || '—' },
            { key: 'email', label: 'Email', width: 320, min: 140, render: (m) => <span style={{ color: 'var(--c-muted)' }}>{m.email || '—'}</span> },
            ...(canRemovePeople ? [{ key: 'actions', label: 'Actions', width: 120, min: 90, align: 'right',
              render: (m) => <button className="wg-danger-link" style={s.link} onClick={() => removeMember(m)}>Remove</button> }] : []),
          ]} />
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

const Th = ({ children, style }) => <th style={{ ...s.th, ...style }}>{children}</th>;
const Td = ({ children, style }) => <td style={{ ...s.td, ...style }}>{children}</td>;

const s = {
  // Full-height column: header/tabs/toolbar stay fixed, only viewArea scrolls.
  // height+negative margin consume the app's bottom padding so the board's
  // horizontal scrollbar sits at the very bottom of the viewport.
  // height compensates BOTH negative margins (14 top + 24 bottom) so the column spans
  // the full viewport and the pager/scrollbar sits flush at the very bottom.
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100% + 38px)', marginTop: -14, marginBottom: -24 },
  viewArea: { flex: 1, minHeight: 0, paddingRight: 2 },
  crumbs: { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', fontSize: 15 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  taskBtn: { padding: '7px 13px', fontSize: 13 },
  searchBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 32px', border: '1px solid #d1d5db', borderRadius: 8 },
  clearFilters: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  filterToggle: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, whiteSpace: 'nowrap' },
  filterToggleActive: { borderColor: 'var(--c-primary)', color: 'var(--c-primary)' },
  filterBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px',
    borderRadius: 999, background: 'var(--c-primary)', color: 'var(--c-on-primary)', fontSize: 11, fontWeight: 700 },
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
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '.02em',
    color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)' },
  td: { padding: '12px 16px', fontSize: 14, color: 'var(--c-text)' },
  memberRow: { borderTop: '1px solid var(--c-border-2)' },
  select: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8 },
  addRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  primary: { padding: '8px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '8px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' },
  danger: { padding: '8px 14px', background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, cursor: 'pointer' },
  link: { border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '5px 12px', borderRadius: 8 },

  // Filter modal (opens as a centered dialog instead of pushing the board down).
  filterBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 80,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 16px' },
  filterModal: { width: 720, maxWidth: '96vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)',
    borderRadius: 14, boxShadow: 'var(--sh-lg)', overflow: 'hidden' },
  filterModalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '14px 18px', borderBottom: '1px solid var(--c-border-2)' },
  filterModalTitle: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  filterModalClose: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 4 },
  filterModalBody: { padding: 18, overflowY: 'auto' },
  filterModalFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '12px 18px', borderTop: '1px solid var(--c-border-2)' },
};
