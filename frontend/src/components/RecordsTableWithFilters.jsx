import { useEffect, useMemo, useRef, useState } from 'react';

/** ====== Config ====== */
const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_BASE}/data`;

/** ====== Utilities ====== */
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
  if (typeof report_date === 'string' && report_date.trim()) {
    return report_date.replace(/,(\d)/, ', $1'); // normalize "August 15,2025" -> "August 15, 2025"
  }
  if (typeof modifiedISO === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(modifiedISO)) {
    try {
      const d = new Date(modifiedISO);
      return d.toLocaleString();
    } catch {}
  }
  return '—';
};

const toPlainDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** ====== Filter helpers ====== */
const textMatch = (txt = '', q = '') =>
  txt?.toString().toLowerCase().includes(q?.toString().toLowerCase());

/** Apply range only if at least one bound is provided. multiplier=100 for stored decimals like 0.066 (6.6%). */
const passesNumRange = (val, min, max, multiplier = 1) => {
  const hasBound = min != null || max != null;
  if (!hasBound) return true; // no filter
  if (val == null) return false;

  const v = Number(val) * multiplier;
  if (Number.isNaN(v)) return false;
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
};

const inDateRange = (textDate, isoFallback, min, max) => {
  if (!min && !max) return true; // no filter
  let d = null;
  if (isoFallback && /^\d{4}-\d{2}-\d{2}T/.test(isoFallback)) {
    const dt = new Date(isoFallback);
    if (!Number.isNaN(dt.getTime())) d = dt;
  }
  if (!d && typeof textDate === 'string') {
    const safe = textDate.replace(/,(\d)/, ', $1');
    const dt = new Date(safe);
    if (!Number.isNaN(dt.getTime())) d = dt;
  }
  if (!d) return false;
  if (min && d < min) return false;
  if (max && d > max) return false;
  return true;
};

/** ====== FilterBar ====== */
function FilterBar({ initial, ratings, instruments, onSearch, onReset }) {
  const [local, setLocal] = useState(initial);

  // keep local in sync if parent resets
  useEffect(() => setLocal(initial), [initial]);

  const row = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  };
  const label = { fontSize: 12, color: '#444', marginBottom: 4, display: 'block' };
  const input = { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, width: '100%' };
  const btn = { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#f7f7f7', cursor: 'pointer' };
  const btnPrimary = { ...btn, background: '#0a66c2', color: '#fff', borderColor: '#0a66c2' };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Global search + dropdowns */}
      <div style={row}>
        <div>
          <label style={label}>Search (name / ISIN / instrument / rating)</label>
        <input
            style={input}
            placeholder="Type to search…"
            value={local.q}
            onChange={(e) => setLocal((s) => ({ ...s, q: e.target.value }))}
          />
        </div>
        <div>
          <label style={label}>Rating</label>
          <select
            style={input}
            value={local.rating || ''}
            onChange={(e) => setLocal((s) => ({ ...s, rating: e.target.value || null }))}
          >
            <option value="">All</option>
            {ratings.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Instrument</label>
          <select
            style={input}
            value={local.instrument || ''}
            onChange={(e) => setLocal((s) => ({ ...s, instrument: e.target.value || null }))}
          >
            <option value="">All</option>
            {instruments.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date range */}
      <div style={row}>
        <div>
          <label style={label}>Date from</label>
          <input
            type="date"
            style={input}
            value={local.dateFrom || ''}
            onChange={(e) => setLocal((s) => ({ ...s, dateFrom: e.target.value || null }))}
          />
        </div>
        <div>
          <label style={label}>Date to</label>
          <input
            type="date"
            style={input}
            value={local.dateTo || ''}
            onChange={(e) => setLocal((s) => ({ ...s, dateTo: e.target.value || null }))}
          />
        </div>
      </div>

      {/* Numeric ranges */}
      <div style={row}>
        <div>
          <label style={label}>YTM % (min)</label>
          <input
            type="number" step="0.01" style={input}
            value={local.ytmMin ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, ytmMin: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={label}>YTM % (max)</label>
          <input
            type="number" step="0.01" style={input}
            value={local.ytmMax ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, ytmMax: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={label}>Qty (min)</label>
          <input
            type="number" step="1" style={input}
            value={local.qtyMin ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, qtyMin: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={label}>Qty (max)</label>
          <input
            type="number" step="1" style={input}
            value={local.qtyMax ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, qtyMax: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={label}>% to NAV (min)</label>
          <input
            type="number" step="0.01" style={input}
            value={local.pctMin ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, pctMin: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={label}>% to NAV (max)</label>
          <input
            type="number" step="0.01" style={input}
            value={local.pctMax ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, pctMax: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btnPrimary} onClick={() => onSearch(local)}>Search</button>
        <button
          style={btn}
          onClick={() => {
            const cleared = {
              q: '', rating: null, instrument: null,
              dateFrom: null, dateTo: null,
              ytmMin: null, ytmMax: null,
              qtyMin: null, qtyMax: null,
              pctMin: null, pctMax: null,
            };
            setLocal(cleared);
            onReset(cleared);
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** ====== Main table with pagination + filters ====== */
export default function RecordsTableWithFilters({ defaultPageSize = 100 }) {
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [filters, setFilters] = useState({
    q: '',
    rating: null,
    instrument: null,
    dateFrom: null,
    dateTo: null,
    ytmMin: null,
    ytmMax: null,
    qtyMin: null,
    qtyMax: null,
    pctMin: null,
    pctMax: null,
  });

  const abortRef = useRef(null);

  // Fetch a page (unfiltered from server; we filter client-side on current page)
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
          // avoid stale totalPages via functional update
          setTotalPages(prev => (json.data.length < pageSize ? page : Math.max(page + 1, prev || 1)));
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

  // Option lists from current page (fast UX)
  const ratings = useMemo(() => {
    const s = new Set();
    data.forEach((r) => r?.rating && s.add(r.rating));
    return Array.from(s).sort();
  }, [data]);

  const instruments = useMemo(() => {
    const s = new Set();
    data.forEach((r) => r?.instrument_name && s.add(r.instrument_name));
    return Array.from(s).sort();
  }, [data]);

  // Apply filters ONLY after clicking Search
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const filtered = useMemo(() => {
    const q = appliedFilters.q?.trim() || '';
    const minDate = toPlainDate(appliedFilters.dateFrom);
    const maxDate = toPlainDate(appliedFilters.dateTo);

    return data.filter((row) => {
      // global text
      if (
        q &&
        !(
          textMatch(row.scheme_name, q) ||
          textMatch(row.isin, q) ||
          textMatch(row.instrument_name, q) ||
          textMatch(row.rating, q)
        )
      ) return false;

      // exact dropdowns
      if (appliedFilters.rating && row.rating !== appliedFilters.rating) return false;
      if (appliedFilters.instrument && row.instrument_name !== appliedFilters.instrument) return false;

      // date
      if (!inDateRange(row.report_date, row._modifiedTime, minDate, maxDate)) return false;

      // numeric ranges (note: ytm and pct_to_nav are stored as decimals like 0.066)
      if (!passesNumRange(row.ytm, appliedFilters.ytmMin, appliedFilters.ytmMax, 100)) return false;
      if (!passesNumRange(row.quantity, appliedFilters.qtyMin, appliedFilters.qtyMax, 1)) return false;
      if (!passesNumRange(row.pct_to_nav, appliedFilters.pctMin, appliedFilters.pctMax, 100)) return false;

      return true;
    });
  }, [data, appliedFilters]);

  /** ====== Columns with keys (so we can hide all-null columns) ====== */
  const allColumns = [
    { key: 'report_date', header: 'Date', render: (r) => fmtDate(r.report_date, r._modifiedTime) },
    { key: 'ytm', header: 'YTM', render: (r) => fmtYTM(r.ytm) },
    { key: 'quantity', header: 'Quantity', render: (r) => fmtInt(r.quantity) },
    { key: 'scheme_name', header: 'Scheme Name', render: (r) => r.scheme_name ?? '—' },
    { key: 'isin', header: 'ISIN', render: (r) => r.isin ?? '—' },
    { key: 'instrument_name', header: 'Instrument Name', render: (r) => r.instrument_name ?? '—' },
    { key: 'rating', header: 'Rating', render: (r) => r.rating ?? '—' },
    { key: 'pct_to_nav', header: '% to NAV', render: (r) => fmtPct(r.pct_to_nav, 2) },
    { key: 'market_value_lacs', header: 'Market Value (₹ lacs)', render: (r) => fmtNum(r.market_value_lacs, { maximumFractionDigits: 2 }) },
  ];

  // 👉 Hide columns where ALL values are null/undefined/empty string in the current filtered set
  const activeColumns = useMemo(() => {
    if (!filtered.length) return allColumns; // keep headers when empty result
    return allColumns.filter(col =>
      filtered.some(row => row[col.key] !== null && row[col.key] !== undefined && row[col.key] !== '')
    );
  }, [filtered]);

  /** ====== Styles (wrapped, no X-scroll) ====== */
  const container = { padding: 16, maxWidth: 1200, margin: '0 auto' };
  const toolbar = { display: 'grid', gap: 12, marginBottom: 12 };
  const tableWrap = {
    border: '1px solid #eee',
    borderRadius: 12,
    overflowX: 'hidden', // avoid horizontal scroll
  };
  const table = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed', // fixed layout + wrapping
    fontSize: 13,
  };
  const th = {
    borderBottom: '2px solid #ddd',
    textAlign: 'left',
    padding: '10px 8px',
    background: '#f9fafb',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };
  const td = {
    borderBottom: '1px solid #f0f0f0',
    padding: '10px 8px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    verticalAlign: 'top',
  };

  return (
    <div style={container}>
      <h2 style={{ marginBottom: 8 }}>Holdings</h2>

      <div style={toolbar}>
        <FilterBar
          initial={filters}
          ratings={ratings}
          instruments={instruments}
          onSearch={(local) => {
            setAppliedFilters(local);
            setFilters(local);
            setPage(1);
          }}
          onReset={(cleared) => {
            setAppliedFilters(cleared);
            setFilters(cleared);
            setPage(1);
          }}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
          {typeof totalCount === 'number' && (
            <span style={{ color: '#555' }}>Total records: {totalCount.toLocaleString()}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : err ? (
        <div style={{ color: 'crimson' }}>Error: {err}</div>
      ) : (
        <>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  {activeColumns.map((c) => (
                    <th key={c.header} style={th}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length} style={{ padding: 14 }}>No matching records</td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row._id ?? idx}>
                      {activeColumns.map((c) => (
                        <td key={c.header} style={td}>{c.render(row)}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
        </>
      )}
    </div>
  );
}
