// Optional leading checkbox column (bulk selection). `sel` is
// { selected:Set, onToggle(task), allSelected, onToggleAll } or null.
export const selectionColumn = (sel) => (sel ? [{
  key: '_sel', label: '', width: 42, min: 42, align: 'center',
  header: (
    <input type="checkbox" checked={sel.allSelected} onChange={sel.onToggleAll}
      title={sel.allSelected ? 'Clear selection' : 'Select all'} onClick={(e) => e.stopPropagation()} />
  ),
  render: (t) => (
    <input type="checkbox" checked={sel.selected.has(t._id)} onChange={() => sel.onToggle(t)}
      onClick={(e) => e.stopPropagation()} />
  ),
}] : []);
