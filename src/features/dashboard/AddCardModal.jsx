import { useEffect, useMemo, useRef, useState } from 'react';
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { savedFiltersApi } from '../filters/savedFiltersApi';
import { newCard } from './dashboardStore';
import { CARD_TYPES, cardTypeTitle } from './cardTypes';
import { STATUS_GROUPS, PRIORITIES } from '../tasks/tasksApi';
import DashboardCard from './DashboardCard';
import { IconClose, IconListCheck, IconPanel, IconDots, IconTrash, IconSearch, IconArrowLeft, Chevron } from '../../components/icons';

/**
 * Two-step "Add card" flow:
 *   1. picker  — sidebar (Custom) + a grid of card types (Line/Bar/Pie/Calculation/Portfolio)
 *   2. config  — name the card + choose its data, with a live preview. Two source modes:
 *        - Lists:   track whole Lists (progress over each List's own tasks)
 *        - Related: pick a List, then which of its related Lists (Frontend / Backend …)
 *                   to track — progress over the related tasks (relationship fields).
 */
export default function AddCardModal({ open, onClose, onAdd, editCard = null, startWithSidebar = true, onDelete }) {
  const [step, setStep] = useState('picker');
  const [showSidebar, setShowSidebar] = useState(true); // data-source filter panel visible?
  const [hdrMenu, setHdrMenu] = useState(false);         // header ⋯ menu
  const hdrMenuRef = useRef(null);

  // Close the header ⋯ menu on outside click; Escape closes the menu then the modal.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (hdrMenu && hdrMenuRef.current && !hdrMenuRef.current.contains(e.target)) setHdrMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') { if (hdrMenu) setHdrMenu(false); else onClose(); } };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey); };
  }, [open, hdrMenu, onClose]);
  const [cardType, setCardType] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [listsBySpace, setListsBySpace] = useState({});
  const [source, setSource] = useState('lists'); // 'lists' | 'filter' (Jira-style saved-filter source)
  const [savedFilters, setSavedFilters] = useState([]); // saved-filter catalog for the filter source
  const [filterId, setFilterId] = useState('');          // chosen saved filter (filter source)
  const [filterName, setFilterName] = useState('');      // chosen saved-filter name
  const [sfQuery, setSfQuery] = useState('');            // search box for the saved-filters list
  const [sfOpen, setSfOpen] = useState(false);           // saved-filters dropdown open?
  const sfInputRef = useRef(null);                       // to drop focus after picking
  const [selected, setSelected] = useState({}); // listId -> meta (lists mode)
  const [selectedRelated, setSelectedRelated] = useState({}); // listId -> meta (related mode)
  const [relatedByList, setRelatedByList] = useState({}); // listId -> available related-list names
  const [openSpaces, setOpenSpaces] = useState({}); // spaceId -> expanded?
  const [cardName, setCardName] = useState('');
  const [xMeasure, setXMeasure] = useState('status'); // chart X-axis grouping
  const [xShow, setXShow] = useState([]);             // which X categories to show ([] = all)
  const [showOpen, setShowOpen] = useState(false);    // "Show" checkbox dropdown open?
  const [loading, setLoading] = useState(false);

  const toggleOpen = (sid) => setOpenSpaces((o) => ({ ...o, [sid]: !o[sid] }));

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list({ limit: 100 });
      const sps = res.items || [];
      setSpaces(sps);
      const map = {};
      await Promise.all(sps.map(async (sp) => {
        map[sp._id] = await listsApi.forSpace(sp._id).catch(() => []);
      }));
      setListsBySpace(map);
      savedFiltersApi.list().then(setSavedFilters).catch(() => setSavedFilters([]));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    setHdrMenu(false);
    setShowSidebar(editCard ? startWithSidebar : true);
    if (editCard) {
      const sel = {}; const selR = {}; const opens = {}; const rBy = {};
      (editCard.lists || []).forEach((l) => { sel[l.id] = l; opens[l.spaceId] = true; });
      (editCard.tasks || []).forEach((m) => { selR[m.id] = m; opens[m.spaceId] = true; rBy[m.id] = m.lists || []; });
      setSelected(sel);
      setSelectedRelated(selR);
      setRelatedByList(rBy);
      setOpenSpaces(opens);
      setSource(editCard.source || 'lists');
      setFilterId(editCard.filterId || '');
      setFilterName('');
      setCardType(editCard.type || 'portfolio');
      setCardName(editCard.title || cardTypeTitle(editCard.type));
      setXMeasure(editCard.xMeasure || 'status');
      setXShow(editCard.xShow || []); setShowOpen(false);
      setStep('config');
      loadData();
    } else {
      setStep('picker'); setSelected({}); setSelectedRelated({});
      setRelatedByList({}); setOpenSpaces({}); setCardType(null); setCardName(''); setXMeasure('status'); setXShow([]); setShowOpen(false);
      setSource('lists'); setFilterId(''); setFilterName('');
    }
  }, [open, editCard, startWithSidebar]);

  // When editing a filter-sourced card, show its saved-filter name once filters load.
  useEffect(() => {
    if (source === 'filter' && filterId && !filterName && savedFilters.length) {
      const m = savedFilters.find((f) => f.id === filterId);
      if (m) setFilterName(m.name);
    }
  }, [savedFilters, source, filterId, filterName]);

  // Clear the data-source selections so a freshly-picked card starts empty
  // (otherwise a previously-chosen List / saved filter would carry over).
  const resetDataSource = () => {
    setSelected({}); setSelectedRelated({}); setRelatedByList({});
    setSource('lists'); setFilterId(''); setFilterName(''); setSfQuery(''); setSfOpen(false);
    setXMeasure('status'); setXShow([]);
  };

  const pick = (type) => {
    resetDataSource();
    setCardType(type);
    setCardName(cardTypeTitle(type));
    setStep('config');
    loadData();
  };

  // Back to the card-type picker — wipe any selection made for this card.
  const goBack = () => { if (editCard) { onClose(); return; } resetDataSource(); setStep('picker'); };

  // Picking a saved filter switches the card to the filter source (and drops any
  // list selection); picking a List switches back to the lists source.
  const selectSavedFilter = (f) => {
    setSfOpen(false);
    sfInputRef.current?.blur(); // drop the text cursor after choosing
    if (source === 'filter' && filterId === f.id) { // click again to deselect
      setSource('lists'); setFilterId(''); setFilterName(''); setSfQuery(''); return;
    }
    setSource('filter'); setFilterId(f.id); setFilterName(f.name); setSfQuery(f.name);
    setSelected({}); setSelectedRelated({});
  };
  const backToLists = () => { if (source === 'filter') { setSource('lists'); setFilterId(''); setFilterName(''); } };

  // Lists mode — select a List to track its own tasks.
  const toggle = (list, sp) => { backToLists(); setSelected((cur) => {
    const next = { ...cur };
    if (next[list._id]) delete next[list._id];
    else next[list._id] = { id: list._id, name: list.name, spaceId: sp._id, spaceName: sp.name };
    return next;
  }); };

  const toggleSpace = (sp, spaceLists, allSelected) => { backToLists(); setSelected((cur) => {
    const next = { ...cur };
    if (allSelected) spaceLists.forEach((l) => { delete next[l._id]; });
    else spaceLists.forEach((l) => {
      next[l._id] = { id: l._id, name: l.name, spaceId: sp._id, spaceName: sp.name };
    });
    return next;
  }); };

  // Related mode — select a List, then discover its related Lists (relationship fields).
  const toggleRelated = async (l, sp) => {
    backToLists();
    if (selectedRelated[l._id]) {
      setSelectedRelated((cur) => { const n = { ...cur }; delete n[l._id]; return n; });
      return;
    }
    const fields = await customFieldsApi.list(sp._id, l._id).catch(() => []);
    const avail = [...new Set((fields || []).filter((f) => f.type === 'relationship').map((f) => f.location).filter(Boolean))];
    setRelatedByList((m) => ({ ...m, [l._id]: avail }));
    setSelectedRelated((cur) => ({
      ...cur,
      [l._id]: { id: l._id, name: l.name, spaceId: sp._id, spaceName: sp.name, lists: avail.slice() },
    }));
  };

  // Toggle one related-list filter on a selected List.
  const toggleRelatedSub = (listId, name) => setSelectedRelated((cur) => {
    const m = cur[listId];
    if (!m) return cur;
    const set = new Set(m.lists || []);
    if (set.has(name)) set.delete(name); else set.add(name);
    return { ...cur, [listId]: { ...m, lists: [...set] } };
  });

  const count = source === 'filter' ? (filterId ? 1 : 0)
    : source === 'tasks' ? Object.keys(selectedRelated).length
      : Object.keys(selected).length;
  const isChart = cardType === 'bar' || cardType === 'pie';
  // Categories available for the "Show" filter, derived from the X-axis measure.
  const xCategories = useMemo(() => {
    if (xMeasure === 'priority') return PRIORITIES.map((p) => ({ key: p, label: p }));
    if (xMeasure === 'list') return Object.values(selected).map((l) => ({ key: l.name, label: l.name }));
    return STATUS_GROUPS.map((g) => ({ key: g.key, label: g.label }));
  }, [xMeasure, selected]);
  const toggleShow = (key) => setXShow((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  const previewCard = useMemo(
    () => ({ id: 'preview', type: cardType, title: cardName || cardTypeTitle(cardType),
      source, filterId, lists: Object.values(selected), tasks: Object.values(selectedRelated), xMeasure, xShow }),
    [selected, selectedRelated, source, filterId, cardName, cardType, xMeasure, xShow],
  );
  const add = () => {
    if (!count) return;
    const title = (cardName || '').trim() || cardTypeTitle(cardType);
    const payload = { source, filterId, lists: Object.values(selected), tasks: Object.values(selectedRelated), xMeasure, xShow };
    onAdd(editCard ? { ...editCard, title, ...payload } : newCard(cardType, payload, title));
  };

  if (!open) return null;
  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={{ ...s.modal, ...(step === 'config' ? s.modalWide : s.modalPicker) }} onClick={(e) => e.stopPropagation()}>

        {step === 'picker' ? (
          <div style={s.pickerLayout}>
            <aside style={s.sidebar}>
              <div style={s.sidebarHead}>Add Card</div>
              <button style={{ ...s.sideItem, ...s.sideItemActive }}>Custom</button>
            </aside>
            <div style={s.pickerMain}>
              <div style={s.pickerTop}>
                <h3 style={s.pickerTitle}>Custom</h3>
                <button className="icon-btn" style={s.close} onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
              </div>
              <div style={s.grid}>
                {CARD_TYPES.map((ct) => (
                  <button key={ct.type} style={s.tile} onClick={() => pick(ct.type)}>
                    {/* Each tile uses its card type's own colour (a subtle gradient of it). */}
                    <span style={{ ...s.thumb, background: `linear-gradient(135deg, ${ct.color}, color-mix(in srgb, ${ct.color} 70%, #0f172a))` }}><Thumb type={ct.type} /></span>
                    <span style={s.tileTitle}>{ct.title}</span>
                    <span style={s.tileDesc}>{ct.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={s.head}>
              <div style={s.headLeft}>
                {!editCard && (
                  <button className="icon-btn" style={s.backBtn} title="Back" onClick={goBack}><IconArrowLeft size={18} /></button>
                )}
                <h3 style={s.title}>{cardName || cardTypeTitle(cardType)}</h3>
              </div>
              <span style={s.headActions}>
                <button className="icon-btn" style={s.hdrBtn} title={showSidebar ? 'Hide filter' : 'Show filter'}
                  onClick={() => setShowSidebar((v) => !v)}><IconPanel size={17} /></button>
                {editCard && onDelete && (
                  <span ref={hdrMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
                    <button className="icon-btn" style={s.hdrBtn} title="More" onClick={() => setHdrMenu((m) => !m)}><IconDots size={17} /></button>
                    {hdrMenu && (
                      <div style={s.hdrMenu} onClick={(e) => e.stopPropagation()}>
                        <button className="wg-menu-item" style={{ ...s.hdrMenuItem, color: '#b91c1c' }}
                          onClick={() => { setHdrMenu(false); onClose(); onDelete(); }}>
                          <IconTrash size={15} /> Delete card
                        </button>
                      </div>
                    )}
                  </span>
                )}
                <button className="icon-btn" style={s.hdrBtn} onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
              </span>
            </div>
            {showSidebar && (
              <div style={s.nameRow}>
                <label style={s.nameLabel}>Name</label>
                <input style={s.nameInput} value={cardName} placeholder={cardTypeTitle(cardType)}
                  onChange={(e) => setCardName(e.target.value)} />
              </div>
            )}
            <div style={s.split}>
              <div style={s.leftPane}>
                {count === 0
                  ? <div style={s.previewEmpty}>Select {source === 'filter' ? 'a saved filter' : source === 'tasks' ? 'a List' : 'Lists'} on the right to preview the {cardTypeTitle(cardType)}.</div>
                  : <DashboardCard card={previewCard} />}
              </div>
              {showSidebar && (
              <div style={s.rightPane}>
                <div style={s.dsLabel}>Lists</div>
                <div style={s.dsHint}>Track whole Lists — pick one or more below, or choose a saved filter.</div>
                {loading ? <p style={{ color: 'var(--c-muted)' }}>Loading…</p> : (
                  <div style={s.tree}>
                    {spaces.length === 0 && <p style={{ color: 'var(--c-muted)' }}>No spaces yet.</p>}
                    {spaces.map((sp) => {
                      const spaceLists = listsBySpace[sp._id] || [];
                      const selCount = spaceLists.filter((l) => selected[l._id]).length;
                      const allSel = spaceLists.length > 0 && selCount === spaceLists.length;
                      const someSel = selCount > 0 && !allSel;
                      const isOpen = !!openSpaces[sp._id];
                      return (
                        <div key={sp._id} style={{ marginBottom: 4 }}>
                          <div className="wg-menu-item" style={s.spaceRow}>
                            <button type="button" style={s.caret} onClick={() => toggleOpen(sp._id)}
                              title={isOpen ? 'Collapse' : 'Expand'}>
                              <Chevron open={isOpen} size={13} />
                            </button>
                            <span style={s.spaceRowName} onClick={() => toggleOpen(sp._id)}>{sp.name}</span>
                            <span style={{ flex: 1 }} />
                            {source === 'lists' && (
                              <input type="checkbox" checked={allSel}
                                ref={(el) => { if (el) el.indeterminate = someSel; }}
                                onChange={() => toggleSpace(sp, spaceLists, allSel)} />
                            )}
                          </div>
                          {isOpen && spaceLists.map((l) => {
                            const isLists = source === 'lists';
                            const checked = isLists ? !!selected[l._id] : !!selectedRelated[l._id];
                            const onCheck = () => (isLists ? toggle(l, sp) : toggleRelated(l, sp));
                            const related = relatedByList[l._id] || [];
                            return (
                              <div key={l._id}>
                                <label className="wg-menu-item" style={s.listRow}>
                                  <span style={s.listIcon}><IconListCheck size={15} /></span>
                                  <span style={{ flex: 1 }}>{l.name}</span>
                                  <input type="checkbox" checked={checked} onChange={onCheck} />
                                </label>
                                {!isLists && selectedRelated[l._id] && (
                                  <div style={s.relBlock}>
                                    <div style={s.relLabel}>Related lists</div>
                                    {related.length === 0
                                      ? <div style={s.relHint}>No related lists</div>
                                      : related.map((name) => (
                                        <label key={name} className="wg-menu-item" style={s.relItem}>
                                          <span style={{ flex: 1 }}>{name || '(no list)'}</span>
                                          <input type="checkbox"
                                            checked={(selectedRelated[l._id].lists || []).includes(name)}
                                            onChange={() => toggleRelatedSub(l._id, name)} />
                                        </label>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {isOpen && spaceLists.length === 0 && <div style={s.noLists}>No lists</div>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SAVED FILTERS — click the field to open a searchable dropdown. */}
                <div style={s.sfSection}>
                  <div style={s.dsLabel}>Saved Filters</div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ ...s.searchWrap, ...(sfOpen ? s.searchWrapOpen : {}) }}>
                      <span style={s.searchIcon}><IconSearch size={14} /></span>
                      <input ref={sfInputRef} className="sf-search-input" style={s.searchInput} value={sfQuery} placeholder="Search saved filters…"
                        onFocus={() => setSfOpen(true)}
                        onBlur={() => setTimeout(() => setSfOpen(false), 120)}
                        onChange={(e) => { setSfQuery(e.target.value); setSfOpen(true); }} />
                      <span style={s.sfCaret}><Chevron open={sfOpen} size={13} /></span>
                    </div>
                    {sfOpen && (
                      <div style={s.sfDropdown}>
                        {(() => {
                          const q = sfQuery.trim().toLowerCase();
                          // Once a filter is picked, its name fills the box — show the full
                          // list again unless the user actually typed something different.
                          const typed = q && q !== (filterName || '').toLowerCase();
                          const rows = savedFilters.filter((f) => !typed || (f.name || '').toLowerCase().includes(q));
                          if (savedFilters.length === 0) return <div style={s.sfEmpty}>No saved filters yet.</div>;
                          if (rows.length === 0) return <div style={s.sfEmpty}>No filters match your search.</div>;
                          return rows.map((f) => {
                            const active = source === 'filter' && filterId === f.id;
                            return (
                              <button key={f.id} type="button" className="wg-menu-item"
                                style={{ ...s.sfRow, ...(active ? s.sfRowActive : {}) }}
                                onMouseDown={(e) => { e.preventDefault(); selectSavedFilter(f); }}>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                {active && <span style={s.sfCheck}>✓</span>}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {isChart && (
                  <div style={s.axisBlock}>
                    <div style={s.axisDivider} />
                    <div style={s.dsLabel}>X-axis</div>
                    <label style={s.axisRow}>
                      <span style={s.axisLabel}>Measure</span>
                      <select style={s.axisSelect} value={xMeasure} onChange={(e) => { setXMeasure(e.target.value); setXShow([]); }}>
                        <option value="status">Status</option>
                        <option value="priority">Priority</option>
                        <option value="list">List</option>
                      </select>
                    </label>
                    <div style={s.axisRow}>
                      <span style={s.axisLabel}>Show</span>
                      <div style={{ position: 'relative' }}>
                        <button type="button" style={s.showBtn} onClick={() => setShowOpen((o) => !o)}>
                          <span style={{ flex: 1, textAlign: 'left' }}>{xShow.length ? `${xShow.length} selected` : 'All'}</span>
                          <Chevron open={showOpen} size={12} />
                        </button>
                        {showOpen && (
                          <div style={s.showMenu}>
                            <button type="button" className="wg-menu-item" style={s.showItem} onClick={() => { setXShow([]); }}>
                              <span style={{ flex: 1 }}>All</span>{xShow.length === 0 ? '✓' : ''}
                            </button>
                            <div style={s.axisDivider} />
                            {xCategories.length === 0 && <div style={s.showEmpty}>Select Lists first</div>}
                            {xCategories.map((c) => (
                              <label key={c.key} className="wg-menu-item" style={s.showItem}>
                                <span style={{ flex: 1, textTransform: 'capitalize' }}>{c.label}</span>
                                <input type="checkbox" checked={xShow.includes(c.key)} onChange={() => toggleShow(c.key)} />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ ...s.dsLabel, marginTop: 14 }}>Y-axis</div>
                    <label style={s.axisRow}>
                      <span style={s.axisLabel}>Measure</span>
                      <select style={s.axisSelect} value="count" disabled><option value="count">Number of tasks</option></select>
                    </label>
                  </div>
                )}
              </div>
              )}
            </div>
            {showSidebar && (
            <div style={s.footer}>
              <button style={s.ghost} onClick={goBack}>
                {editCard ? 'Cancel' : 'Back'}
              </button>
              <button style={{ ...s.primary, ...(count ? {} : s.primaryOff) }} disabled={!count} onClick={add}>
                {editCard ? 'Save' : `Add card${count ? ` (${count})` : ''}`}
              </button>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Tiny illustrative thumbnails for each card type. */
function Thumb({ type }) {
  const stroke = 'rgba(255,255,255,.92)';
  const fill = 'rgba(255,255,255,.85)';
  if (type === 'line') return (
    <svg width={70} height={42} viewBox="0 0 70 42"><polyline points="4,32 18,22 30,26 44,12 58,16 66,8" fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  if (type === 'bar') return (
    <svg width={70} height={42} viewBox="0 0 70 42">{[10, 26, 18, 34, 22].map((h, i) => <rect key={i} x={6 + i * 13} y={38 - h} width={9} height={h} rx={2} fill={fill} />)}</svg>
  );
  if (type === 'pie') return (
    <svg width={48} height={48} viewBox="0 0 48 48"><circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth={8} /><circle cx={24} cy={24} r={20} fill="none" stroke={stroke} strokeWidth={8} strokeDasharray="78 126" strokeDashoffset={31} transform="rotate(-90 24 24)" /></svg>
  );
  if (type === 'calculation') return (
    <svg width={70} height={42} viewBox="0 0 70 42"><text x={35} y={28} textAnchor="middle" fontSize={22} fontWeight="800" fill={stroke}>1,380</text></svg>
  );
  // portfolio
  return (
    <svg width={70} height={42} viewBox="0 0 70 42">{[8, 18, 28].map((y, i) => (<g key={i}><rect x={6} y={y} width={20} height={4} rx={2} fill={fill} /><rect x={32} y={y} width={32 - i * 8} height={4} rx={2} fill="rgba(255,255,255,.55)" /></g>))}</svg>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 80, display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 14,
    boxShadow: '0 24px 64px rgba(0,0,0,.3)', overflow: 'hidden' },
  modalPicker: { width: 900, maxWidth: '95vw', height: '78vh', maxHeight: 680 },
  modalWide: { width: '95vw', maxWidth: 1280, height: '90vh', display: 'flex', flexDirection: 'column', padding: 22 },

  // picker
  pickerLayout: { display: 'flex', height: '100%' },
  sidebar: { width: 220, flexShrink: 0, background: 'var(--c-surface-2)', borderRight: '1px solid var(--c-border)', padding: 14 },
  sidebarHead: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: 'var(--c-text-strong)', padding: '6px 8px 14px' },
  sideItem: { display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none',
    background: 'none', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  sideItemActive: { background: 'var(--c-primary-weak)', color: 'var(--c-primary)' },
  pickerMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '14px 20px 0' },
  pickerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pickerTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--c-text-strong)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, overflowY: 'auto', paddingBottom: 20, alignContent: 'start' },
  tile: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, textAlign: 'left',
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 12, cursor: 'pointer' },
  thumb: { width: '100%', height: 110, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileTitle: { fontWeight: 700, fontSize: 15, color: 'var(--c-text-strong)' },
  tileDesc: { fontSize: 13, color: 'var(--c-muted)' },

  // config
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  backBtn: { border: 'none', background: 'none', color: 'var(--c-text)', cursor: 'pointer', display: 'inline-flex',
    padding: 6, borderRadius: 8, flexShrink: 0 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  close: { border: 'none', color: 'var(--c-muted)', cursor: 'pointer', display: 'inline-flex', padding: 6, borderRadius: 7 },
  headActions: { display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 },
  hdrBtn: { border: 'none', color: 'var(--c-muted)', cursor: 'pointer', display: 'inline-flex', padding: 6, borderRadius: 7 },
  hdrMenu: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.18)', zIndex: 5, padding: 4 },
  hdrMenuItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontSize: 13.5 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  nameLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)' },
  nameInput: { flex: 1, maxWidth: 360, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--c-border)',
    background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600 },
  split: { display: 'flex', gap: 20, alignItems: 'stretch', flex: 1, minHeight: 0, marginTop: 6 },
  leftPane: { flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 4 },
  rightPane: { width: 320, flexShrink: 0, borderLeft: '1px solid var(--c-border)', paddingLeft: 20, overflowY: 'auto' },
  dsLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)', marginBottom: 8 },
  filterInput: { width: '100%', padding: '8px 10px', fontSize: 13, color: 'var(--c-text-strong)', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, outline: 'none', marginBottom: 6, boxSizing: 'border-box' },
  filterOk: { fontSize: 12.5, fontWeight: 600, color: 'var(--c-success, #16a34a)', marginBottom: 10 },
  filterNo: { fontSize: 12.5, color: 'var(--c-muted)', marginBottom: 10 },
  // --- Saved Filters section (bottom of the data-source pane) ---
  sfSection: { marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c-border)' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
    border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)' },
  searchWrapOpen: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 3px var(--c-primary-weak)' },
  searchIcon: { color: 'var(--c-faint)', display: 'inline-flex', flexShrink: 0 },
  searchInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
    color: 'var(--c-text-strong)', fontSize: 13 },
  sfCaret: { color: 'var(--c-muted)', display: 'inline-flex', flexShrink: 0 },
  sfDropdown: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,.16)', padding: 6, maxHeight: 240, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 2 },
  sfRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
    fontSize: 13.5, color: 'var(--c-text)' },
  sfRowActive: { background: 'var(--c-primary-weak)', color: 'var(--c-primary)', fontWeight: 600 },
  sfCheck: { color: 'var(--c-primary)', fontWeight: 700, flexShrink: 0 },
  sfEmpty: { fontSize: 12.5, color: 'var(--c-muted)', padding: '8px 2px' },
  axisBlock: { marginBottom: 8 },
  axisRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  axisLabel: { fontSize: 13.5, color: 'var(--c-text)' },
  axisSelect: { minWidth: 150, fontSize: 13 },
  axisDivider: { height: 1, background: 'var(--c-border-2)', margin: '14px 0' },
  showBtn: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 150, padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' },
  showMenu: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 180, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.18)', zIndex: 6, padding: 4, maxHeight: 240, overflowY: 'auto' },
  showItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '7px 10px',
    border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontSize: 13.5, color: 'var(--c-text)' },
  showEmpty: { fontSize: 12.5, color: 'var(--c-faint)', padding: '6px 10px' },
  segmented: { display: 'flex', gap: 4, background: 'var(--c-surface-3)', borderRadius: 8, padding: 3, marginBottom: 8 },
  segBtn: { flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, color: 'var(--c-muted)' },
  segOn: { background: 'var(--c-surface)', color: 'var(--c-text-strong)', boxShadow: 'var(--sh-xs)' },
  dsHint: { fontSize: 12, color: 'var(--c-faint)', marginBottom: 12, lineHeight: 1.4 },
  previewEmpty: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160,
    border: '1px dashed var(--c-border)', borderRadius: 12, color: 'var(--c-muted)', fontSize: 14, textAlign: 'center', padding: 16 },
  tree: {},
  spaceRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 6px', borderRadius: 7, fontSize: 14, fontWeight: 700, color: 'var(--c-text-strong)' },
  caret: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)', display: 'inline-flex', padding: 2 },
  spaceRowName: { fontWeight: 700, cursor: 'pointer' },
  listRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px 7px 28px', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  listIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  noLists: { fontSize: 13, color: 'var(--c-faint)', padding: '4px 6px' },
  relBlock: { margin: '2px 0 6px 34px', paddingLeft: 10, borderLeft: '2px solid var(--c-border)' },
  relLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-faint)', padding: '2px 6px' },
  relItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--c-muted)' },
  relHint: { fontSize: 12.5, color: 'var(--c-faint)', padding: '3px 6px' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
  ghost: { padding: '9px 18px', background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer' },
  primary: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  primaryOff: { opacity: 0.5, cursor: 'not-allowed' },
};
