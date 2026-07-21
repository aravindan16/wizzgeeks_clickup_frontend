import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * One styled tooltip for the whole app. Mounted once (in main.jsx), it listens
 * app-wide for hover on any element carrying `title` or `data-tip`, renders a
 * single bubble in a portal (position:fixed) so it never gets clipped by a
 * scroll/overflow container, and suppresses the ugly native `title` tooltip by
 * moving it to `data-wg-title`.
 */
const readTip = (el) => el.getAttribute('data-tip') || el.getAttribute('data-wg-title');

export default function GlobalTooltip() {
  const [tip, setTip] = useState(null); // { text, cx, top, bottom }

  useEffect(() => {
    let curEl = null;

    // Walk up from the hovered node to the nearest element with a tooltip,
    // migrating any native `title` off the DOM so the browser bubble never shows.
    const closestTip = (start) => {
      // Zones marked [data-no-tip] (e.g. the left sidebar) suppress tooltips —
      // native titles are still stripped so the browser bubble never shows either.
      const noTip = start && start.closest ? start.closest('[data-no-tip]') : null;
      let el = start;
      while (el && el.nodeType === 1 && el !== document.body) {
        const t = el.getAttribute('title');
        if (t != null && t !== '') { el.setAttribute('data-wg-title', t); el.removeAttribute('title'); }
        if (!noTip && readTip(el)) return el;
        el = el.parentElement;
      }
      return null;
    };

    const show = (el) => {
      const text = readTip(el);
      if (!text) { setTip(null); curEl = null; return; }
      const r = el.getBoundingClientRect();
      curEl = el;
      setTip({ text, cx: r.left + r.width / 2, top: r.top, bottom: r.bottom });
    };

    const onOver = (e) => {
      const el = closestTip(e.target);
      if (el && el !== curEl) show(el);
    };
    const onOut = (e) => {
      if (!curEl) return;
      if (e.relatedTarget && curEl.contains(e.relatedTarget)) return; // still inside target
      curEl = null; setTip(null);
    };
    const hide = () => { curEl = null; setTip(null); };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;

  const above = tip.top > 56; // flip below when too close to the top edge
  const cx = Math.min(Math.max(tip.cx, 80), window.innerWidth - 80);
  const style = {
    left: cx,
    top: above ? tip.top - 9 : tip.bottom + 9,
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
  };
  return createPortal(
    <div className={`wg-gtip ${above ? 'is-above' : 'is-below'}`} style={style} role="tooltip">{tip.text}</div>,
    document.body,
  );
}
