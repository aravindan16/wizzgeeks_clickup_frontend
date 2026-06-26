import { useEffect, useState } from 'react';
import { subscribeLoading } from '../services/apiClient';

/**
 * Centered circular spinner shown over the viewport while the app has an in-flight
 * (non-silent) API request. Mounted globally so it works on every page (login,
 * register, and the whole app). A short delay avoids flashing it for very fast
 * requests; silent/background calls (prefetch, drag, detail panels) don't trigger it.
 */
export default function GlobalLoader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer;
    const unsub = subscribeLoading((loading) => {
      clearTimeout(timer);
      if (loading) timer = setTimeout(() => setShow(true), 150);
      else setShow(false);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  if (!show) return null;
  return (
    <div className="wg-loader-overlay" aria-hidden="true">
      <span className="wg-spinner" />
    </div>
  );
}
