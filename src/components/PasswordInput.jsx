import { useState } from 'react';
import { IconEye, IconEyeOff } from './icons';

/**
 * Password field with a show/hide eye toggle in the right corner.
 * Drop-in for <input type="password">: forwards all input props + style.
 */
export default function PasswordInput({ style, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div style={s.wrap}>
      <input {...props} type={show ? 'text' : 'password'}
        style={{ width: '100%', ...style, paddingRight: 40, boxSizing: 'border-box' }} />
      <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)}
        title={show ? 'Hide password' : 'Show password'} style={s.eye}>
        {show ? <IconEyeOff size={17} /> : <IconEye size={17} />}
      </button>
    </div>
  );
}

const s = {
  wrap: { position: 'relative', width: '100%' },
  eye: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none',
    border: 'none', cursor: 'pointer', color: 'var(--c-muted)', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', padding: 5, borderRadius: 6 },
};
