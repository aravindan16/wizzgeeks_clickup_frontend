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
        showTimer = setTimeout(() => setShow(true), 120);
      } else {
        // No requests in flight — wait before hiding. On a page load, requests arrive
        // in WAVES (bootstrap → page data → sidebar prefetch) with short gaps while the
        // route chunk mounts; a generous window bridges those gaps so the loader stays
        // continuous and only closes once everything has truly settled.
        clearTimeout(showTimer);
        hideTimer = setTimeout(() => setShow(false), 700);
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
