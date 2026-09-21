import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconSettings, IconFlag, IconBoard, IconFields, IconUser, IconCalendar, IconTag,
  IconTypeTask, IconFieldDropdown, IconFieldText, IconFieldRelationship, IconClose,
  IconEdit, Chevron,
} from '../../components/icons';
import { STD_CARD_FIELDS } from './cardFieldsStore';

// ClickUp-style icon per field.
const FIELD_ICON = {
  priority: IconFlag, status: IconBoard, key: IconFields, type: IconTypeTask,
  assignee: IconUser, created_at: IconCalendar, due_date: IconCalendar,
  closed_at: IconCalendar, labels: IconTag,
};
const CF_ICON = { dropdown: IconFieldDropdown, text: IconFieldText, relationship: IconFieldRelationship };

const CLOSE_MS = 220; // keep in sync with the drawer transition below

/**
 * Gear button that opens the "Customize view" as a NON-MODAL right-side drawer
 * that slides in/out smoothly. Inside, a collapsible "Fields" row expands to the
 * per-card field toggles. Choices persist via the `cf` store hook.
 */
export default function CardFieldsMenu({ cf, customFields = [] }) {
  const [mounted, setMounted] = useState(false); // in the DOM (during open + exit anim)
  const [visible, setVisible] = useState(false);  // slid-in state (drives the transition)
  const [fieldsOpen, setFieldsOpen] = useState(true); // "Fields" section expanded
  const gearRef = useRef(null);
  const drawerRef = useRef(null);

  const openDrawer = () => setMounted(true);
  const closeDrawer = () => { setVisible(false); window.setTimeout(() => setMounted(false), CLOSE_MS); };
  const toggleDrawer = () => (mounted ? closeDrawer() : openDrawer());

  // Slide in on the frame after mount so the CSS transition runs.
  useEffect(() => {
    if (!mounted) return undefined;
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, [mounted]);

  // Close on Escape or a click outside the drawer + gear (no backdrop).
  useEffect(() => {
    if (!mounted) return undefined;
    const onDown = (e) => {
      if (drawerRef.current?.contains(e.target)) return;
      if (gearRef.current?.contains(e.target)) return;
      closeDrawer();
    };
    const esc = (e) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', esc); };
  }, [mounted]);

  const onCount = STD_CARD_FIELDS.filter((f) => cf.isOn(f.key, f.def)).length
    + customFields.filter((c) => cf.isOn(`cf:${c._id}`, false)).length;

  const Toggle = ({ on, onClick }) => (
    <button type="button" style={{ ...s.toggle, ...(on ? s.toggleOn : {}) }} onClick={onClick} aria-pressed={on}>
      <span style={{ ...s.knob, ...(on ? s.knobOn : {}) }} />
    </button>
  );
  const Row = ({ icon: Ic, label, on, onClick }) => (
    <div style={s.row}>
      <span style={s.rowLeft}>
        <span style={s.icon}><Ic size={15} /></span>
        <span style={s.rowLabel}>{label}</span>
      </span>
      <Toggle on={on} onClick={onClick} />
    </div>
  );

  return (
    <div ref={gearRef} style={{ display: 'inline-flex' }}>
      <button className="icon-btn" style={s.gear} title="Customize view" onClick={toggleDrawer}>
        <IconSettings size={17} />
      </button>

      {mounted && createPortal(
        <div ref={drawerRef} style={{ ...s.drawer, transform: visible ? 'translateX(0)' : 'translateX(100%)' }}>
          <div style={s.drawerHead}>
            <div style={s.drawerTitle}>Customize view</div>
            <button className="icon-btn" style={s.drawerClose} title="Close" onClick={closeDrawer}>
              <IconClose size={18} />
            </button>
          </div>

          <div style={s.drawerBody}>
            {/* Collapsible "Fields" section */}
            <button type="button" style={s.sectionRow} onClick={() => setFieldsOpen((o) => !o)}>
              <span style={s.sectionLeft}>
                <span style={s.icon}><IconEdit size={16} /></span>
                <span style={s.sectionName}>Fields</span>
              </span>
              <span style={s.sectionRight}>
                <span style={s.shownCount}>{onCount} shown</span>
                <span style={{ ...s.chev, transform: fieldsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                  <Chevron open size={13} />
                </span>
              </span>
            </button>

            {fieldsOpen && (
              <div style={s.fieldList}>
                {STD_CARD_FIELDS.map((f) => (
                  <Row key={f.key} icon={FIELD_ICON[f.key] || IconFields} label={f.label}
                    on={cf.isOn(f.key, f.def)} onClick={() => cf.set(f.key, !cf.isOn(f.key, f.def))} />
                ))}

                {customFields.length > 0 && (
                  <>
                    <div style={s.divider} />
                    <div style={s.customLabel}>Custom fields</div>
                    {customFields.map((c) => (
                      <Row key={c._id} icon={CF_ICON[c.type] || IconFields} label={c.name}
                        on={cf.isOn(`cf:${c._id}`, false)} onClick={() => cf.set(`cf:${c._id}`, !cf.isOn(`cf:${c._id}`, false))} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const s = {
  gear: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)', borderRadius: 9, cursor: 'pointer' },

  // Non-modal right-side drawer — starts below the 56px topbar, slides in/out.
  drawer: { position: 'fixed', top: 56, right: 0, bottom: 0, width: 340, maxWidth: '90vw', zIndex: 1500,
    background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)', borderTop: '1px solid var(--c-border)',
    boxShadow: '-16px 0 40px rgba(16,24,40,.18)', display: 'flex', flexDirection: 'column',
    transition: 'transform .22s cubic-bezier(.4,0,.2,1)', willChange: 'transform' },
  drawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '16px 18px', borderBottom: '1px solid var(--c-border)' },
  drawerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  drawerClose: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '8px 12px 16px' },

  // "Fields" collapsible header row
  sectionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8,
    padding: '11px 8px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' },
  sectionLeft: { display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 },
  sectionName: { fontSize: 14.5, fontWeight: 600, color: 'var(--c-text-strong)' },
  sectionRight: { display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  shownCount: { fontSize: 12.5, color: 'var(--c-muted)' },
  chev: { display: 'inline-flex', alignItems: 'center', color: 'var(--c-muted)', transition: 'transform .15s' },

  fieldList: { padding: '2px 2px 0' },
  customLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-faint)', padding: '2px 4px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 6px', borderRadius: 8 },
  rowLeft: { display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 },
  icon: { display: 'inline-flex', alignItems: 'center', color: 'var(--c-muted)', flexShrink: 0 },
  rowLabel: { fontSize: 14, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  divider: { height: 1, background: 'var(--c-border)', margin: '8px 2px' },
  toggle: { position: 'relative', width: 34, height: 19, borderRadius: 999, border: 'none', background: 'var(--c-border-2)',
    cursor: 'pointer', flexShrink: 0, transition: 'background .15s', padding: 0 },
  toggleOn: { background: 'var(--c-primary)' },
  knob: { position: 'absolute', top: 2, left: 2, width: 15, height: 15, borderRadius: '50%', background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,.3)', transition: 'left .15s' },
  knobOn: { left: 17 },
};
