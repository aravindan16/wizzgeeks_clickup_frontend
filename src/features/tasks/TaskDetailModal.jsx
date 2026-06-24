import { useEffect } from 'react';
import TaskDetail from './TaskDetail';

/**
 * Task detail rendered as an overlay modal (opened from the board/list). Closing
 * just dismisses the modal, so the user stays on the exact tab/page they were on.
 */
export default function TaskDetailModal({ taskId, onClose, onChanged, members, onOpenTask }) {
  useEffect(() => {
    if (!taskId) return undefined;
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [taskId, onClose]);

  if (!taskId) return null;

  return (
    <div style={ov.backdrop} onClick={onClose}>
      <div style={ov.modal} onClick={(e) => e.stopPropagation()}>
        <TaskDetail taskId={taskId} onClose={onClose} onChanged={onChanged} members={members} onOpenTask={onOpenTask} inModal />
      </div>
    </div>
  );
}

const ov = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 70,
    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3vh 2vw', overflow: 'hidden' },
  modal: { background: '#fff', borderRadius: 14, width: 1200, maxWidth: '96vw', height: '94vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(16,24,40,.32)' },
};
