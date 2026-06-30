import { createContext, useCallback, useContext, useRef, useState } from 'react';

/**
 * Global toast notifications. Wrap the app in <ToastProvider> and call
 * useToast() -> { success, error, info } anywhere.
 */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((message, type) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const api = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...styles.toast, ...styles[t.type] }} onClick={() => remove(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Fallback to console if used outside a provider (keeps callers safe).
  return ctx || { success: console.log, error: console.error, info: console.log };
}

const styles = {
  container: { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 9999, pointerEvents: 'none' },
  toast: { padding: '12px 18px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,.18)', maxWidth: 'min(90vw, 420px)', textAlign: 'center', pointerEvents: 'auto' },
  success: { background: '#16a34a' },
  error: { background: '#b91c1c' },
  info: { background: '#111827' },
};
