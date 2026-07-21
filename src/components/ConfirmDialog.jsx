import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconTrash, IconHelp, IconEdit, IconClose } from './icons';

const ConfirmContext = createContext(() => Promise.resolve(false));
const PromptContext = createContext(() => Promise.resolve(null));

/** useConfirm()(options) → Promise<boolean>. Options: { title, message, confirmLabel, cancelLabel, danger }. */
export function useConfirm() {
  return useContext(ConfirmContext);
}
/** usePrompt()(options) → Promise<string|null>. Options: { title, message, defaultValue, placeholder, confirmLabel }. */
export function usePrompt() {
  return useContext(PromptContext);
}

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setOpts({ confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true, ...options });
  }), []);

  const prompt = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setOpts({ prompt: true, confirmLabel: 'Save', cancelLabel: 'Cancel', danger: false, defaultValue: '', ...options });
  }), []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      <PromptContext.Provider value={prompt}>
        {children}
        {opts && (
          <Dialog {...opts}
            onCancel={() => close(opts.prompt ? null : false)}
            onConfirm={(val) => close(opts.prompt ? val : true)} />
        )}
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}

function Dialog({ title, message, confirmLabel, cancelLabel, danger, prompt, defaultValue, placeholder, validate, onCancel, onConfirm }) {
  const confirmRef = useRef(null);
  const inputRef = useRef(null);
  const [val, setVal] = useState(defaultValue || '');
  const [error, setError] = useState('');
  const canConfirm = !prompt || val.trim().length > 0;

  useEffect(() => {
    if (prompt) { inputRef.current?.focus(); inputRef.current?.select(); }
    else confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !prompt) onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, prompt]);

  const submit = () => {
    if (!canConfirm) return;
    if (prompt && validate) {
      // Keep the modal open and show the error inline instead of resolving.
      const err = validate(val.trim());
      if (err) { setError(err); inputRef.current?.focus(); return; }
    }
    onConfirm(prompt ? val.trim() : true);
  };
  const accent = danger ? '#ef4444' : '#111827';
  const accentBg = danger ? '#fee2e2' : '#f1f2f4';

  return (
    <div style={s.backdrop} onMouseDown={onCancel} role="dialog" aria-modal="true">
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn wg-x-btn" style={s.close} onClick={onCancel} aria-label="Close"><IconClose size={18} /></button>
        <div style={s.body}>
          <div style={{ ...s.iconBox, background: accentBg, color: accent }}>
            {prompt ? <IconEdit size={20} /> : danger ? <IconTrash size={20} /> : <IconHelp size={20} />}
          </div>
          <h3 style={s.title}>{title}</h3>
          {message && <div style={s.message}>{message}</div>}
          {prompt && (
            <input ref={inputRef} style={{ ...s.input, ...(error ? s.inputError : {}) }} value={val} placeholder={placeholder || ''}
              onChange={(e) => { setVal(e.target.value); if (error) setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
          )}
          {prompt && error && <div style={s.error}>{error}</div>}
        </div>
        <div style={s.footer}>
          <button type="button" style={s.cancel} onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" disabled={!canConfirm}
            style={{ ...s.confirm, background: accent, ...(canConfirm ? {} : s.confirmDisabled) }}
            onClick={submit}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    animation: 'wg-fade 120ms ease' },
  modal: { position: 'relative', background: '#fff', borderRadius: 16, width: 400, maxWidth: '94vw',
    boxShadow: '0 24px 64px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'wg-pop 160ms ease' },
  close: { position: 'absolute', top: 10, right: 10, border: 'none', background: 'none', color: 'var(--c-muted, #6b7280)',
    cursor: 'pointer', display: 'inline-flex', padding: 6, borderRadius: 8, zIndex: 1 },
  body: { padding: '22px 24px 18px' },
  iconBox: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 20, marginBottom: 14 },
  title: { margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111827' },
  message: { fontSize: 14, color: '#6b7280', lineHeight: 1.55 },
  input: { width: '100%', boxSizing: 'border-box', marginTop: 14, padding: '11px 13px', fontSize: 14,
    border: '1px solid #d1d5db', borderRadius: 10, outline: 'none', color: '#111827' },
  inputError: { borderColor: '#ef4444' },
  error: { marginTop: 8, fontSize: 13, color: '#dc2626', fontWeight: 500 },
  footer: { display: 'flex', gap: 10, padding: '14px 24px 20px' },
  cancel: { flex: 1, padding: '11px 14px', background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#374151' },
  confirm: { flex: 1.4, padding: '11px 14px', color: '#fff', border: 'none',
    borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  confirmDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
