import { useNavigate } from 'react-router-dom';
import { useRecentlyVisited } from './useRecentlyVisited';
import { clearRecent } from './recentStore';
import { relativeTime } from '../../utils/relativeTime';
import RecentTypeIcon from '../../components/RecentTypeIcon';

/**
 * "Recently Visited" section — shows the last 10 visited pages (most recent first),
 * each with an icon, name, type, and relative time. Clicking navigates to the page.
 */
export default function RecentlyVisited() {
  const items = useRecentlyVisited();
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <div className="card" style={s.card}>
      <div style={s.header}>
        <strong>Recently Visited</strong>
        <button style={s.clear} onClick={clearRecent}>Clear</button>
      </div>
      <div style={s.grid}>
        {items.map((item) => (
          <button key={item.path} style={s.item} onClick={() => navigate(item.path)} title={item.name}>
            <span style={s.icon}><RecentTypeIcon type={item.type} size={18} /></span>
            <span style={s.meta}>
              <span style={s.name}>{item.name}</span>
              <span style={s.sub}>{item.type} · {relativeTime(item.visited_at)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const s = {
  card: { maxWidth: '100%', marginBottom: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clear: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
    border: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  icon: { width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 },
  meta: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  name: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sub: { fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' },
};
