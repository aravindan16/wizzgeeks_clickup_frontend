import { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/admin/audit-logs', { params: { skip: page * PAGE_SIZE, limit: PAGE_SIZE } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div>
      <h2>Audit Log</h2>
      <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr>
              {['When', 'Action', 'Entity', 'Actor', 'Details'].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={empty}>Loading…</td></tr>}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={5} style={empty}>No audit entries.</td></tr>
            )}
            {!loading && data.items.map((e) => (
              <tr key={e._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={td}>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                <td style={td}><code>{e.action}</code></td>
                <td style={td}>{e.entity_type}</td>
                <td style={td}>{e.actor_id || '—'}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                  {JSON.stringify(e.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: '#6b7280' }}>
        <span>{data.total} entries · page {page + 1} of {totalPages}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={ghost} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <button style={ghost} disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

const th = { textAlign: 'left', padding: '12px 14px', fontSize: 12, textTransform: 'uppercase',
  color: '#6b7280', background: '#f9fafb' };
const td = { padding: '10px 14px', fontSize: 14 };
const empty = { padding: 24, textAlign: 'center', color: '#6b7280' };
const ghost = { padding: '8px 14px', background: '#fff', border: '1px solid #d1d5db',
  borderRadius: 8, cursor: 'pointer' };
