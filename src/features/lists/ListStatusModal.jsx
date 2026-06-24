import { useEffect, useState } from 'react';
import StatusEditor from '../projects/StatusEditor';
import { listsApi } from './listsApi';
import { useToast } from '../../components/Toast';

/**
 * ClickUp-style "Edit {List} statuses" — opened from a List's context menu.
 * Inherit the Space workflow or give the List its own custom statuses.
 */
export default function ListStatusModal({ open, list, spaceStatuses = [], onClose, onSaved }) {
  const toast = useToast();
  const [mode, setMode] = useState('inherit');

  useEffect(() => {
    if (open) setMode(list?.status_mode === 'custom' ? 'custom' : 'inherit');
  }, [open, list]);

  if (!open) return null;

  // Editing starts from the List's own statuses if custom, else the Space's set.
  const initial = (list?.status_mode === 'custom' && list?.statuses?.length) ? list.statuses : spaceStatuses;

  const apply = async (statuses) => {
    try {
      await listsApi.update(list._id, { status_mode: mode, statuses: mode === 'custom' ? statuses : [] });
      toast.success('Statuses updated');
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Could not update statuses');
    }
  };

  return (
    <StatusEditor open={open} initial={initial} mode={mode} onMode={setMode}
      title={`Edit ${list?.name || 'List'} statuses`} onApply={apply} onClose={onClose} />
  );
}
