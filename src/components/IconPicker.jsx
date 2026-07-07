import { createPortal } from 'react-dom';
import { IconClose } from './icons';

// A curated, ClickUp-style set of default icons (emoji — no assets/deps needed).
const EMOJIS = [
  '🚀', '🛸', '🦉', '☁️', '💿', '💻', '☕', '🖼️', '🌭', '🐨', '📱', '👛',
  '🌐', '🏔️', '📝', '✈️', '📊', '📈', '📉', '🎯', '🎨', '🔥', '⭐', '✅',
  '📌', '🏷️', '🐛', '🧩', '⚙️', '🛠️', '🔧', '📦', '📁', '📂', '🗂️', '📋',
  '🗓️', '📅', '🔔', '💡', '🎓', '🏆', '🎁', '🧪', '🔬', '🩺', '🧠', '💬',
  '👥', '🧭', '🎬', '🎵', '📞', '🖥️', '🔒', '🔑', '🌙', '☀️', '💎', '🍀',
  '🌈', '⚡', '❤️', '💙', '💚', '💛', '💜', '🧡', '🖤', '🤍', '🟢', '🔵',
];

/**
 * Emoji icon picker used to set the icon on a Space / List / Dashboard / Filter.
 * `onSelect(emoji)` is called with the chosen emoji, or '' to clear the icon.
 */
export default function IconPicker({ open, current, onSelect, onClose }) {
  if (!open) return null;
  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Choose an icon</strong>
          <button className="icon-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div style={s.grid}>
          {current ? (
            <button type="button" style={s.remove} title="Remove icon" onClick={() => onSelect('')}>None</button>
          ) : null}
          {EMOJIS.map((e) => (
            <button key={e} type="button" style={{ ...s.cell, ...(current === e ? s.cellActive : {}) }}
              title={`Use ${e}`} onClick={() => onSelect(e)}>{e}</button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: 420, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 18, color: 'var(--c-text-strong)' },
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 8, padding: 16, overflowY: 'auto' },
  cell: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, fontSize: 26, background: 'var(--c-surface-2)',
    border: '1px solid transparent', borderRadius: 12, cursor: 'pointer' },
  cellActive: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 2px var(--c-primary-weak)' },
  remove: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, fontSize: 12, fontWeight: 600, color: 'var(--c-muted)',
    background: 'var(--c-surface-2)', border: '1px dashed var(--c-border)', borderRadius: 12, cursor: 'pointer' },
};
