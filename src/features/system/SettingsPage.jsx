import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../../services/apiClient';
import { useToast } from '../../components/Toast';
import { useHeaderSlot } from '../../layouts/headerSlot';

/**
 * Admin Settings & System Status: organization settings (editable) plus live
 * system health, version, collection counts, and feature flags.
 */
export default function SettingsPage() {
  const toast = useToast();
  const slotEl = useHeaderSlot();
  const [org, setOrg] = useState(null);
  const [status, setStatus] = useState(null);

  const load = () => {
    apiClient.get('/admin/settings').then((r) => setOrg(r.data)).catch(() => {});
    apiClient.get('/admin/status').then((r) => setStatus(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try { await apiClient.patch('/admin/settings', org); toast.success('Settings saved'); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Save failed'); }
  };

  return (
    <div>
      {slotEl && createPortal(<span style={headerTitle}>Settings &amp; System Status</span>, slotEl)}
      <div style={grid}>
        <form onSubmit={save} className="card">
          <strong>Organization Settings</strong>
          {!org ? <p>Loading…</p> : (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Field label="Organization name" value={org.org_name} onChange={(v) => setOrg({ ...org, org_name: v })} />
              <Field label="Timezone" value={org.timezone} onChange={(v) => setOrg({ ...org, timezone: v })} />
              <Field label="Work week hours" type="number" value={org.work_week_hours}
                onChange={(v) => setOrg({ ...org, work_week_hours: Number(v) })} />
              <Field label="Daily update cutoff" value={org.daily_update_cutoff}
                onChange={(v) => setOrg({ ...org, daily_update_cutoff: v })} />
              <button style={btn} type="submit">Save settings</button>
            </div>
          )}
        </form>

        <div className="card">
          <strong>System Status</strong>
          {!status ? <p>Loading…</p> : (
            <div style={{ marginTop: 10 }}>
              <Row k="Version" v={status.version} />
              <Row k="Environment" v={status.environment} />
              <Row k="Database" v={status.database.connected ? '🟢 Connected' : '🔴 Down'} />
              <div style={{ marginTop: 10, fontWeight: 600 }}>Collections</div>
              {Object.entries(status.collections).map(([k, v]) => <Row key={k} k={k} v={v} />)}
              <div style={{ marginTop: 10, fontWeight: 600 }}>Features</div>
              {Object.entries(status.features).map(([k, v]) => <Row key={k} k={k} v={v ? 'on' : 'off'} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input style={inp} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, borderTop: '1px solid #f8fafc' }}>
      <span style={{ color: '#6b7280' }}>{k}</span><span>{String(v)}</span>
    </div>
  );
}

const headerTitle = { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 };
const inp = { padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8 };
const btn = { marginTop: 6, padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
