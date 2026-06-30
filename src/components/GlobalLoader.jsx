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
    let showTimer, hideTimer;
    const unsub = subscribeLoading((loading) => {
      if (loading) {
        // A request started — cancel any pending hide so a mutation followed by a
        // refetch keeps ONE continuous loader instead of close→reopen flicker.
        clearTimeout(hideTimer);
        showTimer = setTimeout(() => setShow(true), 150);
      } else {
        // No requests in flight — wait briefly before hiding; if the next request
        // (e.g. the post-update refetch) starts within this window, we keep showing.
        clearTimeout(showTimer);
        hideTimer = setTimeout(() => setShow(false), 250);
      }
    });
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); unsub(); };
  }, []);

  if (!show) return null;
  return (
    <div className="wg-loader-overlay" aria-hidden="true">
      <span className="wg-spinner" />
    </div>
  );
}
