import { useEffect, useRef, useState } from 'react';
import {
  IconSettings, IconFlag, IconBoard, IconFields, IconUser, IconCalendar, IconTag,
  IconTypeTask, IconFieldDropdown, IconFieldText, IconFieldRelationship,
} from '../../components/icons';
import { STD_CARD_FIELDS } from './cardFieldsStore';

// ClickUp-style icon per field.
const FIELD_ICON = {
  priority: IconFlag, status: IconBoard, key: IconFields, type: IconTypeTask,
  assignee: IconUser, created_at: IconCalendar, due_date: IconCalendar,
  closed_at: IconCalendar, labels: IconTag,
};
const CF_ICON = { dropdown: IconFieldDropdown, text: IconFieldText, relationship: IconFieldRelationship };

/**
 * Gear button + "Customize view" popover for a board: toggle which fields show
 * on each task card (icon + label rows, ClickUp-style). Choices persist via the
 * `cf` store hook. `customFields` are the List's custom fields.
 */
export default function CardFieldsMenu({ cf, customFields = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h, true); document.removeEventListener('keydown', esc); };
  }, [open]);

  const Toggle = ({ on, onClick }) => (
    <button type="button" style={{ ...s.toggle, ...(on ? s.toggleOn : {}) }} onClick={onClick} aria-pressed={on}>
      <span style={{ ...s.knob, ...(on ? s.knobOn : {}) }} />
    </button>
  );
  const Row = ({ icon: Ic, label, on, onClick }) => (
    <div style={s.row}>
      <span style={s.rowLeft}>
        <span style={s.icon}><Ic size={15} /></span>
        <span style={s.rowLabel} title={label}>{label}</span>
      </span>
      <Toggle on={on} onClick={onClick} />
    </div>
  );

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="icon-btn" style={s.gear} title="Customize view" onClick={() => setOpen((o) => !o)}>
        <IconSettings size={17} />
      </button>
      {open && (
        <div style={s.pop}>
          <div style={s.head}>Customize view</div>
          <div style={s.sub}>Fields shown on each card</div>

          {STD_CARD_FIELDS.map((f) => (
            <Row key={f.key} icon={FIELD_ICON[f.key] || IconFields} label={f.label}
              on={cf.isOn(f.key, f.def)} onClick={() => cf.set(f.key, !cf.isOn(f.key, f.def))} />
          ))}

          {customFields.length > 0 && (
            <>
              <div style={s.divider} />
              <div style={s.sectionLabel}>Custom fields</div>
              {customFields.map((c) => (
                <Row key={c._id} icon={CF_ICON[c.type] || IconFields} label={c.name}
                  on={cf.isOn(`cf:${c._id}`, false)} onClick={() => cf.set(`cf:${c._id}`, !cf.isOn(`cf:${c._id}`, false))} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  gear: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)', borderRadius: 9, cursor: 'pointer' },
  pop: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, width: 252, maxHeight: 460, overflowY: 'auto',
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.2)', padding: '10px 8px' },
  head: { fontSize: 14, fontWeight: 700, color: 'var(--c-text-strong)', padding: '0 4px' },
  sub: { fontSize: 12, color: 'var(--c-muted)', margin: '2px 4px 6px' },
  sectionLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-faint)', padding: '2px 4px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 4px', borderRadius: 8 },
  rowLeft: { display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 },
  icon: { display: 'inline-flex', alignItems: 'center', color: 'var(--c-muted)', flexShrink: 0 },
  rowLabel: { fontSize: 13.5, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  divider: { height: 1, background: 'var(--c-border)', margin: '6px 2px' },
  // Compact toggle (smaller than before)
  toggle: { position: 'relative', width: 30, height: 17, borderRadius: 999, border: 'none', background: 'var(--c-border-2)',
    cursor: 'pointer', flexShrink: 0, transition: 'background .15s', padding: 0 },
  toggleOn: { background: 'var(--c-primary)' },
  knob: { position: 'absolute', top: 2, left: 2, width: 13, height: 13, borderRadius: '50%', background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,.3)', transition: 'left .15s' },
  knobOn: { left: 15 },
};
