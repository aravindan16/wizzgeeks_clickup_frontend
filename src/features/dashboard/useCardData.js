import { useEffect, useState } from 'react';
import { tasksApi, resolveStatuses, isDoneStatus, statusLabel, statusColor, PRIORITY_COLOR, STATUS_GROUPS } from '../tasks/tasksApi';

const GROUP_COLOR = { not_started: '#9ca3af', active: '#3b82f6', done: '#22c55e', closed: '#16a34a' };
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { savedFiltersApi } from '../filters/savedFiltersApi';
import { filterTasks } from '../filters/filterEval';
import { beginSilent, endSilent } from '../../services/apiClient';

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// Short-lived shared cache so the N cards on a dashboard don't each re-fetch the
// SAME lists / tasks / space docs. It (a) dedupes concurrent requests by returning
// the in-flight promise, and (b) reuses a result for a few seconds — enough to
// collapse the burst when every card mounts at once. Failed requests are evicted
// immediately so a retry isn't blocked. Read-only data only (never mutated by callers).
const SHARED_TTL = 15000; // ms
const _shared = new Map(); // key -> { at, promise }
function shared(key, fetcher) {
  const hit = _shared.get(key);
  if (hit && Date.now() - hit.at < SHARED_TTL) return hit.promise;
  const promise = fetcher();
  _shared.set(key, { at: Date.now(), promise });
  promise.catch(() => { if (_shared.get(key)?.promise === promise) _shared.delete(key); });
  return promise;
}
// Bust the cache (e.g. after a task/list edit) so the next dashboard load is fresh.
export function clearDashboardCache() { _shared.clear(); }

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
        const stCache = {}; // spaceId -> resolved statuses (per-card memo on top of the shared cache)
        const getSts = async (spaceId) => {
          if (!spaceId) return [];
          if (stCache[spaceId] === undefined) {
            const sp = await shared('proj:' + spaceId, () => projectsApi.get(spaceId)).catch(() => null);
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
        if (card.source === 'filter') {
          // Saved-filter mode (Jira-style): the card's dataset is every task matching
          // the chosen saved filter. One "row" = the whole filtered result.
          const sf = card.filterId ? await savedFiltersApi.get(card.filterId).catch(() => null) : null;
          // Page through all tasks (list endpoint caps at 200), then filter client-side.
          const all = [];
          for (let skip = 0; skip < 2000; skip += 200) {
            const r = await tasksApi.list({ limit: 200, skip }).catch(() => ({ items: [], total: 0 }));
            const items = r.items || [];
            all.push(...items);
            if (items.length < 200 || all.length >= (r.total || 0)) break;
          }
          const matched = sf ? filterTasks(all, sf.cards, sf.conj) : [];
          // Merge statuses across every space the matched tasks live in.
          const sts = []; const seen = {};
          await Promise.all([...new Set(matched.map((t) => t.project_id))].map(async (sid) => {
            (await getSts(sid)).forEach((stx) => { if (!seen[stx.key]) { seen[stx.key] = 1; sts.push(stx); } });
          }));
          const { done, due } = mkCounts(matched, sts);
          rows = [{ id: card.filterId, name: sf?.name || 'Filter', spaceName: '', sts, tasks: matched, total: matched.length, done, due }];
        } else if (card.source === 'tasks') {
          // Related mode: each unit is a List; its "tasks" are the related tasks linked
          // from that List's tasks through relationship custom fields, optionally filtered
          // to the chosen related Lists (Frontend / Backend …).
          rows = await Promise.all((card.tasks || []).map(async (meta) => {
            const fields = await shared('cf:' + meta.spaceId + ':' + meta.id, () => customFieldsApi.list(meta.spaceId, meta.id)).catch(() => []);
            const relFields = (fields || []).filter((f) => f.type === 'relationship');
            const want = meta.lists || [];
            const useFields = want.length ? relFields.filter((f) => want.includes(f.location)) : relFields;

            const res = await shared('tasks:' + meta.id, () => tasksApi.list({ list_id: meta.id, limit: 200 })).catch(() => ({ items: [] }));
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
              shared('list:' + l.id, () => listsApi.get(l.id)).catch(() => null),
              shared('tasks:' + l.id, () => tasksApi.list({ list_id: l.id, limit: 200 })).catch(() => ({ items: [] })),
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
