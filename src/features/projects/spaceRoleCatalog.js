/**
 * Catalog of granular space permissions (grouped, ClickUp/Jira-style) plus the
 * built-in system roles. Custom roles pick from PERMISSION_GROUPS; the chosen
 * permission keys persist on the role (backend `space_roles.permissions`).
 */

// Each group has a parent (select-all) + child permissions.
export const PERMISSION_GROUPS = [
  {
    key: 'administer', label: 'Administer space',
    description: 'Update space settings, manage members and roles, and delete the space.',
    perms: [
      { key: 'space.manage', label: 'Manage space settings', description: 'Edit space details, custom fields, and status workflow.' },
      { key: 'space.members.manage', label: 'Manage members & roles', description: 'Add, remove, and change roles of people in this space.' },
      { key: 'space.delete', label: 'Delete space', description: 'Permanently delete this space and all its work.' },
    ],
  },
  {
    key: 'manage_tasks', label: 'Manage tasks',
    description: 'Edit reporters, delete any task or comment, and archive/restore tasks.',
    perms: [
      { key: 'task.delete_any', label: 'Delete any task', description: 'Delete any task in this space, including its comments and data.' },
      { key: 'task.comment.delete_any', label: 'Delete any comment', description: 'Delete comments added by anyone on any task.' },
      { key: 'task.comment.edit_any', label: 'Edit any comment', description: 'Edit comments added by anyone on any task.' },
      { key: 'task.reporter.edit', label: 'Edit reporters', description: 'Modify the reporter field on any task.' },
      { key: 'task.archive_any', label: 'Archive / restore any task', description: 'Archive or restore any task, including its subtasks.' },
    ],
  },
  {
    key: 'work_tasks', label: 'Work on tasks',
    description: 'Create, edit, assign, transition, move, and link tasks.',
    perms: [
      { key: 'task.create', label: 'Create tasks', description: 'Create tasks and fill out their fields.' },
      { key: 'task.edit_any', label: 'Edit any task', description: 'Change the title, description, and custom fields on any task.' },
      { key: 'task.assign', label: 'Assign any task', description: 'Add or modify the assignee on any task.' },
      { key: 'task.transition', label: 'Transition any task', description: 'Move any task to a different status.' },
      { key: 'task.move', label: 'Move any task', description: 'Move any task into other lists or spaces.' },
      { key: 'task.link', label: 'Link any task', description: 'Link tasks together via relationship fields.' },
      { key: 'task.due.edit', label: 'Edit any due date', description: "Change any task's due date after creation." },
    ],
  },
  {
    key: 'collaborate', label: 'Collaborate on tasks',
    description: 'Comment, attach files, and manage your own contributions.',
    perms: [
      { key: 'task.comment.add', label: 'Add comments', description: 'Add comments to any task.' },
      { key: 'task.attachment.add', label: 'Add attachments', description: 'Add attachments to any task.' },
      { key: 'task.comment.edit_own', label: 'Edit their own comments', description: 'Edit only the comments added by the user.' },
      { key: 'task.comment.delete_own', label: 'Delete their own comments', description: 'Delete only the comments added by the user.' },
      { key: 'task.watchers.view', label: 'View watchers', description: 'See the list of people watching any task.' },
    ],
  },
  {
    key: 'view', label: 'View space',
    description: 'Search, view, and read tasks in this space.',
    perms: [
      { key: 'task.view', label: 'View tasks', description: 'Search for and view tasks in this space.' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

// The three built-in roles used across the whole app (plus per-space custom roles).
export const SYSTEM_ROLES = [
  {
    key: 'super_admin', name: 'Super Admin', system: true,
    description: 'Full control over the space and everything in it.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'admin', name: 'Admin', system: true,
    description: 'Can do most things, like update settings, manage members, and manage tasks.',
    permissions: PERMISSION_GROUPS.filter((g) => g.key !== 'administer')
      .flatMap((g) => g.perms.map((p) => p.key))
      .concat(['space.manage', 'space.members.manage']),
  },
  {
    key: 'employee', name: 'Employee', system: true,
    description: 'Part of the team — can create, edit, and collaborate on work.',
    permissions: PERMISSION_GROUPS.filter((g) => ['work_tasks', 'collaborate', 'view'].includes(g.key)).flatMap((g) => g.perms.map((p) => p.key)),
  },
];
