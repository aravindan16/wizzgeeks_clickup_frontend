import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { projectsApi } from '../projects/projectsApi';
import SpaceSetupModal from '../projects/SpaceSetupModal';
import { listsApi } from '../lists/listsApi';
import CreateListModal from '../lists/CreateListModal';
import ListStatusModal from '../lists/ListStatusModal';
import CustomFieldManager from '../customfields/CustomFieldManager';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../auth/useAuth';
import { IconPlus, IconFields, IconTrash, IconEdit, IconBoard, IconDots, IconListCheck, IconFolder, Chevron } from '../../components/icons';
import TaskModal from '../tasks/TaskModal';
import { resolveStatuses } from '../tasks/tasksApi';
import apiClient from '../../services/apiClient';

const NO_DELETE_MSG = "You don't have permission to take this action";

/**
 * Sidebar "Spaces" section. Each Space is expandable to reveal its Lists nested
 * underneath (ClickUp-style). A "+" beside the Space and its "⋯" menu both create
 * a List; each List has its own menu (rename, duplicate, archive, move, delete).
 * All mutations update the sidebar instantly — no page refresh.
 */
export default function SpacesMenu({ collapsed }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const confirm = useConfirm();
  const { user, can } = useAuth();
  const me = user?._id || user?.id;
  // Only the Space's creator (owner) sees the Delete option.
  // TODO: Re-introduce an admin override (project.delete) when permissions return.
  const canDeleteSpace = (sp) => !!sp.owner_id && sp.owner_id === me;
  const [spaces, setSpaces] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [listsBySpace, setListsBySpace] = useState({});

  const [topMenu, setTopMenu] = useState(false);          // section "+ Create Space" menu
  const [spaceSetupOpen, setSpaceSetupOpen] = useState(false);
  const [spaceMenu, setSpaceMenu] = useState(null);       // spaceId with open ⋯ menu
  const [listMenu, setListMenu] = useState(null);         // { id, spaceId } with open ⋯ menu
  const [createListSpace, setCreateListSpace] = useState(null); // spaceId for create-list modal
  const [cfManager, setCfManager] = useState(null); // { scope, spaceId, listId, spaceName, listName }
  const [listStatus, setListStatus] = useState(null); // { list, spaceStatuses }
  const [taskFor, setTaskFor] = useState(null); // { space, list } — quick create task in a list

  const rootRef = useRef(null);

  const loadSpaces = useCallback(async () => {
    try {
      const res = await projectsApi.list({ limit: 100 });
      const items = [...(res.items || [])].sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      );
      setSpaces(items);
    } catch { setSpaces([]); }
  }, []);

  const loadLists = useCallback(async (spaceId) => {
    try {
      // _silent: expanding a Space should never flash the global loader.
      const r = await apiClient.get('/lists', { params: { space_id: spaceId }, _silent: true });
      setListsBySpace((m) => ({ ...m, [spaceId]: r.data || [] }));
    } catch { setListsBySpace((m) => ({ ...m, [spaceId]: [] })); }
  }, []);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);

  // Prefetch ONLY the (lightweight) Lists of each Space right after login, so
  // expanding a Space shows its Lists instantly instead of waiting on a request.
  // Tasks are NOT prefetched — those are heavy and load on demand when a Space or
  // List page is opened. All calls are _silent (no global loader).
  const prefetchedRef = useRef(new Set());
  useEffect(() => {
    spaces.forEach((sp) => {
      if (prefetchedRef.current.has(sp._id)) return;
      prefetchedRef.current.add(sp._id);
      apiClient.get('/lists', { params: { space_id: sp._id }, _silent: true })
        .then((r) => setListsBySpace((m) => ({ ...m, [sp._id]: r.data || [] })))
        .catch(() => {});
    });
  }, [spaces]);

  // (Removed the refetch-on-window-focus listener: it fired a /lists request for
  // every expanded Space on each focus change — a refetch storm when switching
  // between the page and devtools/other tabs. Lists refresh on expand and after
  // create/rename/delete, which is enough.)

  // Close any open popover on outside click / Escape.
  useEffect(() => {
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setTopMenu(false); setSpaceMenu(null); setListMenu(null);
      }
    };
    const onEsc = (e) => { if (e.key === 'Escape') { setTopMenu(false); setSpaceMenu(null); setListMenu(null); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, []);

  const toggleExpand = (spaceId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else { next.add(spaceId); loadLists(spaceId); } // always refetch on expand (don't trust stale cache)
      return next;
    });
  };

  const openCreateList = (spaceId) => { setSpaceMenu(null); setTopMenu(false); setCreateListSpace(spaceId); };
  const openSpaceFields = (sp) => { setSpaceMenu(null); setCfManager({ scope: 'space', spaceId: sp._id, listId: null, spaceName: sp.name }); };
  const openListFields = (sp, l) => { setListMenu(null); setCfManager({ scope: 'list', spaceId: sp._id, listId: l._id, spaceName: sp.name, listName: l.name }); };
  const openListStatuses = (sp, l) => { setListMenu(null); setListStatus({ list: l, spaceStatuses: sp.statuses || [], spaceId: sp._id }); };
  const openListTask = (sp, l) => { setListMenu(null); setTaskFor({ space: sp, list: l }); };

  const onListCreated = (list) => {
    const sid = list.space_id;
    setExpanded((prev) => new Set(prev).add(sid));
    setListsBySpace((m) => ({ ...m, [sid]: [...(m[sid] || []), list] }));
    navigate(`/lists/${list._id}`);
  };

  // --- space operation ---
  const deleteSpace = async (sp) => {
    setSpaceMenu(null);
    const ok = await confirm({
      title: `Delete: ${sp.name}`,
      message: 'This Space and all of its Lists and tasks will be deleted. This cannot be undone.',
    });
    if (!ok) return;
    try { await projectsApi.remove(sp._id); } catch { /* backend enforces permission */ }
    await loadSpaces();
    navigate('/projects');
  };

  // --- per-list operations (instant UI update) ---
  const renameList = async (l) => {
    setListMenu(null);
    const name = window.prompt('Rename list', l.name);
    if (!name || name.trim() === l.name) return;
    await listsApi.update(l._id, { name: name.trim() });
    loadLists(l.space_id);
  };
  const deleteList = async (l) => {
    setListMenu(null);
    const ok = await confirm({
      title: `Delete: ${l.name}`,
      message: <><strong>{l.task_count || 0} task{(l.task_count || 0) === 1 ? '' : 's'}</strong> within this List will be deleted. This cannot be undone.</>,
    });
    if (!ok) return;
    await listsApi.remove(l._id);
    loadLists(l.space_id);
  };

  const modals = (
    <>
      <SpaceSetupModal open={spaceSetupOpen} onClose={() => setSpaceSetupOpen(false)} onCreated={loadSpaces} />
      <CreateListModal open={!!createListSpace} spaces={spaces} defaultSpaceId={createListSpace}
        onClose={() => setCreateListSpace(null)} onCreated={onListCreated} />
      <CustomFieldManager open={!!cfManager} {...(cfManager || {})} onClose={() => setCfManager(null)} />
      <ListStatusModal open={!!listStatus} list={listStatus?.list} spaceStatuses={listStatus?.spaceStatuses || []}
        onClose={() => setListStatus(null)}
        onSaved={() => {
          if (listStatus) {
            loadLists(listStatus.spaceId);
            window.dispatchEvent(new CustomEvent('wg:list-updated', { detail: { listId: listStatus.list._id } }));
          }
          setListStatus(null);
        }} />
      {taskFor && (
        <TaskModal open mode="create" projects={[taskFor.space]} defaultProjectId={taskFor.space._id}
          listId={taskFor.list._id} listName={taskFor.list.name}
          statuses={resolveStatuses((taskFor.list.status_mode === 'custom' && taskFor.list.statuses?.length) ? taskFor.list : taskFor.space)}
          onClose={() => setTaskFor(null)}
          onSaved={() => {
            const lid = taskFor.list._id; const sid = taskFor.space._id;
            setTaskFor(null);
            loadLists(sid);
            window.dispatchEvent(new CustomEvent('wg:list-updated', { detail: { listId: lid } }));
            navigate(`/lists/${lid}`);
          }} />
      )}
    </>
  );

  if (collapsed) {
    return (
      <>
        <button title="Spaces" style={{ ...s.navItem, ...s.navItemCollapsed }} onClick={() => navigate('/projects')}>
          <span style={s.navIcon}><IconFolder size={18} /></span>
        </button>
        {modals}
      </>
    );
  }

  return (
    <div style={s.section} ref={rootRef}>
      <div style={s.header}>
        <button style={s.heading} onClick={() => navigate('/projects')} title="All spaces">Spaces</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
          <button className="icon-btn" style={s.iconBtn} title="Space actions" onClick={() => { setSpaceMenu(null); setListMenu(null); setTopMenu((o) => !o); }}><IconDots size={16} /></button>
          <button className="icon-btn" style={s.iconBtn} title="Create space" onClick={() => setSpaceSetupOpen(true)}><IconPlus size={16} /></button>
          {topMenu && (
            <div style={s.dropdown} role="menu">
              <button style={s.dropItem} onClick={() => { setTopMenu(false); setSpaceSetupOpen(true); }}>
                <span style={s.dropIcon}><IconPlus size={16} /></span> Create Space
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={s.list}>
        {spaces.length === 0 && <div style={s.empty}>No spaces yet</div>}
        {spaces.map((sp) => {
          const isOpen = expanded.has(sp._id);
          const lists = listsBySpace[sp._id] || [];
          return (
            <div key={sp._id}>
              <div style={{ ...s.spaceRow, ...(pathname === `/projects/${sp._id}` ? s.activeRow : {}) }} className="wg-sb-row">
                <button style={s.caret} onClick={() => toggleExpand(sp._id)} title={isOpen ? 'Collapse' : 'Expand'}>
                  <Chevron open={isOpen} size={13} />
                </button>
                <NavLink to={`/projects/${sp._id}`} title={sp.name}
                  style={({ isActive }) => ({ ...s.spaceItem, ...(isActive ? s.activeText : {}) })}>
                  <span style={s.keyBadge}>{(sp.key || sp.name || '?')[0].toUpperCase()}</span>
                  <span style={s.rowName}>{sp.name}</span>
                </NavLink>
                <span className="wg-sb-actions" style={s.rowActions}>
                  <button className="icon-btn" style={s.iconBtn} title="Space actions"
                    onClick={() => { setTopMenu(false); setListMenu(null); setSpaceMenu(spaceMenu === sp._id ? null : sp._id); }}><IconDots size={16} /></button>
                  <button className="icon-btn" style={s.iconBtn} title="Create list" onClick={() => openCreateList(sp._id)}><IconPlus size={16} /></button>
                </span>
                {spaceMenu === sp._id && (
                  <div style={{ ...s.dropdown, top: 'calc(100% - 2px)', right: 6 }} role="menu">
                    <button style={s.dropItem} onClick={() => openCreateList(sp._id)}>
                      <span style={s.dropIcon}><IconPlus size={16} /></span> Create List
                    </button>
                    <button style={s.dropItem} onClick={() => openSpaceFields(sp)}>
                      <span style={s.dropIcon}><IconFields size={16} /></span> Custom Fields
                    </button>
                    <div style={s.divider} />
                    {canDeleteSpace(sp) ? (
                      <button style={{ ...s.dropItem, color: '#b91c1c' }} onClick={() => deleteSpace(sp)}>
                        <span style={s.dropIcon}><IconTrash size={16} /></span> Delete Space
                      </button>
                    ) : (
                      <div className="wg-tip-wrap">
                        <button style={{ ...s.dropItem, color: '#9ca3af', cursor: 'not-allowed' }}
                          aria-disabled="true" onClick={(e) => e.stopPropagation()}>
                          <span style={s.dropIcon}><IconTrash size={16} /></span> Delete Space
                        </button>
                        <span className="wg-tip">{NO_DELETE_MSG}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isOpen && (
                <div style={s.lists}>
                  {lists.map((l) => (
                    <div key={l._id} style={{ ...s.listRow, ...(pathname === `/lists/${l._id}` ? s.activeRow : {}) }} className="wg-sb-row">
                      <NavLink to={`/lists/${l._id}`} title={l.name}
                        style={({ isActive }) => ({ ...s.listItem, ...(isActive ? s.activeText : {}) })}>
                        <span style={s.listIcon}><IconListCheck size={15} /></span>
                        <span style={s.rowName}>{l.name}</span>
                        {l.privacy === 'private' && <span title="Private" style={{ opacity: .7 }}>🔒</span>}
                      </NavLink>
                      <span className="wg-sb-actions" style={s.rowActions}>
                        <button className="icon-btn" style={s.iconBtn} title="List actions"
                          onClick={() => { setTopMenu(false); setSpaceMenu(null); setListMenu(listMenu?.id === l._id ? null : { id: l._id, spaceId: sp._id }); }}><IconDots size={16} /></button>
                        <button className="icon-btn" style={s.iconBtn} title="Create task" onClick={() => openListTask(sp, l)}><IconPlus size={16} /></button>
                      </span>
                      {listMenu?.id === l._id && (
                        <div style={{ ...s.dropdown, top: 'calc(100% - 2px)', right: 4 }} role="menu">
                          <button style={s.dropItem} onClick={() => renameList(l)}><span style={s.dropIcon}><IconEdit size={16} /></span> Rename</button>
                          <button style={s.dropItem} onClick={() => openListStatuses(sp, l)}><span style={s.dropIcon}><IconBoard size={16} /></span> Task statuses</button>
                          <button style={s.dropItem} onClick={() => openListFields(sp, l)}><span style={s.dropIcon}><IconFields size={16} /></span> Custom Fields</button>
                          <div style={s.divider} />
                          <button style={{ ...s.dropItem, color: '#b91c1c' }} onClick={() => deleteList(l)}><span style={s.dropIcon}><IconTrash size={16} /></span> Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {lists.length === 0 && <div style={s.listsEmpty}>No lists yet</div>}
                  <button style={s.addList} onClick={() => openCreateList(sp._id)}>
                    <IconPlus size={14} /> Create List
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button className="wg-sb-row" style={s.newSpace} onClick={() => setSpaceSetupOpen(true)}>
          <span style={s.newSpaceIcon}><IconPlus size={15} /></span> New Space
        </button>
      </div>

      {modals}
    </div>
  );
}

const s = {
  section: { marginTop: 10 },
  header: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 4px 12px' },
  heading: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', padding: 0 },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4, borderRadius: 6 },
  dropdown: { position: 'absolute', top: 'calc(100% + 2px)', right: 6, background: '#fff', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.25)', zIndex: 300, padding: 4, minWidth: 180 },
  dropItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontSize: 13.5, color: '#111827' },
  dropIcon: { width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', flexShrink: 0 },
  divider: { height: 1, background: '#f1f5f9', margin: '4px 0' },
  subMenu: { borderTop: '1px solid #f1f5f9', marginTop: 2, paddingTop: 2, maxHeight: 180, overflowY: 'auto' },
  list: { display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 },
  spaceRow: { position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 8, paddingRight: 6 },
  caret: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10, width: 18, flexShrink: 0, padding: 0 },
  spaceItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 6px', borderRadius: 8, color: '#475569', textDecoration: 'none', fontSize: 14, flex: 1, minWidth: 0 },
  activeRow: { background: '#f1f5f9', color: '#111827' },
  activeText: { color: '#111827', fontWeight: 600 },
  rowName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  // NOTE: don't set `display` here — the .wg-sb-actions CSS toggles it on hover.
  rowActions: { gap: 0 },
  // Task count pinned to the right corner; hidden on hover (CSS) so actions take its place.
  count: { marginLeft: 'auto', fontSize: 12.5, color: '#9ca3af', flexShrink: 0, paddingRight: 6, minWidth: 12, textAlign: 'right' },
  keyBadge: { width: 22, height: 22, borderRadius: 6, background: '#111827', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 },
  keyBadgeSm: { width: 18, height: 18, borderRadius: 5, background: '#111827', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9, flexShrink: 0 },
  lists: { display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 16, marginTop: 1 },
  listRow: { position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 8, paddingRight: 6 },
  listItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, color: '#64748b', textDecoration: 'none', fontSize: 13.5, flex: 1, minWidth: 0 },
  listIcon: { display: 'inline-flex', alignItems: 'center', color: '#64748b', flexShrink: 0 },
  listsEmpty: { color: '#64748b', fontSize: 12, padding: '4px 10px' },
  addList: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12.5, padding: '6px 8px', borderRadius: 8, textAlign: 'left' },
  newSpace: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13.5, padding: '7px 8px', marginTop: 2, borderRadius: 8, textAlign: 'left' },
  newSpaceIcon: { width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  empty: { color: '#64748b', fontSize: 13, padding: '6px 12px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, color: '#475569', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navIcon: { width: 22, textAlign: 'center', fontSize: 16, flexShrink: 0 },
};
