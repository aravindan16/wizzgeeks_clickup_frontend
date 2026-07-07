import { useEffect, useState } from 'react';
import { IconChevronDown } from './icons';

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
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0); // 0-based
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  // Reset to the first page when the data set or page size changes.
  useEffect(() => { setPage(0); }, [total, pageSize]);
  const pageRows = paginated ? rows.slice(safePage * pageSize, safePage * pageSize + pageSize) : rows;
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  const last = columns.length - 1;
  const content = (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <colgroup>{columns.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}</colgroup>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} style={{ ...s.th, ...(c.align ? { textAlign: c.align } : {}), ...(i < last ? s.line : {}) }}>
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
        <div style={s.pager}>
          <label style={s.pagerLeft}>
            Rows per page:
            <span style={s.pageSelectWrap}>
              <select style={s.pageSelect} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={s.pageSelectCaret}><IconChevronDown size={13} /></span>
            </span>
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

  return card ? <div style={s.card}>{content}</div> : content;
}

const s = {
  card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', overflow: 'hidden' },
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' },
  th: { position: 'relative', textAlign: 'left', padding: '11px 14px', fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '.03em', color: 'var(--c-muted)', background: 'var(--c-surface-2)', userSelect: 'none' },
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
  pageSelectWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  pageSelect: { appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    padding: '5px 28px 5px 10px', border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-surface)',
    color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' },
  pageSelectCaret: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex',
    color: 'var(--c-muted)', pointerEvents: 'none' },
  pagerRight: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  pagerRange: { fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap' },
  pagerPage: { fontSize: 13, color: 'var(--c-text)', minWidth: 54, textAlign: 'center' },
  pagerBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 8,
    cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  pagerDisabled: { color: 'var(--c-faint)', cursor: 'not-allowed', opacity: 0.6 },
};
