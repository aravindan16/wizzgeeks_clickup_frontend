import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconTrash, IconHelp } from './icons';

const ConfirmContext = createContext(() => Promise.resolve(false));

/** useConfirm()(options) → Promise<boolean>. Options: { title, message, confirmLabel, cancelLabel, danger }. */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setOpts({ confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true, ...options });
  }), []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && <Dialog {...opts} onCancel={() => close(false)} onConfirm={() => close(true)} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({ title, message, confirmLabel, cancelLabel, danger, onCancel, onConfirm }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const accent = danger ? '#ef4444' : '#111827';
  const accentBg = danger ? '#fee2e2' : '#f1f2f4';

  return (
    <div style={s.backdrop} onMouseDown={onCancel} role="dialog" aria-modal="true">
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.body}>
          <div style={{ ...s.iconBox, background: accentBg, color: accent }}>
            {danger ? <IconTrash size={20} /> : <IconHelp size={20} />}
          </div>
          <h3 style={s.title}>{title}</h3>
          {message && <div style={s.message}>{message}</div>}
        </div>
        <div style={s.footer}>
          <button type="button" style={s.cancel} onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button"
            style={{ ...s.confirm, background: accent }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    animation: 'wg-fade 120ms ease' },
  modal: { background: '#fff', borderRadius: 16, width: 400, maxWidth: '94vw',
    boxShadow: '0 24px 64px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'wg-pop 160ms ease' },
  body: { padding: '22px 24px 18px' },
  iconBox: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 20, marginBottom: 14 },
  title: { margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' },
  message: { fontSize: 14, color: '#6b7280', lineHeight: 1.55 },
  footer: { display: 'flex', gap: 10, padding: '14px 24px 20px' },
  cancel: { flex: 1, padding: '11px 14px', background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#374151' },
  confirm: { flex: 1.4, padding: '11px 14px', color: '#fff', border: 'none',
    borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
};
