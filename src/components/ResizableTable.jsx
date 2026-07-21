import { useEffect, useState } from 'react';
import Select from './Select';

const PAGE_SIZES = [10, 20, 50, 100];

/**
 * Shared data table with drag-to-resize columns, vertical divider lines, and
 * bottom pagination (10 / 20 / 50 / 100 per page — default 10). Column widths
 * persist in localStorage when `persistKey` is given.
 *
 * columns: [{ key, label, width, min?, align?, render:(row, index) => node }]
 * rows:    array of records
 * rowKey:  (row) => stable key
 * onRowClick: (row) => void   (optional — rows get a pointer cursor when set)
 * emptyText: shown when rows is empty
 * card:    wrap in a bordered card (default true)
 * paginated: show the bottom pager (default true)
 * defaultPageSize: initial rows per page (default 10)
 */
export default function ResizableTable({
  columns, rows, rowKey, onRowClick, emptyText = 'No data.',
  persistKey, card = true, rowClassName = 'wg-rel-row',
  paginated = true, defaultPageSize = 10,
  // fillHeight: fill the parent's height — rows scroll internally under a sticky header,
  // and the pager pins to the bottom (the parent must give the table a bounded height).
  fillHeight = false,
  // --- server-side pagination (backend paging) ---
  // When serverMode is set, `rows` is ALREADY the current page from the API.
  // The component controls nothing itself — it reports page/size changes so the
  // parent can refetch: onPageChange(page0based), onPageSizeChange(size).
  serverMode = false, page: pageProp, pageSize: pageSizeProp, total: totalProp,
  onPageChange, onPageSizeChange,
}) {
  const [widths, setWidths] = useState(() => {
    let saved = {};
    if (persistKey) { try { saved = JSON.parse(localStorage.getItem(persistKey) || '{}'); } catch { /* ignore */ } }
    const w = {};
    columns.forEach((c) => { w[c.key] = saved[c.key] || c.width || 160; });
    return w;
  });
  const persist = (w) => { if (persistKey) { try { localStorage.setItem(persistKey, JSON.stringify(w)); } catch { /* ignore */ } } };

  const startResize = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    const col = columns.find((c) => c.key === key);
    const startX = e.clientX; const startW = widths[key];
    const move = (ev) => setWidths((w) => ({ ...w, [key]: Math.max(col.min || 60, startW + (ev.clientX - startX)) }));
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
      setWidths((w) => { persist(w); return w; });
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  };

  // --- pagination ---
  // Client mode owns its own page/size state; server mode is fully controlled.
  const [pageSizeC, setPageSizeC] = useState(defaultPageSize);
  const [pageC, setPageC] = useState(0); // 0-based
  const pageSize = serverMode ? (pageSizeProp || defaultPageSize) : pageSizeC;
  const total = serverMode ? (totalProp || 0) : rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rawPage = serverMode ? (pageProp || 0) : pageC;
  const safePage = Math.min(rawPage, pageCount - 1);
  // Client mode: reset to the first page when the data set / page size changes.
  useEffect(() => { if (!serverMode) setPageC(0); }, [serverMode, total, pageSizeC]);
  const setPage = (p) => (serverMode ? onPageChange?.(Math.max(0, p)) : setPageC(p));
  const setPageSize = (n) => (serverMode ? onPageSizeChange?.(n) : setPageSizeC(n));
  // Server mode: rows ARE the current page already; client mode slices locally.
  const pageRows = (!paginated || serverMode) ? rows : rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = serverMode ? Math.min(total, safePage * pageSize + rows.length) : Math.min(total, (safePage + 1) * pageSize);

  const last = columns.length - 1;
  const th = fillHeight ? { ...s.th, ...s.thSticky } : s.th; // sticky header when filling height
  const content = (
    <>
      <div style={fillHeight ? s.scrollFill : { overflowX: 'auto' }}>
        <table style={s.table}>
          <colgroup>{columns.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}</colgroup>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} style={{ ...th, ...(c.align ? { textAlign: c.align } : {}), ...(i < last ? s.line : {}) }}>
                  <span style={s.thLabel}>{c.label}</span>
                  {i < last && <span style={s.resize} onMouseDown={(e) => startResize(e, c.key)} title="Drag to resize" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {total === 0 && <tr><td colSpan={columns.length} style={s.empty}>{emptyText}</td></tr>}
            {pageRows.map((r, ri) => (
              <tr key={rowKey ? rowKey(r) : ri} className={rowClassName}
                style={{ ...s.row, cursor: onRowClick ? 'pointer' : 'default' }}
                onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} style={{ ...s.td, ...(c.align ? { textAlign: c.align } : {}), ...(i < last ? s.line : {}) }}>
                    <div style={s.clip}>{c.render(r, safePage * pageSize + ri)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginated && total > 0 && (
        <div style={{ ...s.pager, ...(fillHeight ? { flexShrink: 0 } : {}) }}>
          <label style={s.pagerLeft}>
            Rows per page:
            <Select value={pageSize} onChange={(v) => setPageSize(Number(v))} style={s.pageSelect}
              options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))} />
          </label>
          <div style={s.pagerRight}>
            <span style={s.pagerRange}>{from}–{to} of {total}</span>
            <button type="button" style={{ ...s.pagerBtn, ...(safePage === 0 ? s.pagerDisabled : {}) }}
              disabled={safePage === 0} onClick={() => setPage(safePage - 1)} title="Previous">‹</button>
            <span style={s.pagerPage}>{safePage + 1} / {pageCount}</span>
            <button type="button" style={{ ...s.pagerBtn, ...(safePage >= pageCount - 1 ? s.pagerDisabled : {}) }}
              disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} title="Next">›</button>
          </div>
        </div>
      )}
    </>
  );

  return card ? <div style={{ ...s.card, ...(fillHeight ? s.cardFill : {}) }}>{content}</div> : content;
}

const s = {
  card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', overflow: 'hidden' },
  // fillHeight: card becomes a full-height flex column so the pager pins to the bottom.
  cardFill: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
  scrollFill: { flex: 1, minHeight: 0, overflow: 'auto' }, // rows scroll here
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' },
  th: { position: 'relative', textAlign: 'left', padding: '11px 14px', fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '.03em', color: 'var(--c-muted)', background: 'var(--c-surface-2)', userSelect: 'none' },
  thSticky: { position: 'sticky', top: 0, zIndex: 2 }, // keep header visible while rows scroll
  thLabel: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resize: { position: 'absolute', top: 0, right: 0, width: 7, height: '100%', cursor: 'col-resize' },
  line: { borderRight: '1px solid var(--c-border-2)' },
  row: { borderTop: '1px solid var(--c-border-2)' },
  td: { padding: '11px 14px', fontSize: 14, color: 'var(--c-text)', verticalAlign: 'middle' },
  clip: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { padding: 26, textAlign: 'center', color: 'var(--c-muted)' },
  // pager
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    padding: '10px 14px', borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)' },
  pagerLeft: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--c-muted)' },
  pageSelect: { minWidth: 72, padding: '2px 10px', fontSize: 13, lineHeight: 1.3, borderRadius: 8 },
  pagerRight: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  pagerRange: { fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap' },
  pagerPage: { fontSize: 13, color: 'var(--c-text)', minWidth: 54, textAlign: 'center' },
  pagerBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 8,
    cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  pagerDisabled: { color: 'var(--c-faint)', cursor: 'not-allowed', opacity: 0.6 },
};
