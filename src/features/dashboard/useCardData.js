import { useEffect, useState } from 'react';
import { tasksApi, resolveStatuses, isDoneStatus, statusLabel, statusColor, PRIORITY_COLOR, STATUS_GROUPS } from '../tasks/tasksApi';

const GROUP_COLOR = { not_started: '#9ca3af', active: '#3b82f6', done: '#22c55e', closed: '#16a34a' };
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { beginSilent, endSilent } from '../../services/apiClient';

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/**
 * Loads the card's tracked units and derives the aggregates every card type needs.
 * Two source modes:
 *   - 'lists' (default): each unit is a List; its tasks come from the task list endpoint.
 *   - 'tasks': each unit is an EPIC task; its "tasks" are the related/child tasks linked
 *     through that task's relationship custom fields (the "EPIC / <list>" blocks).
 * "Done" = status group ∈ {done, closed}. Returns null while loading.
 */
export function useCardData(card) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      beginSilent(); // background load — don't flash the global loader
      try {
        const stCache = {}; // spaceId -> resolved statuses
        const getSts = async (spaceId) => {
          if (!spaceId) return [];
          if (stCache[spaceId] === undefined) {
            const sp = await projectsApi.get(spaceId).catch(() => null);
            stCache[spaceId] = sp ? resolveStatuses(sp) : [];
          }
          return stCache[spaceId];
        };
        const t0 = todayStart();
        const mkCounts = (tasks, sts) => {
          const done = tasks.filter((t) => isDoneStatus(sts, t.status)).length;
          const due = tasks.filter((t) => {
            if (isDoneStatus(sts, t.status)) return false;
            const d = t.end_date || t.due_date;
            return d && new Date(`${d}T00:00`) < t0;
          }).length;
          return { done, due };
        };

        let rows;
        if (card.source === 'tasks') {
          // Related mode: each unit is a List; its "tasks" are the related tasks linked
          // from that List's tasks through relationship custom fields, optionally filtered
          // to the chosen related Lists (Frontend / Backend …).
          rows = await Promise.all((card.tasks || []).map(async (meta) => {
            const fields = await customFieldsApi.list(meta.spaceId, meta.id).catch(() => []);
            const relFields = (fields || []).filter((f) => f.type === 'relationship');
            const want = meta.lists || [];
            const useFields = want.length ? relFields.filter((f) => want.includes(f.location)) : relFields;

            const res = await tasksApi.list({ list_id: meta.id, limit: 200 }).catch(() => ({ items: [] }));
            const parents = res.items || [];
            const childGroup = {}; // childId -> related list name
            let childIds = [];
            parents.forEach((pt) => {
              const cf = pt.custom_fields || {};
              useFields.forEach((f) => {
                const v = cf[f._id];
                const arr = Array.isArray(v) ? v : (v ? [v] : []);
                arr.forEach((id) => { if (id) { childIds.push(id); childGroup[id] = f.location || ''; } });
              });
            });
            childIds = [...new Set(childIds)];

            const children = (await Promise.all(childIds.map((id) => tasksApi.get(id).catch(() => null)))).filter(Boolean);
            children.forEach((c) => { c._groupList = childGroup[c._id] || ''; });
            // Merge statuses across every space the children live in (for labels + done).
            const sts = [];
            const seen = {};
            await Promise.all([...new Set(children.map((c) => c.project_id))].map(async (sid) => {
              (await getSts(sid)).forEach((stx) => { if (!seen[stx.key]) { seen[stx.key] = 1; sts.push(stx); } });
            }));
            const { done, due } = mkCounts(children, sts);
            return { id: meta.id, name: meta.name, spaceName: meta.spaceName || '', total: children.length, done, due, tasks: children, sts };
          }));
        } else {
          rows = await Promise.all((card.lists || []).map(async (l) => {
            const [listDoc, res] = await Promise.all([
              listsApi.get(l.id).catch(() => null),
              tasksApi.list({ list_id: l.id, limit: 200 }).catch(() => ({ items: [] })),
            ]);
            const tasks = res.items || [];
            const spaceSts = await getSts(l.spaceId);
            const sts = (listDoc && listDoc.status_mode === 'custom' && listDoc.statuses?.length) ? resolveStatuses(listDoc) : spaceSts;
            const { done, due } = mkCounts(tasks, sts);
            return { ...l, name: l.name, spaceName: l.spaceName, sts, tasks, total: tasks.length, done, due };
          }));
        }

        // --- Aggregates shared by every chart, derived generically from rows. ---
        const stByKey = {};
        rows.forEach((r) => r.sts.forEach((s) => { if (!stByKey[s.key]) stByKey[s.key] = s; }));
        const mergedSts = Object.values(stByKey);

        const totalByStatus = {};
        rows.forEach((r) => r.tasks.forEach((t) => { totalByStatus[t.status] = (totalByStatus[t.status] || 0) + 1; }));
        const byStatus = Object.entries(totalByStatus)
          .map(([key, count]) => ({ key, count, label: statusLabel(mergedSts, key), color: statusColor(mergedSts, key) }))
          .sort((a, b) => b.count - a.count);

        const priCount = {};
        rows.forEach((r) => r.tasks.forEach((t) => { const p = t.priority || 'none'; priCount[p] = (priCount[p] || 0) + 1; }));
        const PRI_ORDER = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
        const byPriority = Object.entries(priCount)
          .map(([key, count]) => ({ key, count, label: key === 'none' ? 'No priority' : key, color: PRIORITY_COLOR[key] || '#94a3b8' }))
          .sort((a, b) => (PRI_ORDER[a.key] ?? 9) - (PRI_ORDER[b.key] ?? 9));

        // Group tasks by status GROUP (Not started / Active / Done / Closed).
        const grpCount = {};
        rows.forEach((r) => r.tasks.forEach((t) => {
          const g = r.sts.find((s) => s.key === t.status)?.group || 'active';
          grpCount[g] = (grpCount[g] || 0) + 1;
        }));
        const byStatusGroup = STATUS_GROUPS.map((g) => ({ key: g.key, label: g.label, count: grpCount[g.key] || 0, color: GROUP_COLOR[g.key] }));

        const total = rows.reduce((s, r) => s + r.total, 0);
        const done = rows.reduce((s, r) => s + r.done, 0);
        const due = rows.reduce((s, r) => s + r.due, 0);

        const byDate = {};
        rows.forEach((r) => r.tasks.forEach((t) => {
          const c = t.created_at || t.created_date || t.start_date;
          if (!c) return;
          const day = String(c).slice(0, 10);
          byDate[day] = (byDate[day] || 0) + 1;
        }));
        let cum = 0;
        const timeline = Object.keys(byDate).sort().map((d) => { cum += byDate[d]; return { date: d, value: cum }; });

        if (alive) setData({
          rows,
          byStatus,
          byStatusGroup,
          byPriority,
          byList: rows.map((r) => ({ name: r.name, total: r.total, done: r.done })),
          total, done, due, timeline,
        });
      } finally { endSilent(); }
    })();
    return () => { alive = false; };
  }, [card]);

  return data;
}
