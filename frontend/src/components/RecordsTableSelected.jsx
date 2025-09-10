import { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_BASE}/data`;

// ------- Formatters -------
const fmtNum = (n, opts = {}) =>
  typeof n === 'number'
    ? n.toLocaleString(undefined, { maximumFractionDigits: 2, ...opts })
    : n != null && !Number.isNaN(Number(n))
      ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 2, ...opts })
      : '—';

const fmtInt = (n) =>
  typeof n === 'number'
    ? Math.round(n).toLocaleString()
    : n != null && !Number.isNaN(Number(n))
      ? Math.round(Number(n)).toLocaleString()
      : '—';

const fmtPct = (v, digits = 2) => {
  if (v == null) return '—';
  const num = Number(v);
  if (Number.isNaN(num)) return '—';
  return `${(num * 100).toFixed(digits)}%`;
};

const fmtYTM = (v) => {
  if (v == null) return '—';
  const num = Number(v);
  if (Number.isNaN(num)) return '—';
  return `${(num * 100).toFixed(4)}%`;
};

const fmtDate = (report_date, modifiedISO) => {
  // Prefer 'report_date' (e.g., "August 15,2025") but normalize comma spacing.
  if (typeof report_date === 'string' && report_date.trim()) {
    return report_date.replace(/,(\d)/, ', $1');
  }
  // Fallback to ISO
  if (typeof modifiedISO === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(modifiedISO)) {
    try {
      const d = new Date(modifiedISO);
      return d.toLocaleString();
    } catch {}
  }
  return '—';
};

// ------- Component -------
export default function RecordsTableSelected({ defaultPageSize = 100 }) {
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const abortRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      if (abortRef.current) abortRef.current.abort();
      const c = new AbortController();
      abortRef.current = c;
      try {
        const url = `${ENDPOINT}?limit=${pageSize}&skip=${(page - 1) * pageSize}`;
        const res = await fetch(url, { signal: c.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json.data)) throw new Error('Unexpected response (data is not an array)');
        setData(json.data);
        if (typeof json.totalCount === 'number') {
          setTotalCount(json.totalCount);
          setTotalPages(Math.max(1, Math.ceil(json.totalCount / pageSize)));
        } else {
          // Fallback if API doesn’t return totalCount
          setTotalPages(json.data.length < pageSize ? page : Math.max(page + 1, totalPages || 1));
        }
      } catch (e) {
        if (e.name !== 'AbortError') setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // Column definition (key, header, render)
  const columns = [
    {
      header: 'Date',
      render: (row) => fmtDate(row.report_date, row._modifiedTime),
    },
    {
      header: 'YTM',
      render: (row) => fmtYTM(row.ytm),
    },
    {
      header: 'Quantity',
      render: (row) => fmtInt(row.quantity),
    },
    {
      header: 'Scheme Name',
      render: (row) => row.scheme_name ?? '—',
    },
    {
      header: 'ISIN',
      render: (row) => row.isin ?? '—',
    },
    {
      header: 'Instrument Name',
      render: (row) => row.instrument_name ?? '—',
    },
    {
      header: 'Rating',
      render: (row) => row.rating ?? '—',
    },
    {
      header: '% to NAV',
      render: (row) => fmtPct(row.pct_to_nav, 2),
    },
    {
      header: 'Market Value (₹ lacs)',
      render: (row) => fmtNum(row.market_value_lacs, { maximumFractionDigits: 2 }),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <h2>Holdings</h2>

      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Page size:{' '}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        {typeof totalCount === 'number' && <span>Total records: {totalCount.toLocaleString()}</span>}
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div style={{ color: 'crimson' }}>Error: {err}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.header}
                    style={{
                      borderBottom: '2px solid #ddd',
                      textAlign: 'left',
                      padding: '8px',
                      background: '#f7f7f7',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '10px' }}>No data available</td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={row._id ?? idx}>
                    {columns.map((col) => (
                      <td key={col.header} style={{ borderBottom: '1px solid #eee', padding: '8px', whiteSpace: 'nowrap' }}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setPage(1)} disabled={page === 1}>« First</button>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
        <span>Page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
        <button
          onClick={() => setPage((p) => (totalPages ? Math.min(totalPages, p + 1) : p + 1))}
          disabled={Boolean(totalPages) && page >= totalPages}
        >
          Next ›
        </button>
        <button onClick={() => totalPages && setPage(totalPages)} disabled={!totalPages || page >= totalPages}>
          Last »
        </button>
      </div>
    </div>
  );
}
