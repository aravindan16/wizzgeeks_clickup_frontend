import { IconTypeTask, IconTypeBug, IconTypeStory, IconTypeEpic, IconTypeSubtask } from './icons';

const MAP = {
  task: IconTypeTask,
  bug: IconTypeBug,
  story: IconTypeStory,
  epic: IconTypeEpic,
  subtask: IconTypeSubtask,
};

/** Monochrome line icon for a task type (replaces the old colored emoji). */
export default function TaskTypeIcon({ type, size = 15 }) {
  const Cmp = MAP[type] || IconTypeTask;
  return <Cmp size={size} />;
}
