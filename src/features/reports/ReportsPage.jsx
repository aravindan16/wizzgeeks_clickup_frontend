import { useEffect, useMemo, useState } from 'react';
import { REPORT_TYPES, reportsApi } from './reportsApi';
import { projectsApi } from '../projects/projectsApi';
import { usersApi } from '../users/usersApi';
import { PRIORITIES } from '../tasks/tasksApi';
import { STATUSES, STATUS_LABELS } from '../tasks/tasksApi';
import Select from '../../components/Select';
import { useAuth } from '../auth/useAuth';

export default function ReportsPage() {
  const { can } = useAuth();
  const [type, setType] = useState('daily_activity');
  const [filters, setFilters] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const def = useMemo(() => REPORT_TYPES.find((t) => t.value === type), [type]);
  const showFilter = (f) => def.filters.includes(f);

  useEffect(() => {
    projectsApi.list({ limit: 200 }).then((d) => setProjects(d.items)).catch(() => {});
    if (can('user.read')) usersApi.list({ limit: 200 }).then((d) => setUsers(d.items)).catch(() => {});
  }, [can]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const cleanParams = () => {
    const p = { type };
    def.filters.forEach((f) => {
      const key = f === 'user' ? 'user_id' : f === 'project' ? 'project_id' : f;
      if (filters[key]) p[key] = filters[key];
    });
    return p;
  };

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      setReport(await reportsApi.generate(cleanParams()));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const download = async (format) => {
    try { await reportsApi.download(cleanParams(), format); }
    catch { setError('Export failed'); }
  };

  return (
    <div>
      <h2>Reports & Export</h2>

      <div className="card" style={{ maxWidth: '100%', marginBottom: 16 }}>
        <div style={s.filters}>
          <Field label="Report">
            <Select value={type} onChange={(v) => { setType(v); setReport(null); }} style={{ minWidth: 240 }}
              options={REPORT_TYPES.map((t) => ({ value: t.value, label: `${t.group} · ${t.label}` }))} />
          </Field>

          {showFilter('date') && (
            <Field label="Date"><input style={s.input} type="date" value={filters.date || ''} onChange={(e) => setFilter('date', e.target.value)} /></Field>
          )}
          {showFilter('ref_date') && (
            <Field label="Reference date"><input style={s.input} type="date" value={filters.ref_date || ''} onChange={(e) => setFilter('ref_date', e.target.value)} /></Field>
          )}
          {showFilter('user') && can('user.read') && (
            <Field label="User">
              <Select value={filters.user_id || ''} onChange={(v) => setFilter('user_id', v)} style={{ minWidth: 170 }}
                options={[{ value: '', label: 'All / me' }, ...users.map((u) => ({ value: u._id, label: u.full_name }))]} />
            </Field>
          )}
          {showFilter('project') && (
            <Field label="Project">
              <Select value={filters.project_id || ''} onChange={(v) => setFilter('project_id', v)} style={{ minWidth: 160 }}
                options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p._id, label: p.key }))]} />
            </Field>
          )}
          {showFilter('status') && (
            <Field label="Status">
              <Select value={filters.status || ''} onChange={(v) => setFilter('status', v)} style={{ minWidth: 150 }}
                options={[{ value: '', label: 'Any' }, ...STATUSES.map((st) => ({ value: st, label: STATUS_LABELS[st] }))]} />
            </Field>
          )}
          {showFilter('priority') && (
            <Field label="Priority">
              <Select value={filters.priority || ''} onChange={(v) => setFilter('priority', v)} style={{ minWidth: 150 }}
                options={[{ value: '', label: 'Any' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
            </Field>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={s.primary} onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button style={s.ghost} onClick={() => download('xlsx')} disabled={!report}>⬇ Excel</button>
          <button style={s.ghost} onClick={() => download('pdf')} disabled={!report}>⬇ PDF</button>
        </div>
        {error && <p style={{ color: '#991b1b' }}>{error}</p>}
      </div>

      {report && (
        <div>
          <div style={s.previewHead}>
            <h3 style={{ margin: 0 }}>{report.title}</h3>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Generated {new Date(report.generated_at).toLocaleString()}</span>
          </div>

          <div style={s.summary}>
            {Object.entries(report.summary).map(([k, v]) => (
              <div key={k} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700 }}>{String(v)}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{k}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'auto' }}>
            <table style={s.table}>
              <thead><tr>{report.columns.map((c) => <th key={c.key} style={s.th}>{c.label}</th>)}</tr></thead>
              <tbody>
                {report.rows.length === 0 && (
                  <tr><td colSpan={report.columns.length} style={s.empty}>No data for these filters.</td></tr>
                )}
                {report.rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    {report.columns.map((c) => <td key={c.key} style={s.td}>{String(row[c.key] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{label}</span>
      {children}
    </label>
  );
}

const s = {
  filters: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8, minWidth: 150 },
  primary: { padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '9px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' },
  previewHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  summary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: 12, textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb', whiteSpace: 'nowrap' },
  td: { padding: '8px 12px', fontSize: 13 },
  empty: { padding: 20, textAlign: 'center', color: '#6b7280' },
};
