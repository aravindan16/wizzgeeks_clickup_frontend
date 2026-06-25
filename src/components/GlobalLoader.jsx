import { useEffect, useState } from 'react';
import { subscribeLoading } from '../services/apiClient';

/**
 * Centered circular spinner that covers the content area while the app has an
 * in-flight API request. Driven by the axios client's active-request counter, so
 * it covers every call without each page needing its own spinner. A short delay
 * avoids flashing the overlay for very fast requests.
 */
export default function GlobalLoader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer;
    const unsub = subscribeLoading((loading) => {
      clearTimeout(timer);
      if (loading) timer = setTimeout(() => setShow(true), 180);
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
