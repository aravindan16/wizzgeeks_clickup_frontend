import { useEffect, useState } from 'react';

/**
 * Which fields show on a board task card — a ClickUp-style "Customize view".
 * Task Name is always shown; every other field is toggleable and the choice is
 * persisted per List (localStorage). List-scoped custom fields are toggled under
 * the `cf:<id>` key.
 */
export const STD_CARD_FIELDS = [
  { key: 'priority', label: 'Priority', def: true },
  { key: 'status', label: 'Status', def: false },
  { key: 'key', label: 'Task ID', def: true },
  { key: 'type', label: 'Task type', def: false },
  { key: 'assignee', label: 'Assignee', def: true },
  { key: 'created_at', label: 'Date created', def: false },
  { key: 'due_date', label: 'Due date', def: true },
  { key: 'labels', label: 'Labels', def: true },
];

const lsKey = (scope) => `wg_card_fields_${scope || 'global'}`;

export function useCardFields(scope) {
  const [config, setConfig] = useState({});
  useEffect(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(lsKey(scope)) || '{}'); } catch { /* ignore */ }
    setConfig(saved);
  }, [scope]);

  // Effective on/off — falls back to the field's default when never toggled.
  const isOn = (key, def = false) => (config[key] === undefined ? def : !!config[key]);
  const set = (key, val) => setConfig((c) => {
    const next = { ...c, [key]: val };
    try { localStorage.setItem(lsKey(scope), JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // Resolved visibility maps for the board to consume.
  const std = {};
  STD_CARD_FIELDS.forEach((f) => { std[f.key] = isOn(f.key, f.def); });
  return { config, isOn, set, std };
}
