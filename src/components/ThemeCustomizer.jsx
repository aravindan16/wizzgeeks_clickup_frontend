import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ACCENTS, getMode, getAccent, applyMode, applyAccent } from '../services/theme';
import { usersApi } from '../features/users/usersApi';
import { patchUser } from '../features/auth/authSlice';
import { IconClose, IconCheck } from './icons';

/**
 * ClickUp-style "Customize" panel. Two independent choices, applied live:
 *   • Appearance — Light / Dark / Auto (Auto follows the OS).
 *   • Theme color — accent that recolors primary buttons, links, active states.
 * Both persist via the theme service (localStorage + data-* attrs on <html>).
 */
const MODES = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'auto', label: 'Auto' },
];

export default function ThemeCustomizer({ open, onClose }) {
  const dispatch = useDispatch();
  const [mode, setMode] = useState(getMode());
  const [accent, setAccent] = useState(getAccent());

  // Apply live (localStorage + <html> attrs) AND persist to the DB so the choice
  // follows the user across devices/sessions. Keep the Redux user in sync too.
  const persist = (payload) => {
    dispatch(patchUser(payload));
    usersApi.updatePreferences(payload).catch(() => {});
  };
  const chooseMode = (m) => { setMode(applyMode(m)); persist({ theme: m }); };
  const chooseAccent = (a) => { setAccent(applyAccent(a)); persist({ accent: a }); };

  useEffect(() => {
    if (!open) return undefined;
    setMode(getMode());
    setAccent(getAccent());
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div>
            <h3 style={s.title}>Customize</h3>
            <p style={s.sub}>Personalize the look of your workspace</p>
          </div>
          <button className="icon-btn wg-x-btn" style={s.close} onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>

        <div style={s.sectionLabel}>Appearance</div>
        <div style={s.modes}>
          {MODES.map((m) => (
            <button key={m.key} type="button" className="wg-theme-opt"
              style={{ ...s.modeCard, ...(mode === m.key ? s.modeCardActive : {}) }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chooseMode(m.key)}>
              <div style={s.modePreview(m.key)}>
                <span style={s.previewBar} />
                <span style={{ ...s.previewBar, width: '55%' }} />
              </div>
              <span style={s.modeLabel}>
                {m.label}
                {mode === m.key && <span style={s.modeCheck}><IconCheck size={13} /></span>}
              </span>
            </button>
          ))}
        </div>

        <div style={s.sectionLabel}>Theme color</div>
        <div style={s.accents}>
          {ACCENTS.map((a) => (
            <button key={a.key} type="button" className="wg-theme-opt"
              style={{ ...s.accentRow, ...(accent === a.key ? s.accentRowActive : {}) }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chooseAccent(a.key)}>
              <span style={{ ...s.swatch, background: a.color }}>
                {accent === a.key && <span style={s.swatchCheck}><IconCheck size={12} /></span>}
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 80,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 14, padding: 22,
    width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.3)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--c-text-strong)' },
  sub: { margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' },
  close: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', padding: 4, display: 'inline-flex' },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    color: 'var(--c-muted)', margin: '6px 0 10px' },
  modes: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 },
  modeCard: { background: 'var(--c-surface)', border: '2px solid var(--c-border)', borderRadius: 12,
    padding: 8, cursor: 'pointer', textAlign: 'left' },
  modeCardActive: { borderColor: 'var(--c-primary)' },
  modePreview: (k) => ({
    height: 50, borderRadius: 8, marginBottom: 8, padding: 9, boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center',
    border: '1px solid rgba(128,128,128,.25)',
    background: k === 'light' ? '#ffffff' : k === 'dark' ? '#181b23'
      : 'linear-gradient(105deg, #ffffff 0 50%, #181b23 50% 100%)',
  }),
  previewBar: { height: 6, width: '80%', borderRadius: 3, background: 'var(--c-primary)', opacity: 0.9 },
  modeLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--c-text)' },
  modeCheck: { color: 'var(--c-primary)', display: 'inline-flex' },
  accents: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  accentRow: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-surface)',
    border: '1.5px solid var(--c-border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, color: 'var(--c-text)' },
  accentRowActive: { borderColor: 'var(--c-primary)', background: 'var(--c-primary-weak)' },
  swatch: { width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', color: '#fff' },
  swatchCheck: { display: 'inline-flex', color: '#fff' },
};
