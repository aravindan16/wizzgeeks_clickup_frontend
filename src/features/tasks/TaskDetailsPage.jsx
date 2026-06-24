import { useParams, useNavigate } from 'react-router-dom';
import TaskDetail from './TaskDetail';

/**
 * Full-page task detail for deep links (Recent, dashboards, direct URLs). Closing
 * does a browser-back so the user returns to their previous page/tab.
 */
export default function TaskDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = () => {
    // Prefer browser-back; fall back to the task's board.
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return <TaskDetail taskId={id} onClose={goBack} onChanged={() => {}} onOpenTask={(tid) => navigate(`/tasks/${tid}`)} />;
}
