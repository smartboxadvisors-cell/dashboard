
import { useEffect, useMemo, useRef, useState } from 'react';
import Filters from './Filters.jsx';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3000';
const ENDPOINT = `${API_BASE}/data`;

export default function AllDataClientPager({ initialPageSize = 100, chunkSize = 1000 }) {
  // all rows once fetched
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: null });
  const [error, setError] = useState(null);
  const [cancelled, setCancelled] = useState(false);

  // pagination (client side)
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  // simple search (client side)
  const [q, setQ] = useState('');

  // --- field filters (wired to Filters.jsx) ---
  const [schemeInput, setSchemeInput]         = useState('');
  const [instrumentInput, setInstrumentInput] = useState('');
  const [isinInput, setIsinInput]             = useState('');
  const [ratingInput, setRatingInput]         = useState('');

  const [quantityMin, setQuantityMin] = useState(null);
  const [quantityMax, setQuantityMax] = useState(null);

  const [pctToNavMin, setPctToNavMin] = useState(null);
  const [pctToNavMax, setPctToNavMax] = useState(null);

  const [ytmMin, setYtmMin] = useState(null);
  const [ytmMax, setYtmMax] = useState(null);

  const [fromInput, setFromInput] = useState('');       // Report Date From (string yyyy-mm-dd)
  const [toInput, setToInput]     = useState('');       // Report Date To
  const [modifiedFrom, setModifiedFrom] = useState(''); // Modified From (ISO date string)
  const [modifiedTo, setModifiedTo]     = useState(''); // Modified To

  // abort controller & kind ("user" | "reload" | null)
  const abortRef = useRef(null);
  const abortKindRef = useRef(null);

  const fetchChunk = async (limit, skip, signal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = new URL(ENDPOINT);
    url.searchParams.set('limit', limit);
    url.searchParams.set('skip', skip);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Unexpected API response: missing data[]');
    }
    return json;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      setCancelled(false);
      setRows([]);
      setProgress({ loaded: 0, total: null });

      // abort previous loader (if any) — mark as "reload"
      abortKindRef.current = 'reload';
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      abortKindRef.current = null; // fresh run

      try {
        let all = [];
        let skip = 0;
        let total = null;

        while (!controller.signal.aborted) {
          const json = await fetchChunk(chunkSize, skip, controller.signal);
          if (controller.signal.aborted) break;

          const batch = json.data;
          const totalFromServer = json.totalCount ?? json.total ?? null;
          if (totalFromServer != null && total == null) total = totalFromServer;

          all = all.concat(batch);
          if (!alive || controller.signal.aborted) break;

          setRows(all);
          setProgress({ loaded: all.length, total });

          if (batch.length < chunkSize) break; // last page
          skip += chunkSize;
          if (total != null && all.length >= total) break;
        }
      } catch (e) {
        if (e?.name === 'AbortError') {
          if (abortKindRef.current === 'user') setCancelled(true);
          return; // ignore aborts
        }
        console.error(e);
        setError(e.message || 'Failed to load data');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      abortKindRef.current = 'reload';
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkSize]);

  const cancel = () => {
    abortKindRef.current = 'user';
    abortRef.current?.abort();
  };

  // ---- filtering helpers ----
  const str = (v) => (v ?? '').toString();
  const includes = (haystack, needle) =>
    str(haystack).toLowerCase().includes(str(needle).trim().toLowerCase());

  const numInRange = (val, min, max) => {
    if (val == null || val === '') return false;
    const n = Number(val);
    if (Number.isNaN(n)) return false;
    if (min != null && n < Number(min)) return false;
    if (max != null && n > Number(max)) return false;
    return true;
  };

  // allow empty range to "not filter"; use wrapper:
  const passNumRange = (val, min, max) => {
    const hasMin = min != null && min !== '';
    const hasMax = max != null && max !== '';
    if (!hasMin && !hasMax) return true;
    return numInRange(val, hasMin ? min : null, hasMax ? max : null);
  };

  const dateToYMD = (d) => {
    try {
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return null;
      return dt.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  };

  // report_date in your data is a string (e.g., "Aug 31,2024"). We'll normalize by Date parse.
  const passDateRange = (val, fromStr, toStr) => {
    if (!fromStr && !toStr) return true;
    let vDate = null;

    // Try report_date string like "Aug 31,2024" or ISO
    if (typeof val === 'string' && val.trim()) {
      // Fix missing space after comma (",2024" -> ", 2024")
      const fixed = val.replace(/,(\d)/, ', $1');
      const d = new Date(fixed);
      if (!Number.isNaN(d.getTime())) vDate = d;
    } else if (val) {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) vDate = d;
    }

    if (!vDate) return false;

    const f = fromStr ? new Date(fromStr) : null;
    const t = toStr ? new Date(toStr) : null;
    if (f && vDate < f) return false;
    if (t) {
      // include the 'to' day fully
      const tEnd = new Date(t);
      tEnd.setHours(23, 59, 59, 999);
      if (vDate > tEnd) return false;
    }
    return true;
  };

  // modified range checks r._modifiedTime if present
  const passModifiedRange = (iso, fromStr, toStr) => {
    if (!fromStr && !toStr) return true;
    if (typeof iso !== 'string') return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;

    const f = fromStr ? new Date(fromStr) : null;
    const t = toStr ? new Date(toStr) : null;
    if (f && d < f) return false;
    if (t) {
      const tEnd = new Date(t);
      tEnd.setHours(23, 59, 59, 999);
      if (d > tEnd) return false;
    }
    return true;
  };

  // ---- apply all filters (client-side) ----
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((r) => {
      // global search
      if (term) {
        const hit =
          includes(r.scheme_name, term) ||
          includes(r.isin, term) ||
          includes(r.instrument_name, term) ||
          includes(r.rating, term);
        if (!hit) return false;
      }

      // field-specific
      if (schemeInput && !includes(r.scheme_name, schemeInput)) return false;
      if (instrumentInput && !includes(r.instrument_name, instrumentInput)) return false;
      if (isinInput && !includes(r.isin, isinInput)) return false;
      if (ratingInput && !String(r.rating || '').toLowerCase().startsWith(ratingInput.toLowerCase())) return false;

      // numeric ranges
      if (!passNumRange(r.quantity,     quantityMin, quantityMax)) return false;
      if (!passNumRange(r.pct_to_nav,   pctToNavMin, pctToNavMax)) return false;
      if (!passNumRange(r.ytm,          ytmMin, ytmMax))           return false;

      // dates
      if (!passDateRange(r.report_date, fromInput, toInput)) return false;
      if (!passModifiedRange(r._modifiedTime, modifiedFrom, modifiedTo)) return false;

      return true;
    });
  }, [
    rows, q,
    schemeInput, instrumentInput, isinInput, ratingInput,
    quantityMin, quantityMax,
    pctToNavMin, pctToNavMax,
    ytmMin, ytmMax,
    fromInput, toInput,
    modifiedFrom, modifiedTo
  ]);

  // client pagination: slice after filtering
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  const onReset = () => {
    setSchemeInput('');
    setInstrumentInput('');
    setIsinInput('');
    setRatingInput('');
    setQuantityMin(null);
    setQuantityMax(null);
    setPctToNavMin(null);
    setPctToNavMax(null);
    setYtmMin(null);
    setYtmMax(null);
    setFromInput('');
    setToInput('');
    setModifiedFrom('');
    setModifiedTo('');
    setQ('');
    setPage(1);
  };

  // table styles
  const tableWrap = { border: '1px solid #eee', borderRadius: 12, overflowX: 'hidden' };
  const table = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 };
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
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>All Holdings (client pagination)</h2>

      {/* Filters */}
      <Filters
        schemeInput={schemeInput} setSchemeInput={setSchemeInput}
        instrumentInput={instrumentInput} setInstrumentInput={setInstrumentInput}
        isinInput={isinInput} setIsinInput={setIsinInput}
        ratingInput={ratingInput} setRatingInput={setRatingInput}
        quantityMin={quantityMin} setQuantityMin={setQuantityMin}
        quantityMax={quantityMax} setQuantityMax={setQuantityMax}
        pctToNavMin={pctToNavMin} setPctToNavMin={setPctToNavMin}
        pctToNavMax={pctToNavMax} setPctToNavMax={setPctToNavMax}
        ytmMin={ytmMin} setYtmMin={setYtmMin}
        ytmMax={ytmMax} setYtmMax={setYtmMax}
        fromInput={fromInput} setFromInput={setFromInput}
        toInput={toInput} setToInput={setToInput}
        modifiedFrom={modifiedFrom} setModifiedFrom={setModifiedFrom}
        modifiedTo={modifiedTo} setModifiedTo={setModifiedTo}
        limit={pageSize} setLimit={(n) => { setPageSize(n); setPage(1); }}
        onReset={onReset}
        total={filtered.length}
        loading={loading}
      />

      {/* Top controls (global search + loader state) */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label>
          Search:{' '}
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="scheme / ISIN / instrument / rating"
            style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, width: 280 }}
          />
        </label>

        {loading ? (
          <>
            <button onClick={cancel}>Cancel</button>
            <span style={{ color: '#666' }}>
              Loading…
              {progress.total != null
                ? ` ${progress.loaded.toLocaleString()} / ${progress.total.toLocaleString()}`
                : ` ${progress.loaded.toLocaleString()} loaded`}
            </span>
            <div style={{ height: 8, background: '#eee', borderRadius: 4, width: 200, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width:
                    progress.total != null
                      ? `${Math.min(100, (progress.loaded / progress.total) * 100).toFixed(1)}%`
                      : '25%',
                  background: '#0a66c2',
                  transition: 'width .2s',
                }}
              />
            </div>
          </>
        ) : cancelled ? (
          <span style={{ color: '#b36b00' }}>Load cancelled at {progress.loaded.toLocaleString()} rows</span>
        ) : (
          <span style={{ color: '#555' }}>
            Loaded {rows.length.toLocaleString()} rows
            {progress.total != null && ` of ${progress.total.toLocaleString()}`}
          </span>
        )}
      </div>

      {/* Table */}
      {error ? (
        <div style={{ color: 'crimson' }}>Error: {error}</div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>YTM</th>
                <th style={th}>Quantity</th>
                <th style={th}>Scheme Name</th>
                <th style={th}>ISIN</th>
                <th style={th}>Instrument Name</th>
                <th style={th}>Rating</th>
                <th style={th}>% to NAV</th>
                <th style={th}>Market Value (₹ lacs)</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 14 }}>No data</td></tr>
              ) : (
                pageSlice.map((r, i) => r ? (
                  <tr key={r._id ?? i}>
                    <td style={td} title={fmtDate(r.report_date, r._modifiedTime)}>
                      {fmtDate(r.report_date, r._modifiedTime)}
                    </td>
                    <td style={td} title={fmtYTM(r.ytm)}>{fmtYTM(r.ytm)}</td>
                    <td style={td} title={fmtInt(r.quantity)}>{fmtInt(r.quantity)}</td>
                    <td style={td} title={r.scheme_name ?? '—'}>{r.scheme_name ?? '—'}</td>
                    <td style={td} title={r.isin ?? '—'}>{r.isin ?? '—'}</td>
                    <td style={td} title={r.instrument_name ?? '—'}>{r.instrument_name ?? '—'}</td>
                    <td style={td} title={r.rating ?? '—'}>{r.rating ?? '—'}</td>
                    <td style={td} title={fmtPct(r.pct_to_nav, 2)}>{fmtPct(r.pct_to_nav, 2)}</td>
                    <td style={td} title={fmtNum(r.market_value_lacs, { maximumFractionDigits: 2 })}>
                      {fmtNum(r.market_value_lacs, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Client pagination */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <label>
          Page size:{' '}
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={() => setPage(1)} disabled={safePage === 1}>« First</button>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹ Prev</button>
        <span>Page {safePage} of {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next ›</button>
        <button onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>Last »</button>
      </div>
    </div>
  );
}

/** ------- helpers ------- */
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
    return report_date.replace(/,(\d)/, ', $1');
  }
  if (typeof modifiedISO === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(modifiedISO)) {
    try {
      const d = new Date(modifiedISO);
      return d.toLocaleString();
    } catch {}
  }
  return '—';
};
