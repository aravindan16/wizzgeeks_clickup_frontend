import { IconTypeTask, IconListCheck, IconFolder, IconDashboard, IconReports } from './icons';

const MAP = {
  Task: IconTypeTask,
  List: IconListCheck,
  Space: IconFolder,
  Dashboard: IconDashboard,
  Page: IconReports,
};

/** Monochrome icon for a recently-visited entity type (replaces stored emoji). */
export default function RecentTypeIcon({ type, size = 16 }) {
  const Cmp = MAP[type] || IconReports;
  return <Cmp size={size} />;
}
