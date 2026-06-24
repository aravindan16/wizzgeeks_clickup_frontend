import { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Renders the official Google Sign-In button (Google Identity Services).
 * On success it hands the ID-token credential to `onCredential`. Renders nothing
 * if VITE_GOOGLE_CLIENT_ID isn't configured.
 */
export default function GoogleButton({ onCredential }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let timer;
    const init = () => {
      if (!window.google?.accounts?.id || !ref.current) return false;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => resp?.credential && onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', width: 320, text: 'continue_with',
      });
      return true;
    };
    if (!init()) {
      timer = setInterval(() => { if (init()) clearInterval(timer); }, 200);
    }
    return () => timer && clearInterval(timer);
  }, [onCredential]);

  if (!CLIENT_ID) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={divider}><span style={dividerText}>or</span></div>
      <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

const divider = { display: 'flex', alignItems: 'center', textAlign: 'center', color: '#9ca3af', margin: '12px 0' };
const dividerText = { flex: 'none', padding: '0 10px', fontSize: 12, borderTop: 'none' };
