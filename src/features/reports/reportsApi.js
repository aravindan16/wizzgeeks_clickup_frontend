import apiClient from '../../services/apiClient';

export const REPORT_TYPES = [
  { value: 'daily_activity', label: 'Daily Activity', group: 'Daily', filters: ['date', 'user', 'project'] },
  { value: 'weekly_summary', label: 'Weekly Summary', group: 'Weekly', filters: ['ref_date', 'user', 'project'] },
  { value: 'monthly_productivity', label: 'Monthly Productivity', group: 'Monthly', filters: ['ref_date', 'user'] },
  { value: 'project_progress', label: 'Project Progress', group: 'Project', filters: ['project'] },
  { value: 'task_completion', label: 'Task Completion', group: 'Project', filters: ['project', 'status', 'priority'] },
  { value: 'delayed_tasks', label: 'Delayed Tasks', group: 'Project', filters: ['project', 'priority'] },
  { value: 'resource_utilization', label: 'Resource Utilization', group: 'Project', filters: ['project', 'ref_date'] },
  { value: 'team_performance', label: 'Team Performance', group: 'Team', filters: ['ref_date'] },
];

export const reportsApi = {
  generate: (params) => apiClient.get('/reports', { params }).then((r) => r.data),
  download: async (params, format) => {
    const res = await apiClient.get('/reports/export', {
      params: { ...params, format },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    const cd = res.headers['content-disposition'] || '';
    const m = cd.match(/filename="(.+)"/);
    a.download = m ? m[1] : `report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
