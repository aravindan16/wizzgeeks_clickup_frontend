/**
 * Skeleton placeholders — show the SHAPE of content while it loads instead of a
 * blocking spinner, so the page feels instant (ClickUp/Jira style).
 *
 *   <Skeleton w={200} h={14} />            // single bar
 *   <SkeletonBoard columns={4} />          // Kanban-shaped placeholder
 */
export function Skeleton({ w = '100%', h = 12, r = 6, style }) {
  return (
    <span
      className="wg-skeleton"
      style={{ width: w, height: h, borderRadius: r, display: 'block', ...style }}
    />
  );
}

/** Kanban board placeholder: a few columns each with a few card blocks. */
export function SkeletonBoard({ columns = 4, cards = 3 }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '4px 0', overflow: 'hidden' }}>
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} style={{ flex: '0 0 280px', background: 'var(--c-surface-3)', borderRadius: 12, padding: 12 }}>
          <Skeleton w={120} h={14} style={{ marginBottom: 12 }} />
          {Array.from({ length: cards }).map((__, i) => (
            <div key={i} style={{ background: 'var(--c-surface)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <Skeleton w="80%" h={13} style={{ marginBottom: 10 }} />
              <Skeleton w="40%" h={11} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
