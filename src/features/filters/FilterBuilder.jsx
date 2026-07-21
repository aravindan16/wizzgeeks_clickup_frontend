import { useEffect, useRef, useState } from 'react';
import Select from '../../components/Select';
import { IconPlus, IconTrash, IconUser, IconSearch, IconChevronDown } from '../../components/icons';

/**
 * Reusable ClickUp/Jira-style filter builder (the "Where … Is … / Add filter /
 * nested" UI from the Filters page). Used by the Filters page and by the Space /
 * List board so both share the exact same filter experience.
 *
 * Props:
 *   cards, onCards(setter)   — the builder tree (array of group cards) + its React setter
 *   conj, onConj             — AND/OR join between top-level cards
 *   options                  — { projects, lists, statuses, users, myId, customFields, tasks, labels }
 *   footerExtra              — optional node rendered next to "Clear all" (e.g. Save filter)
 */

export const OPS = [{ value: 'is', label: 'Is' }, { value: 'is_not', label: 'Is not' }];
export const TASK_TYPES = [{ value: 'task', label: 'Task' }, { value: 'bug', label: 'Bug' }, { value: 'subtask', label: 'Subtask' }];
export const FIELDS = [
  { key: 'space', label: 'Space' },
  { key: 'list', label: 'List' },
  { key: 'type', label: 'Task type' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'reporter', label: 'Reporter' },
  { key: 'label', label: 'Label' },
];
export const MULTI_FIELDS = new Set(['list', 'type', 'status', 'assignee', 'reporter', 'label']);
export const AND_OR = [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }];
export const emptyValue = (field) => (MULTI_FIELDS.has(field) ? [] : '');

let _seq = 0;
// Collision-proof node id (counter + random suffix) so newly added rules never
// share an id with the sequential ids baked into a previously-saved/persisted tree.
const nid = () => `n${_seq++}_${Math.random().toString(36).slice(2, 9)}`;
export const mkRule = (field = 'status') => ({ id: nid(), type: 'rule', field, op: 'is', value: emptyValue(field) });
export const mkGroup = (field) => ({ id: nid(), type: 'group', conj: 'AND', children: [mkRule(field)] });
export const newGroup = () => mkGroup('status');
export const collectFields = (node, set = new Set()) => {
  if (node.type === 'group') node.children.forEach((c) => collectFields(c, set));
  else set.add(node.field);
  return set;
};
const hasId = (node, id) => node.id === id || (node.type === 'group' && node.children.some((c) => hasId(c, id)));
const firstUnusedField = (used) => (FIELDS.find((f) => !used.has(f.key)) || FIELDS[0]).key;
const mapTree = (node, id, fn) => {
  if (node.id === id) return fn(node);
  if (node.type === 'group') return { ...node, children: node.children.map((c) => mapTree(c, id, fn)) };
  return node;
};
const removeFromTree = (node, id) => {
  if (node.type !== 'group') return node;
  const children = node.children
    .filter((c) => c.id !== id)
    .map((c) => removeFromTree(c, id))
    .filter((c) => !(c.type === 'group' && c.children.length === 0));
  return { ...node, children };
};
export const ruleActive = (r) => (Array.isArray(r.value) ? r.value.length > 0 : (r.value !== '' && r.value != null));
export const nodeActive = (n) => (n.type === 'group' ? n.children.some(nodeActive) : ruleActive(n));

// Count active rules across all cards (for a "Filter" badge).
export const activeRuleCount = (cards) => {
  let n = 0;
  const scan = (node) => { if (node.type === 'group') node.children.forEach(scan); else if (ruleActive(node)) n += 1; };
  (cards || []).forEach(scan);
  return n;
};

export default function FilterBuilder({ cards, onCards, conj, onConj, options, footerExtra }) {
  const setNode = (id, fn) => onCards((cs) => cs.map((c) => mapTree(c, id, fn)));
  const removeNode = (id) => onCards((cs) => {
    const next = cs.map((c) => removeFromTree(c, id)).filter((c) => c.children.length > 0);
    return next.length ? next : [newGroup()];
  });
  const addToCard = (groupId, make) => onCards((cs) => cs.map((card) => {
    if (!hasId(card, groupId)) return card;
    const field = firstUnusedField(collectFields(card));
    return mapTree(card, groupId, (gp) => ({ ...gp, children: [...gp.children, make(field)] }));
  }));
  const addRule = (groupId) => addToCard(groupId, mkRule);
  const addNested = (groupId) => addToCard(groupId, mkGroup);
  const addCard = () => onCards((cs) => [...cs, newGroup()]);
  const setValue = (ruleId, field, value) => onCards((cs) => cs.map((card) => {
    if (!hasId(card, ruleId)) return card;
    const clear = field === 'space' ? new Set(['list', 'status']) : field === 'list' ? new Set(['status']) : null;
    const transform = (node) => {
      if (node.type === 'group') return { ...node, children: node.children.map(transform) };
      if (node.id === ruleId) return { ...node, value };
      if (clear && clear.has(node.field)) return { ...node, value: emptyValue(node.field) };
      return node;
    };
    return transform(card);
  }));
  const clearAll = () => { onCards([newGroup()]); onConj('AND'); };

  return (
    <div style={s.builder}>
      {cards.map((card, ci) => (
        <div key={card.id} style={s.cardBlock}>
          {ci > 0 && (
            <div style={s.cardDivider}>
              {ci === 1
                ? <div style={{ width: 84 }}><Select value={conj} onChange={onConj} options={AND_OR} /></div>
                : <span style={s.cardDividerText}>{conj}</span>}
            </div>
          )}
          <FilterGroup node={card} setNode={setNode} removeNode={removeNode} onValue={setValue}
            addRule={addRule} addNested={addNested} options={options} usedFields={collectFields(card)} isRoot />
        </div>
      ))}
      <div style={s.builderFooter}>
        <button type="button" className="btn" style={g.addFilter} onClick={addCard}>
          <IconPlus size={14} /> Add filter
        </button>
        <div style={s.footerRight}>
          <button type="button" className="btn" style={s.clearAllBtn} onClick={clearAll}>Clear all</button>
          {footerExtra}
        </div>
      </div>
    </div>
  );
}

function Connector({ i, conj, onConj }) {
  return (
    <div style={g.connCol}>
      {i === 0 ? <span style={g.where}>Where</span>
        : i === 1 ? <Select value={conj} onChange={onConj} options={AND_OR} />
          : <span style={g.conjText}>{conj}</span>}
    </div>
  );
}

function FilterGroup({ node, setNode, removeNode, onValue, addRule, addNested, options, usedFields, isRoot }) {
  const rows = node.children.map((child, i) => {
    const firstInNested = !isRoot && i === 0;
    return (
      <div key={child.id} style={child.type === 'group' ? g.rowTop : g.row}>
        {!firstInNested && <Connector i={i} conj={node.conj} onConj={(v) => setNode(node.id, (n) => ({ ...n, conj: v }))} />}
        {child.type === 'group'
          ? <FilterGroup node={child} setNode={setNode} removeNode={removeNode} onValue={onValue} addRule={addRule} addNested={addNested} options={options} usedFields={usedFields} isRoot={false} />
          : <RuleCols rule={child} setNode={setNode} onValue={onValue} onRemove={() => removeNode(child.id)} options={options} usedFields={usedFields} />}
      </div>
    );
  });
  const nestedLink = (
    <div style={isRoot ? g.nestedLinkRow : g.nestedLinkFlush}>
      <button type="button" style={g.linkBtn} onClick={() => addNested(node.id)}>Add nested filter</button>
    </div>
  );
  if (isRoot) return <div style={g.panel}>{rows}{nestedLink}</div>;
  return <div style={g.nested}>{rows}</div>;
}

function RuleCols({ rule, setNode, onValue, onRemove, options, usedFields }) {
  const set = (patch) => setNode(rule.id, (n) => ({ ...n, ...patch }));
  const setVal = (v) => onValue(rule.id, rule.field, v);
  const cfDefs = options.customFields || [];
  const allFields = [...FIELDS.map((f) => ({ value: f.key, label: f.label })),
    ...cfDefs.map((c) => ({ value: c.key, label: c.label }))];
  const fieldOpts = allFields.filter((f) => f.value === rule.field || !usedFields?.has(f.value));
  const emptyFor = (v) => {
    if (v.startsWith('cf:')) return (cfDefs.find((c) => c.key === v)?.type === 'text') ? '' : [];
    return emptyValue(v);
  };
  return (
    <>
      <div style={g.fieldCol}>
        <Select value={rule.field} onChange={(v) => set({ field: v, value: emptyFor(v) })} options={fieldOpts} />
      </div>
      <div style={g.opCol}>
        <Select value={rule.op} onChange={(v) => set({ op: v })} options={OPS} />
      </div>
      <div style={g.valCol}>
        <ValueEditor rule={rule} setVal={setVal} options={options} />
      </div>
      <button type="button" className="icon-btn" style={g.trash} onClick={onRemove} title="Remove"><IconTrash size={16} /></button>
    </>
  );
}

function ValueEditor({ rule, setVal, options }) {
  const active = ruleActive(rule);
  const arr = Array.isArray(rule.value) ? rule.value : [];
  if (rule.field.startsWith('cf:')) {
    const cf = (options.customFields || []).find((c) => c.key === rule.field);
    if (!cf) return <Select placeholder="Select option" value="" onChange={() => {}} options={[]} disabled />;
    if (cf.type === 'text') return <TextFilter value={rule.value} onChange={setVal} active={active} />;
    if (cf.type === 'dropdown') {
      const opts = (cf.config?.options || []).map((o) => ({ value: o.label, label: o.label }));
      return <MultiSelect active={active} value={arr} onChange={setVal} options={opts} placeholder="Select options" />;
    }
    const relList = cf.config?.related_to === 'list' && cf.config?.list_id ? String(cf.config.list_id) : null;
    const opts = (options.tasks || [])
      .filter((t) => !relList || String(t.list_id) === relList)
      .slice(0, 300)
      .map((t) => ({ value: t._id, label: `${t.key ? t.key + ' · ' : ''}${t.title || ''}` }));
    return <MultiSelect active={active} value={arr} onChange={setVal} options={opts} placeholder="Select tasks" />;
  }
  if (rule.field === 'space')
    return <Select placeholder="Select option" value={rule.value} onChange={setVal}
      options={(options.projects || []).map((p) => ({ value: p._id, label: p.name || p.key }))} />;
  if (rule.field === 'type')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={TASK_TYPES} placeholder="Select types" />;
  if (rule.field === 'status')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.statuses || []} placeholder="Select statuses" />;
  if (rule.field === 'list')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.lists || []} placeholder="Select lists" />;
  if (rule.field === 'label')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.labels || []} placeholder="Select labels" />;
  return <UserPicker active={active} value={arr} onChange={setVal} users={options.users || []}
    myId={options.myId} allowUnassigned={rule.field === 'assignee'} />;
}

function TextFilter({ value, onChange }) {
  return (
    <input value={value || ''} placeholder="Contains text…" onChange={(e) => onChange(e.target.value)}
      className="wg-select-trigger" style={{ ...g.trigger, cursor: 'text' }} />
  );
}

function MultiSelect({ value, onChange, options, placeholder, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const label = value.length === 0 ? placeholder : value.length === 1
    ? (options.find((o) => o.value === value[0])?.label || '1 selected') : `${value.length} selected`;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="wg-select-trigger" style={{ ...g.trigger, ...(open ? g.triggerActive : {}) }} onClick={() => setOpen((o) => !o)}>
        <span style={{ color: value.length ? 'var(--c-text)' : 'var(--c-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div style={g.pop}>
          {options.length === 0 && <div style={g.popEmpty}>No options</div>}
          {options.map((o) => (
            <button key={o.value} type="button" style={g.popItem} onClick={() => toggle(o.value)}>
              <span style={{ ...g.checkbox, ...(value.includes(o.value) ? g.checkboxOn : {}) }}>{value.includes(o.value) ? '✓' : ''}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserPicker({ value, onChange, users, myId, allowUnassigned, active }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const sel = Array.isArray(value) ? value : (value ? [value] : []);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  const nameOf = (id) => users.find((u) => String(u.user_id) === String(id))?.full_name
    || users.find((u) => String(u.user_id) === String(id))?.email || 'User';
  const labelOf = (v) => (v === '__unassigned__' ? 'Unassigned' : v === '__me__' ? 'Me' : nameOf(v));
  const label = sel.length === 0 ? 'Select assignee' : sel.length === 1 ? labelOf(sel[0]) : `${sel.length} selected`;
  const filtered = users.filter((u) => !q.trim()
    || (u.full_name || '').toLowerCase().includes(q.trim().toLowerCase())
    || (u.email || '').toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  const Box = ({ on }) => <span style={{ ...g.checkbox, ...(on ? g.checkboxOn : {}) }}>{on ? '✓' : ''}</span>;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="wg-select-trigger" style={{ ...g.trigger, ...(open ? g.triggerActive : {}) }} onClick={() => setOpen((o) => !o)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: sel.length ? 'var(--c-text)' : 'var(--c-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <IconUser size={14} />{label}
        </span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div style={g.pop}>
          <div style={g.searchRow}>
            <IconSearch size={14} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or enter email…" style={g.searchInput} />
          </div>
          {allowUnassigned && <button type="button" style={g.popItem} onClick={() => toggle('__unassigned__')}><Box on={sel.includes('__unassigned__')} /><span style={g.avatarMuted}><IconUser size={13} /></span>Unassigned</button>}
          <button type="button" style={g.popItem} onClick={() => toggle('__me__')}><Box on={sel.includes('__me__')} /><span style={g.avatarMe}>{(nameOf(myId)[0] || 'M').toUpperCase()}</span>Me</button>
          {filtered.map((u) => (
            <button key={u.user_id} type="button" style={g.popItem} onClick={() => toggle(u.user_id)}>
              <Box on={sel.includes(u.user_id)} />
              <span style={g.avatarMe}>{((u.full_name || u.email || '?')[0] || '?').toUpperCase()}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.email}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={g.popEmpty}>No people found</div>}
        </div>
      )}
    </div>
  );
}

const s = {
  builder: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', padding: 16 },
  cardBlock: { marginBottom: 10 },
  cardDivider: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
  cardDividerText: { fontSize: 12, fontWeight: 700, letterSpacing: '.03em', color: 'var(--c-muted)', paddingLeft: 8 },
  builderFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  footerRight: { display: 'inline-flex', alignItems: 'center', gap: 10 },
  clearAllBtn: { fontSize: 13.5, color: 'var(--c-muted)' },
};

const g = {
  panel: { background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  nested: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  rowTop: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  connCol: { width: 84, flexShrink: 0, minHeight: 38, display: 'flex', alignItems: 'center' },
  where: { fontSize: 13, color: 'var(--c-muted)', paddingLeft: 6 },
  conjText: { fontSize: 13, fontWeight: 700, color: 'var(--c-muted)', paddingLeft: 6 },
  fieldCol: { width: 172, flexShrink: 0 },
  opCol: { width: 104, flexShrink: 0 },
  valCol: { flex: 1, minWidth: 160 },
  trash: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 38, border: 'none', color: 'var(--c-muted)', cursor: 'pointer', borderRadius: 8, flexShrink: 0 },
  nestedLinkRow: { paddingLeft: 92 },
  nestedLinkFlush: { paddingLeft: 0 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' },
  triggerActive: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 2px var(--c-primary-weak)' },
  addFilter: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 },
  trigger: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', height: 38, padding: '0 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  pop: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 40, minWidth: 240, maxWidth: 320, maxHeight: 280, overflowY: 'auto', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.16)', padding: 6 },
  popItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  popEmpty: { padding: '10px 12px', fontSize: 13, color: 'var(--c-muted)' },
  checkbox: { width: 18, height: 18, borderRadius: 5, border: '1px solid var(--c-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 },
  checkboxOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 8px', color: 'var(--c-faint)', borderBottom: '1px solid var(--c-border)', marginBottom: 4 },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--c-text)' },
  avatarMuted: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-muted)', flexShrink: 0 },
  avatarMe: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-primary)', color: 'var(--c-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
};
