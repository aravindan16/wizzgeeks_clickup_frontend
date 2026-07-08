import { List as LucideList, ListChecks as LucideListChecks, ListFilter as LucideListFilter } from 'lucide-react';

/* Lightweight Lucide-style line icons (stroke = currentColor). Visual only. */
const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
});

export const IconRecent = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7.5v5l3.5 2" /></svg>
);
export const IconStar = ({ size = 18 }) => (
  <svg {...base(size)}><polygon points="12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.4 12 17.3 6.2 20.4 7.3 13.9 2.6 9.3 9.1 8.4" /></svg>
);
export const IconEye = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconEyeOff = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M10.7 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a13.4 13.4 0 0 1-1.7 2.7" /><path d="M6.6 6.6A13.3 13.3 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" /><path d="m2 2 20 20" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
export const IconDashboard = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M12 14.5 16 10" /><path d="M4 19a9 9 0 1 1 16 0" /><path d="M4 19h16" /></svg>
);
export const IconActivity = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
export const IconReports = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M3 3v17a1 1 0 0 0 1 1h17" /><rect x="7" y="11" width="3" height="6" rx="1" /><rect x="12" y="7" width="3" height="10" rx="1" /><rect x="17" y="13" width="3" height="4" rx="1" /></svg>
);
export const IconBoard = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M9 3v18M15 3v18" /></svg>
);
export const IconMembers = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" /><path d="M18 20a6 6 0 0 0-3-5.2" /></svg>
);
export const IconList = ({ size = 18 }) => <LucideList size={size} strokeWidth={1.9} />;
export const IconListCheck = ({ size = 18 }) => <LucideListChecks size={size} strokeWidth={1.9} />;
export const IconDots = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>
);
export const IconSearch = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
);
export const IconBell = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
export const IconHelp = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9.5" /><path d="M9.2 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.4-2.6 2.4" /><path d="M12 17h.01" /></svg>
);
export const IconChevronDown = ({ size = 16 }) => (
  <svg {...base(size)}><path d="m6 9 6 6 6-6" /></svg>
);
/** Expand/collapse caret: points down when open, right when collapsed. */
export const Chevron = ({ open, size = 14 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', color: 'inherit',
    transition: 'transform .15s', transform: open ? 'none' : 'rotate(-90deg)' }}>
    <IconChevronDown size={size} />
  </span>
);
export const IconPlus = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconPanel = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M9 3v18" /></svg>
);
export const IconTrash = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
);
export const IconEdit = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
);
export const IconFields = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 9h10" /><path d="M7 13h6" /></svg>
);
export const IconMove = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
);
export const IconFieldText = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M5 6V5h14v1" /><path d="M12 5v14" /><path d="M9 19h6" /></svg>
);
export const IconFieldDropdown = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M6 11h6" /><path d="M15 10l2 2 2-2" /></svg>
);
export const IconFieldRelationship = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="18" cy="6" r="2.4" /><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.2 10.9l7.5-3.6" /><path d="M8.2 13.1l7.5 3.6" /></svg>
);
export const IconCalendar = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M16 2.5v4M8 2.5v4M3 9.5h18" /></svg>
);
export const IconUser = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>
);
export const IconFlag = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M4 21V4" /><path d="M4 4.5h13l-2 4 2 4H4" /></svg>
);
export const IconTag = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>
);
export const IconClose = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconGrip = ({ size = 18 }) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
  </svg>
);
export const IconExpand = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M8 3H3v5M16 3h5v5M16 21h5v-5M8 21H3v-5" /></svg>
);
export const IconLogout = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
);
export const IconCheck = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IconFilter = ({ size = 18 }) => <LucideListFilter size={size} strokeWidth={1.9} />;
export const IconArrowLeft = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
);
export const IconEnter = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M9 10l-4 4 4 4" /><path d="M5 14h11a4 4 0 0 0 4-4V6" /></svg>
);
export const IconMoon = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);
export const IconSun = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconFolder = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);
export const IconSmile = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9.2" /><path d="M8.2 14.2a4.6 4.6 0 0 0 7.6 0" /><path d="M9 9.5h.01" /><path d="M15 9.5h.01" /></svg>
);
// --- Task type icons (monochrome) ---
export const IconTypeTask = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.2 2.2 4.3-4.4" /></svg>
);
export const IconTypeBug = ({ size = 18 }) => (
  <svg {...base(size)}><rect x="8" y="7" width="8" height="12" rx="4" /><path d="M12 7V5M9 9 6.5 7M15 9l2.5-2M9 13H5M19 13h-4M9 17l-2.5 2M15 17l2.5 2" /></svg>
);
export const IconTypeStory = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" /></svg>
);
export const IconTypeEpic = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const IconTypeSubtask = ({ size = 18 }) => (
  <svg {...base(size)}><path d="M5 4v8a3 3 0 0 0 3 3h8" /><path d="m14 11 4 4-4 4" /></svg>
);
export const IconSettings = ({ size = 18 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.8 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6h.1A1.6 1.6 0 0 0 11 3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1A1.6 1.6 0 0 0 21 10.9h.1a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.6 1z" /></svg>
);
