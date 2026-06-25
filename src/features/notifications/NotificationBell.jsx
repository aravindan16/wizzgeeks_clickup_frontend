import { useEffect, useRef, useState } from 'react';
import { notificationsApi } from './notificationsApi';
import { IconBell, IconMembers, IconSettings } from '../../components/icons';
import TaskTypeIcon from '../../components/TaskTypeIcon';

const TYPE_ICON = {
  'task.assigned': <TaskTypeIcon type="task" size={15} />,
  'project.member_added': <IconMembers size={15} />,
  'project.role_changed': <IconSettings size={15} />,
  'user.role_changed': <IconSettings size={15} />,
};

/**
 * Topbar notification bell. Polls unread notifications every 60s (no websockets
 * yet) and shows a dropdown list with mark-as-read.
 */
export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const ref = useRef(null);

  const load = () => notificationsApi.list({ limit: 20 }).then(setData).catch(() => {});

  useEffect(() => {
    load();
    timer.current = setInterval(load, 60000);
    return () => clearInterval(timer.current);
  }, []);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const markRead = async (id) => { await notificationsApi.markRead(id); load(); };
  const markAll = async () => { await notificationsApi.markAllRead(); load(); };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button style={s.bell} onClick={() => setOpen((o) => !o)} title="Notifications">
        <IconBell size={18} />
        {data.unread > 0 && <span style={s.badge}>{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div style={s.dropdown}>
          <div style={s.dropHead}>
            <strong>Notifications</strong>
            {data.unread > 0 && <button style={s.link} onClick={markAll}>Mark all read</button>}
          </div>
          {data.items.length === 0 && <div style={s.empty}>No notifications</div>}
          {data.items.map((n) => (
            <div key={n.id} style={{ ...s.item, background: n.is_read ? '#fff' : '#f3f4f6' }}>
              <span style={s.typeIcon}>{TYPE_ICON[n.type] || <IconBell size={15} />}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12, color: '#6b7280' }}>{n.body}</div>}
              </div>
              {!n.is_read && <button style={s.dot} title="Mark read" onClick={() => markRead(n.id)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  bell: { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8 },
  badge: { position: 'absolute', top: 2, right: 2, transform: 'translate(35%,-35%)',
    minWidth: 17, height: 17, padding: '0 4px', boxSizing: 'border-box',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#ef4444', color: '#fff', border: '2px solid #fff', borderRadius: 999,
    fontSize: 10.5, fontWeight: 700, lineHeight: 1 },
  dropdown: { position: 'absolute', right: 0, top: 32, width: 320, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 60 },
  dropHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
    borderBottom: '1px solid #f1f5f9' },
  item: { display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderBottom: '1px solid #f8fafc' },
  typeIcon: { display: 'inline-flex', alignItems: 'center', color: '#6b7280', flexShrink: 0 },
  empty: { padding: 20, textAlign: 'center', color: '#6b7280' },
  link: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 999, background: '#111827', border: 'none', cursor: 'pointer' },
};
