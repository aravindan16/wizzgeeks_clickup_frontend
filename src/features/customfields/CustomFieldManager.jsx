import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { customFieldsApi, FIELD_TYPES, FIELD_TYPE_LABEL } from './customFieldsApi';
import { listsApi } from '../lists/listsApi';
import { useToast } from '../../components/Toast';
import { useConfirm, usePrompt } from '../../components/ConfirmDialog';
import { IconFieldDropdown, IconFieldText, IconFieldRelationship, IconSearch, IconTrash, IconPlus, IconEdit, IconFields, IconListCheck, IconFilter } from '../../components/icons';
import Select from '../../components/Select';
import { Chevron } from '../../components/icons';

const TYPE_CMP = { dropdown: IconFieldDropdown, relationship: IconFieldRelationship, text: IconFieldText };
const TypeIcon = ({ type, size = 16 }) => { const C = TYPE_CMP[type] || IconFieldText; return <C size={size} />; };

// Table groups: List fields grouped by type; inherited Space fields under "Inherited".
const GROUPS = [
  { key: 'dropdown', label: 'Dropdown', type: 'dropdown', tint: '#dcfce7', fg: '#16a34a' },
  { key: 'relationship', label: 'Relationship', type: 'relationship', tint: '#e0e7ff', fg: '#000000' },
  { key: 'text', label: 'Text', type: 'text', tint: '#dbeafe', fg: '#111827' },
  { key: 'tasks', label: 'Inherited', type: null, tint: '#fef9c3', fg: '#854d0e' }, // Space-scoped fields inherited by this List
];
// Group by field type; Space fields shown *inherited* inside a List go under "Inherited".
const groupOf = (f) => (f.inherited ? 'tasks' : f.type);

const PALETTE = ['#6647f0', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a16207', '#6b7280', '#111827'];
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
let _seq = 0;
const uid = () => `o${_seq++}`;

/**
 * ClickUp-style "Custom Fields" manager. Lists fields with search + type filter,
 * Create New (type picker → right-side config panel per type), Add Existing
 * (reuse), and per-field Edit / Move / Delete.
 */
export default function CustomFieldManager({ open, onClose, scope, spaceId, listId, spaceName, listName }) {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [fields, setFields] = useState([]);
  const [lists, setLists] = useState([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [createMenu, setCreateMenu] = useState(false);
  const [typeQuery, setTypeQuery] = useState('');
  const [drawer, setDrawer] = useState(null);    // { mode:'create'|'edit', type, field }
  const [reuseOpen, setReuseOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);  // field id with open ⋯ menu
  const [moveFor, setMoveFor] = useState(null);
  const [dragField, setDragField] = useState(null); // field id being dragged (reorder)
  const [allFields, setAllFields] = useState([]); // every field in the space (for By-Location counts)
  const [loc, setLoc] = useState({ kind: 'space' }); // all | workspace | personal | space | {kind:'list',id,name}
  const [locSearch, setLocSearch] = useState('');
  const [spaceOpen, setSpaceOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const createRef = useRef(null);

  const loadLists = useCallback(async () => { setLists(await listsApi.forSpace(spaceId).catch(() => [])); }, [spaceId]);
  const loadCounts = useCallback(async () => { setAllFields(await customFieldsApi.listAll(spaceId).catch(() => [])); }, [spaceId]);
  const loadFields = useCallback(async () => {
    let fs = [];
    if (loc.kind === 'all' || loc.kind === 'workspace') fs = await customFieldsApi.listAll(spaceId).catch(() => []);
    else if (loc.kind === 'personal') fs = [];
    else if (loc.kind === 'list') fs = await customFieldsApi.list(spaceId, loc.id).catch(() => []);
    else fs = await customFieldsApi.list(spaceId, null).catch(() => []);
    setFields(fs);
  }, [spaceId, loc]);

  useEffect(() => {
    if (!open) return;
    setQuery(''); setTypeFilter('all'); setDrawer(null); setReuseOpen(false); setMoveFor(null); setRowMenu(null);
    setCreateMenu(false); setLocSearch(''); setSpaceOpen(true); setCollapsed(new Set());
    setLoc(scope === 'list' ? { kind: 'list', id: listId, name: listName } : { kind: 'space' });
  }, [open, scope, listId, listName]);

  useEffect(() => { if (open) loadLists(); }, [open, loadLists]);
  useEffect(() => { if (open) loadFields(); }, [open, loadFields]);
  useEffect(() => { if (open) loadCounts(); }, [open, loadCounts]);

  useEffect(() => {
    if (!createMenu) return undefined;
    const close = () => { setCreateMenu(false); setTypeQuery(''); };
    const onDoc = (e) => { if (createRef.current && !createRef.current.contains(e.target)) close(); };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    // Capture phase: the modal stops mousedown propagation, so a bubble listener never fires.
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc, true); document.removeEventListener('keydown', onEsc); };
  }, [createMenu]);

  const filtered = useMemo(() => fields.filter((f) =>
    (typeFilter === 'all' || f.type === typeFilter)
    && (!query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase()))
  ), [fields, query, typeFilter]);

  if (!open) return null;

  const createScope = loc.kind === 'list' ? 'list' : 'space';
  const createListId = loc.kind === 'list' ? loc.id : null;
  const headerName = loc.kind === 'all' ? 'All Custom Fields' : loc.kind === 'workspace' ? 'Workspace'
    : loc.kind === 'personal' ? 'Personal List' : loc.kind === 'list' ? loc.name : spaceName;
  const onSaved = () => { setDrawer(null); setReuseOpen(false); loadFields(); loadLists(); loadCounts(); };
  // Custom-field counts per location (Space fields are inherited by every List).
  const countSpace = allFields.filter((f) => f.scope === 'space').length;
  const countForList = (lid) => countSpace + allFields.filter((f) => f.scope === 'list' && f.list_id === lid).length;
  const toggleGroup = (k) => setCollapsed((set) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const del = async (f) => {
    setRowMenu(null);
    const ok = await confirm({ title: `Delete: ${f.name}`, message: 'This custom field will be deleted.' });
    if (ok) { await customFieldsApi.remove(f._id); toast.success('Field deleted'); loadFields(); loadCounts(); }
  };
  const move = async (f, target) => { setRowMenu(null); setMoveFor(null); await customFieldsApi.move(f._id, target); toast.success('Field moved'); loadFields(); loadCounts(); };
  const renameField = async (f) => {
    setRowMenu(null);
    const name = await prompt({ title: 'Rename field', defaultValue: f.name, placeholder: 'Field name', confirmLabel: 'Rename' });
    if (!name || !name.trim() || name.trim() === f.name) return;
    try { await customFieldsApi.update(f._id, { name: name.trim() }); toast.success('Field renamed'); loadFields(); loadCounts(); }
    catch (e) { toast.error(e.response?.data?.error?.message || 'Could not rename field'); }
  };
  // Enable/disable an inherited Space field for the List currently being viewed.
  const toggleListField = async (f) => {
    if (loc.kind !== 'list') return;
    const enable = f.enabled === false; // currently disabled → enable
    try {
      await customFieldsApi.setListEnabled(f._id, loc.id, enable);
      toast.success(enable ? 'Field enabled for this list' : 'Field disabled for this list');
      loadFields();
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Could not update field'); }
  };
  // Drag-to-reorder fields (only the editable, non-inherited ones; disabled while searching).
  const canReorder = !query.trim() && typeFilter === 'all';
  const reorderField = async (targetId) => {
    const src = dragField; setDragField(null);
    if (!src || src === targetId || !canReorder) return;
    const editable = fields.filter((f) => !f.inherited);
    const ids = editable.map((f) => f._id);
    const from = ids.indexOf(src);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const ordered = ids.map((id) => editable.find((f) => f._id === id));
    const others = fields.filter((f) => f.inherited);
    setFields([...others, ...ordered]);   // optimistic
    try { await customFieldsApi.reorder(ids); loadCounts(); }
    catch (e) { toast.error(e.response?.data?.error?.message || 'Could not reorder'); loadFields(); }
  };

  const navCls = (active) => `cf-nav${active ? ' active' : ''}`;
  const filteredLists = locSearch.trim() ? lists.filter((l) => l.name.toLowerCase().includes(locSearch.trim().toLowerCase())) : lists;

  return (
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        {/* ===== LEFT SIDEBAR ===== */}
        <aside style={s.nav}>
          <div style={s.navTitle}>Custom Field Manager</div>

          <div style={{ padding: '0 8px 8px' }}>
            <div style={{ position: 'relative' }}>
              <span style={s.navSearchIcon}><IconSearch size={15} /></span>
              <input style={s.navSearch} placeholder="Search…" value={locSearch} onChange={(e) => setLocSearch(e.target.value)} />
            </div>
          </div>

          <div style={s.spaceRow}>
            <button style={s.caret} onClick={() => setSpaceOpen((o) => !o)} title={spaceOpen ? 'Collapse' : 'Expand'}><Chevron open={spaceOpen} size={13} /></button>
            <button className={navCls(loc.kind === 'space')} style={{ ...s.navItem, flex: 1, margin: 0 }} onClick={() => setLoc({ kind: 'space' })}>
              <span style={s.spaceBadge}>{(spaceName || '?')[0].toUpperCase()}</span>
              <span style={s.navName}>{spaceName}</span>
            </button>
          </div>
          {spaceOpen && filteredLists.map((l) => (
            <button key={l._id} className={navCls(loc.kind === 'list' && loc.id === l._id)} style={{ ...s.navItem, paddingLeft: 34 }}
              onClick={() => setLoc({ kind: 'list', id: l._id, name: l.name })}>
              <span style={s.listIcon}><IconListCheck size={15} /></span>
              <span style={s.navName}>{l.name}</span>
              <span style={s.count}>{countForList(l._id)}</span>
            </button>
          ))}
        </aside>

        {/* ===== MAIN ===== */}
        <div style={s.main}>
          <div style={s.head}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {loc.kind === 'list' ? <span style={s.listIcon}><IconListCheck size={16} /></span> : <span style={s.spaceBadge}>{(spaceName || '?')[0].toUpperCase()}</span>}
              <strong style={{ fontSize: 17 }}>{headerName}</strong>
            </div>
            <button className="icon-btn" onClick={onClose} title="Close">✕</button>
          </div>

          <div style={s.toolbar}>
            <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
              <span style={s.searchIcon}><IconSearch size={15} /></span>
              <input style={s.search} placeholder="Search fields..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={typeFilter} onChange={setTypeFilter} style={{ minWidth: 140 }}
              options={[{ value: 'all', label: 'Field type' }, ...FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))]} />
            <button style={s.filterBtn} title="Filter"><IconFilter size={15} /> Filter</button>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }} ref={createRef}>
              <button style={s.createBtn} onClick={() => setCreateMenu((o) => !o)}>Create New</button>
              {createMenu && (
                <>
                  <div style={s.createScrim} onMouseDown={() => { setCreateMenu(false); setTypeQuery(''); }} />
                  <div style={s.typeMenu} role="menu" onMouseDown={(e) => e.stopPropagation()}>
                  <div style={s.typeMenuTop}>
                    <span style={s.typeMenuHead}>Field type</span>
                    <button className="icon-btn" style={{ fontSize: 13 }} title="Close" onClick={() => { setCreateMenu(false); setTypeQuery(''); }}>✕</button>
                  </div>
                  <div style={s.typeSearchWrap}>
                    <span style={s.typeSearchIcon}><IconSearch size={15} /></span>
                    <input autoFocus style={s.typeSearch} placeholder="Search..." value={typeQuery} onChange={(e) => setTypeQuery(e.target.value)} />
                  </div>
                  {FIELD_TYPES.filter((t) => !typeQuery.trim() || t.label.toLowerCase().includes(typeQuery.trim().toLowerCase())).map((t) => (
                    <button key={t.value} style={s.typeMenuItem}
                      onClick={() => { setCreateMenu(false); setTypeQuery(''); setDrawer({ mode: 'create', type: t.value }); }}>
                      <span style={s.typeMenuIcon}><TypeIcon type={t.value} size={16} /></span>
                      <span><span style={{ fontWeight: 600 }}>{t.label}</span><div style={{ fontSize: 11, color: '#6b7280' }}>{t.desc}</div></span>
                    </button>
                  ))}
                  {FIELD_TYPES.every((t) => typeQuery.trim() && !t.label.toLowerCase().includes(typeQuery.trim().toLowerCase()))
                    && <div style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 13 }}>No matching field type</div>}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th><th style={s.th}>Type</th><th style={s.th}>Created by</th>
                  <th style={s.th}>Date Created</th><th style={s.th}>Location(s)</th><th style={{ ...s.th, width: 64 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6}><div className="wg-empty"><span className="wg-empty-emoji">🧩</span>No custom fields here yet.</div></td></tr>
                )}

                {GROUPS.map((g) => {
                  const rows = filtered.filter((f) => groupOf(f) === g.key);
                  if (rows.length === 0) return null;            // only show groups that have fields
                  const isOpen = !collapsed.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr>
                        <td colSpan={6} style={s.groupTd}>
                          <button style={s.groupBtn} onClick={() => toggleGroup(g.key)}>
                            <span style={{ color: '#9ca3af', display: 'inline-flex' }}><Chevron open={isOpen} size={12} /></span>
                            <span style={{ ...s.groupChip, background: g.tint, color: g.fg }}>
                              {g.type ? <TypeIcon type={g.type} size={13} /> : <IconFieldRelationship size={13} />}
                              {g.label}
                            </span>
                            <span style={s.count}>{rows.length}</span>
                          </button>
                        </td>
                      </tr>

                      {isOpen && rows.map((f) => (
                        <tr key={f._id} className="cf-row" style={s.row}
                          draggable={canReorder && !f.inherited}
                          onDragStart={() => !f.inherited && setDragField(f._id)}
                          onDragOver={(e) => { if (dragField && !f.inherited) e.preventDefault(); }}
                          onDrop={() => reorderField(f._id)}>
                          <td style={s.td}>
                            <span style={s.fieldName}>
                              {canReorder && !f.inherited && <span style={s.rowDrag} title="Drag to reorder">⠿</span>}
                              <span style={s.typeIcon}><TypeIcon type={f.type} size={14} /></span>{f.name}
                            </span>
                          </td>
                          <td style={s.td}><span style={s.typePill}><TypeIcon type={f.type} size={14} /> {FIELD_TYPE_LABEL[f.type]}</span></td>
                          <td style={s.td}><span style={s.creator}><span style={s.avatar}>{initials(f.created_by_name)}</span>{f.created_by_name || '—'}</span></td>
                          <td style={s.td}>{fmtDate(f.created_at)}</td>
                          <td style={s.td}><span style={s.locPill}>{f.location || '—'}</span>{f.inherited && <span style={s.inheritTag}>inherited</span>}</td>
                          <td style={{ ...s.td, position: 'relative' }}>
                            <div style={s.actionsCell}>
                              {f.inherited && loc.kind === 'list' && (() => {
                                // A relationship field pointing at the List you're currently
                                // viewing (e.g. "Epic" → EPICS while in EPICS) is always on for
                                // that List — its toggle is read-only. Fields pointing at other
                                // Lists (e.g. "Sprint" → SPRINTS) stay freely enable/disable.
                                const ownList = f.type === 'relationship'
                                  && f.config?.related_to === 'list'
                                  && String(f.config?.list_id || '') === String(loc.id || '');
                                return (
                                  <span style={s.toggleCell} title={ownList
                                    ? 'Always enabled — this field pulls tasks from this list'
                                    : (f.enabled === false ? 'Disabled for this list — turn on to use it here' : 'Enabled for this list')}>
                                    <Switch on={ownList ? true : f.enabled !== false} onClick={() => toggleListField(f)} disabled={ownList} />
                                    <span style={{ ...s.toggleLabel, color: (!ownList && f.enabled === false) ? '#9ca3af' : '#16a34a' }}>
                                      {(!ownList && f.enabled === false) ? 'Disabled' : 'Enabled'}
                                    </span>
                                  </span>
                                );
                              })()}
                              <button className="icon-btn" style={s.dots} onClick={() => { setRowMenu(rowMenu === f._id ? null : f._id); setMoveFor(null); }}>⋯</button>
                            </div>
                            {rowMenu === f._id && (
                              <>
                                <div style={s.menuScrim} onMouseDown={() => { setRowMenu(null); setMoveFor(null); }} />
                                <div style={s.rowMenu} onMouseDown={(e) => e.stopPropagation()}>
                                  <button style={s.menuItem} onClick={() => { setRowMenu(null); setDrawer({ mode: 'edit', type: f.type, field: f }); }}>
                                    <IconFields size={15} /><span>Edit</span>
                                  </button>
                                  <button style={s.menuItem} onClick={() => renameField(f)}>
                                    <IconEdit size={15} /><span>Rename</span>
                                  </button>
                                  <div style={s.menuDivider} />
                                  <button style={{ ...s.menuItem, color: '#b91c1c' }} onClick={() => del(f)}>
                                    <IconTrash size={15} /><span>Delete</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}

                      {isOpen && (
                        <tr><td colSpan={6} style={s.createFieldTd}>
                          <button style={s.createFieldLink}
                            onClick={() => (g.type ? setDrawer({ mode: 'create', type: g.type }) : setCreateMenu(true))}>
                            + Create {g.label.toLowerCase()} field
                          </button>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right config panel — contained INSIDE the modal (not full-viewport) */}
        {drawer && (
          <FieldDrawer key={drawer.field?._id || drawer.type} {...drawer} scope={createScope} spaceId={spaceId} listId={createListId} lists={lists}
            onClose={() => setDrawer(null)} onSaved={onSaved} />
        )}
        {reuseOpen && (
          <ReuseDrawer spaceId={spaceId} listId={createListId} scope={createScope} onClose={() => setReuseOpen(false)} onAdded={onSaved} />
        )}
      </div>
    </div>
  );
}

/* ===================== Right-side field config panel ===================== */
function FieldDrawer({ mode, type: initialType, field, scope, spaceId, listId, lists, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = mode === 'edit';
  const cfg = field?.config || {};
  const [type, setType] = useState(initialType);
  const [typeMenu, setTypeMenu] = useState(false);
  const [name, setName] = useState(field?.name || '');
  const [options, setOptions] = useState(() =>
    (cfg.options || [{ label: 'Option 1', color: '#6647f0' }, { label: 'Option 2', color: '#ef4444' }]).map((o) => ({ ...o, _id: uid() })));
  const [multiline, setMultiline] = useState(cfg.multiline || false);
  const [multiple, setMultiple] = useState(cfg.multiple || false);
  const [relatedTo, setRelatedTo] = useState(cfg.related_to || 'workspace');
  const [relList, setRelList] = useState(cfg.list_id || '');
  const [rollup, setRollup] = useState(cfg.rollup || false);
  const [fillMethod, setFillMethod] = useState(cfg.fill_method || 'manual');
  const [colorFor, setColorFor] = useState(null);
  const [dragOpt, setDragOpt] = useState(null);
  const [saving, setSaving] = useState(false);

  const setOpt = (id, patch) => setOptions((os) => os.map((o) => (o._id === id ? { ...o, ...patch } : o)));
  const addOpt = () => setOptions((os) => [...os, { _id: uid(), label: `Option ${os.length + 1}`, color: PALETTE[os.length % PALETTE.length] }]);
  const delOpt = (id) => setOptions((os) => os.filter((o) => o._id !== id));
  const setDefaultOpt = (id) => setOptions((os) => os.map((o) => ({ ...o, default: o._id === id ? !o.default : false })));
  const dropOpt = (targetId) => {
    if (!dragOpt || dragOpt === targetId) { setDragOpt(null); return; }
    setOptions((os) => {
      const item = os.find((o) => o._id === dragOpt);
      const without = os.filter((o) => o._id !== dragOpt);
      const to = without.findIndex((o) => o._id === targetId);
      without.splice(to < 0 ? without.length : to, 0, item);
      return without;
    });
    setDragOpt(null);
  };

  const buildConfig = () => {
    if (type === 'dropdown') return { options: options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), color: o.color, ...(o.default ? { default: true } : {}) })), multiple, fill_method: fillMethod };
    if (type === 'text') return { multiline, fill_method: fillMethod };
    return { target: 'task', related_to: relatedTo, list_id: relatedTo === 'list' ? relList || null : null, rollup };
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Field name is required'); return; }
    if (type === 'dropdown' && !options.some((o) => o.label.trim())) { toast.error('Add at least one option'); return; }
    if (type === 'relationship' && relatedTo === 'list' && !relList) { toast.error('Choose a List'); return; }
    setSaving(true);
    try {
      if (isEdit) await customFieldsApi.update(field._id, { name: name.trim(), config: buildConfig() });
      else await customFieldsApi.create({ scope, space_id: spaceId, list_id: listId || null, name: name.trim(), type, config: buildConfig() });
      toast.success(isEdit ? 'Field updated' : 'Field created');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Could not save field'); }
    finally { setSaving(false); }
  };

  const headerLabel = type === 'relationship' ? 'Tasks' : FIELD_TYPE_LABEL[type];

  return (
    <>
      <div style={d.scrim} onMouseDown={onClose} />
      <div style={d.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={d.head}>
          <div style={{ position: 'relative' }}>
            <button style={d.typeBtn} disabled={isEdit} onClick={() => !isEdit && setTypeMenu((o) => !o)}>
              <TypeIcon type={type} size={18} /> {headerLabel} {!isEdit && <span style={{ color: '#9ca3af' }}>⌄</span>}
            </button>
            {typeMenu && (
              <div style={d.typeMenu}>
                {FIELD_TYPES.map((t) => (
                  <button key={t.value} style={d.typeMenuItem} onClick={() => { setType(t.value); setTypeMenu(false); }}>
                    <span style={s.typeMenuIcon}><TypeIcon type={t.value} size={16} /></span> {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div style={d.body}>
          {/* RELATIONSHIP */}
          {type === 'relationship' ? (
            <>
              <Label req>Relationship name</Label>
              <input autoFocus style={d.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name…" />

              <Label>Related to</Label>
              <Radio checked={relatedTo === 'workspace'} onChange={() => setRelatedTo('workspace')} label="any task in your Workspace" />
              <Radio checked={relatedTo === 'list'} onChange={() => setRelatedTo('list')} label="tasks from a specific List" />
              {relatedTo === 'list' && (
                <Select style={{ marginTop: 6 }} value={relList} onChange={setRelList} placeholder="Select a List…"
                  options={[{ value: '', label: 'Select a List…' }, ...lists.map((l) => ({ value: l._id, label: l.name }))]} />
              )}
            </>
          ) : (
            <>
              <Label req>Field name</Label>
              <input autoFocus style={d.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name…" />

              {type === 'dropdown' && (
                <>
                  <div style={d.optHead}>
                    <span style={d.lbl2}>Dropdown options<span style={{ color: '#ef4444' }}> *</span></span>
                    <button type="button" style={d.manualPill} title="Order">⇅ Manual</button>
                  </div>
                  {options.map((o) => (
                    <div key={o._id} style={d.optRow}
                      draggable onDragStart={() => setDragOpt(o._id)}
                      onDragOver={(e) => e.preventDefault()} onDrop={() => dropOpt(o._id)}>
                      <span style={d.dragHandle} title="Drag to reorder">⠿</span>
                      <div style={d.optBox}>
                        <button style={{ ...d.optDot, background: o.color }} title="Color" onClick={() => setColorFor(colorFor === o._id ? null : o._id)} />
                        <input style={d.optInput} value={o.label} onChange={(e) => setOpt(o._id, { label: e.target.value })} />
                        <button style={{ ...d.setDefault, ...(o.default ? d.setDefaultOn : {}) }} onClick={() => setDefaultOpt(o._id)}>
                          {o.default ? 'Default' : 'Set default'}
                        </button>
                        <button style={d.optTrash} onClick={() => delOpt(o._id)} title="Remove"><IconTrash size={15} /></button>
                        {colorFor === o._id && (
                          <div style={d.colorPop} onMouseDown={(e) => e.stopPropagation()}>
                            {PALETTE.map((c) => (
                              <button key={c} style={{ ...d.colorDot, background: c, outline: o.color === c ? '2px solid #111827' : 'none' }}
                                onClick={() => { setOpt(o._id, { color: c }); setColorFor(null); }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <button style={d.addOpt} onClick={addOpt}><IconPlus size={15} /> Add option</button>
                </>
              )}
            </>
          )}
        </div>

        <div style={d.footer}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create')}
          </button>
        </div>
      </div>
    </>
  );
}

/* ===================== Add Existing (reuse) ===================== */
function ReuseDrawer({ spaceId, listId, scope, onClose, onAdded }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  useEffect(() => { customFieldsApi.reusable(spaceId, listId).then(setItems).catch(() => setItems([])); }, [spaceId, listId]);
  const add = async (f) => { await customFieldsApi.duplicate(f._id, { scope, space_id: spaceId, list_id: listId || null }); toast.success('Field added'); onAdded(); };
  return (
    <>
      <div style={d.scrim} onMouseDown={onClose} />
      <div style={d.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={d.head}><strong>Add Existing field</strong><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div style={d.body}>
          {items === null && <p style={{ color: '#6b7280' }}>Loading…</p>}
          {items && items.length === 0 && <div className="wg-empty"><span className="wg-empty-emoji">🧩</span>No reusable fields elsewhere in this Space.</div>}
          {items && items.map((f) => (
            <div key={f._id} style={d.reuseRow}>
              <span style={s.fieldName}><span style={s.typeIcon}><TypeIcon type={f.type} size={14} /></span>{f.name}</span>
              <span className="chip">{FIELD_TYPE_LABEL[f.type]}</span>
              <span style={{ color: '#6b7280', fontSize: 12, flex: 1 }}>{f.location}</span>
              <button className="btn btn-ghost" onClick={() => add(f)}>Add</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---- small building blocks ---- */
const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;
const Label = ({ children, req }) => <div style={d.label}>{children}{req && <span style={{ color: '#ef4444' }}> *</span>}</div>;
function Radio({ checked, onChange, label }) {
  return (
    <button type="button" style={d.radioRow} onClick={onChange}>
      <span style={{ ...d.radio, ...(checked ? d.radioOn : {}) }}>{checked && <span style={d.radioDot} />}</span>
      <span style={{ color: checked ? '#111827' : '#374151' }}>{label}</span>
    </button>
  );
}
function Switch({ on, onClick, disabled = false }) {
  return (
    <button type="button" disabled={disabled} onClick={disabled ? undefined : onClick}
      style={{ ...d.switch, ...(on ? d.switchOn : {}), ...(disabled ? { cursor: 'default', opacity: 0.7 } : {}) }}>
      <span style={{ ...d.knob, ...(on ? d.knobOn : {}) }} />
    </button>
  );
}
function Segmented({ value, options, onChange }) {
  return (
    <div style={d.seg}>
      {options.map(([val, label]) => (
        <button key={val} type="button" style={{ ...d.segBtn, ...(value === val ? d.segBtnOn : {}) }} onClick={() => onChange(val)}>{label}</button>
      ))}
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px' },
  modal: { position: 'relative', background: '#fff', borderRadius: 12, width: 1440, maxWidth: '97vw', height: '90vh', boxShadow: '0 20px 50px rgba(16,24,40,.18)', display: 'flex', overflow: 'hidden', fontSize: 14 },

  nav: { width: 232, flexShrink: 0, borderRight: '1px solid #E5E7EB', background: '#fff', padding: 12, overflowY: 'auto' },
  navTitle: { fontSize: 13, fontWeight: 700, color: '#111827', padding: '6px 10px 12px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, margin: '1px 0' },
  navDivider: { height: 1, background: '#E5E7EB', margin: '10px 6px' },
  navSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#6b7280', fontWeight: 600, padding: '4px 10px 6px' },
  navSearch: { width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 },
  navSearchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  navName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  count: { color: '#9ca3af', fontSize: 12, fontWeight: 600, flexShrink: 0 },
  spaceRow: { display: 'flex', alignItems: 'center' },
  caret: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 10, width: 18, flexShrink: 0, padding: 0 },
  spaceBadge: { width: 22, height: 22, borderRadius: 6, background: 'var(--c-primary)', color: 'var(--c-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 },
  listIcon: { color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, flexShrink: 0 },

  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'hidden' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: .6 },
  search: { width: '100%', boxSizing: 'border-box', padding: '9px 11px 9px 32px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14 },
  filterBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151', whiteSpace: 'nowrap' },
  createBtn: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  createScrim: { position: 'fixed', inset: 0, zIndex: 19 },
  typeMenu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.18)', zIndex: 21, padding: 6, width: 300 },
  typeMenuTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 4px' },
  typeSearchWrap: { position: 'relative', padding: '4px 4px 8px' },
  typeSearchIcon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  typeSearch: { width: '100%', boxSizing: 'border-box', padding: '9px 10px 9px 34px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14 },
  typeMenuHead: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', padding: '4px 8px' },
  typeMenuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: 14 },
  typeMenuIcon: { width: 26, height: 26, borderRadius: 7, background: '#F3F0FF', color: '#111827', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 },

  tableWrap: { flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#fff', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 1 },
  groupTd: { padding: 0, background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  groupBtn: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 16px', fontSize: 14, color: '#374151' },
  groupIcon: { width: 18, height: 18, borderRadius: 5, background: '#e0e7ff', color: '#000000', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 },
  groupChip: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderRadius: 6, padding: '2px 9px' },
  row: { height: 56 },
  td: { padding: '0 16px', fontSize: 14, borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle', color: '#374151' },
  fieldName: { display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 600, color: '#111827' },
  rowDrag: { color: '#cbd5e1', cursor: 'grab', fontSize: 13, marginRight: -4, userSelect: 'none' },
  typeIcon: { width: 24, height: 24, borderRadius: 6, background: '#F3F0FF', color: '#111827', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 },
  typePill: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' },
  creator: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 },
  locPill: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', background: '#F3F4F6', borderRadius: 6, padding: '3px 10px' },
  inheritTag: { marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#92740a', background: '#fef9c3', borderRadius: 999, padding: '1px 7px' },
  actionsCell: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, whiteSpace: 'nowrap' },
  toggleCell: { display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 },
  toggleLabel: { fontSize: 12, fontWeight: 600, minWidth: 52 },
  dots: { fontSize: 18, color: '#9ca3af', lineHeight: 1 },
  menuScrim: { position: 'fixed', inset: 0, zIndex: 30 },
  rowMenu: { position: 'absolute', top: 'calc(50% + 10px)', right: 14, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 14px 34px rgba(16,24,40,.18)', zIndex: 31, padding: 5, minWidth: 200, textAlign: 'left' },
  menuItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, fontSize: 14, color: '#374151' },
  subMenu: { borderTop: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', margin: '3px 0', padding: '3px 0', maxHeight: 180, overflowY: 'auto' },
  menuDivider: { height: 1, background: '#F3F4F6', margin: '4px 0' },
  createFieldTd: { padding: '6px 16px', borderBottom: 'none' },
  createFieldLink: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '6px 0' },
};

const d = {
  scrim: { position: 'absolute', inset: 0, background: 'rgba(15,23,42,.18)', zIndex: 90, borderRadius: 12 },
  panel: { position: 'absolute', top: 0, right: 0, height: '100%', width: 460, maxWidth: '64%', background: '#fff', zIndex: 91, boxShadow: '-16px 0 44px rgba(16,24,40,.18)', borderTopRightRadius: 12, borderBottomRightRadius: 12, display: 'flex', flexDirection: 'column', animation: 'wg-pop 160ms ease' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' },
  typeBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#111827' },
  typeMenu: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 16px 36px rgba(0,0,0,.2)', zIndex: 5, padding: 6, width: 200 },
  typeMenuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: 14 },
  body: { flex: 1, overflowY: 'auto', padding: 20 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', margin: '16px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  radioRow: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 0', fontSize: 14 },
  radio: { width: 18, height: 18, borderRadius: '50%', border: '2px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioOn: { borderColor: '#111827' },
  radioDot: { width: 9, height: 9, borderRadius: '50%', background: '#111827' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 14 },
  switch: { width: 38, height: 22, borderRadius: 999, border: 'none', background: 'var(--c-border)', cursor: 'pointer', padding: 2, display: 'inline-flex' },
  switchOn: { background: 'var(--c-primary)' },
  knob: { width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'transform .15s', boxShadow: '0 1px 2px rgba(0,0,0,.25)' },
  knobOn: { transform: 'translateX(16px)' },
  optHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' },
  lbl2: { fontSize: 13, fontWeight: 600, color: '#374151' },
  manualPill: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#475569',
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' },
  optRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 },
  dragHandle: { color: '#cbd5e1', cursor: 'grab', fontSize: 13, flexShrink: 0, width: 12, textAlign: 'center' },
  optBox: { position: 'relative', flex: 1, display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px' },
  optDot: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #d1d5db', cursor: 'pointer', flexShrink: 0 },
  optInput: { flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', minWidth: 0 },
  setDefault: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 },
  setDefaultOn: { color: '#111827', fontWeight: 600 },
  optTrash: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex', flexShrink: 0, padding: 0 },
  addOpt: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginLeft: 18,
    background: 'none', border: '1px dashed #d1d5db', borderRadius: 10, color: '#111827', cursor: 'pointer', padding: '9px 10px', fontWeight: 600, fontSize: 13, width: 'calc(100% - 18px)' },
  colorPop: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.2)', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, width: 188 },
  colorDot: { width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer' },
  seg: { display: 'flex', gap: 0, border: '1px solid #e5e7eb', borderRadius: 10, padding: 3, background: '#f8fafc' },
  segBtn: { flex: 1, padding: '8px 10px', border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#6b7280' },
  segBtnOn: { background: '#fff', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,.08)' },
  moreRow: { marginTop: 22, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontSize: 14 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #f1f5f9' },
  reuseRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
  switchRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16,
    border: '1px solid #f1f5f9', borderRadius: 10, padding: '12px 14px' },
  switchTitle: { fontSize: 14, fontWeight: 600, color: '#374151' },
  switchSub: { fontSize: 12.5, color: '#9ca3af', marginTop: 2 },
};
