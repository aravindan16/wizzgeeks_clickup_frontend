// The card types available under "Custom" in the Add-card picker.
export const CARD_TYPES = [
  { type: 'line', title: 'Line Chart', desc: 'Tasks over time', color: '#6d5efc' },
  { type: 'bar', title: 'Bar Chart', desc: 'Tasks per List', color: '#f97316' },
  { type: 'pie', title: 'Pie Chart', desc: 'Tasks by status', color: '#10b981' },
  { type: 'calculation', title: 'Calculation', desc: 'Totals for your tasks', color: '#a855f7' },
  { type: 'portfolio', title: 'Portfolio', desc: 'Track progress of your Lists', color: '#3b82f6' },
];

export const cardTypeTitle = (type) => CARD_TYPES.find((c) => c.type === type)?.title || 'Portfolio';
