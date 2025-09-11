import { useEffect, useMemo, useState } from 'react';
import { fetchImports } from '../api/imports';
import useDebounce from '../hooks/useDebounce';
import Filters from './Filters';
import Pagination from './Pagination';
import styles from '../styles/table.module.css';

export default function ImportsTable() {
  // Paging
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Inputs (controlled)
  const [schemeInput, setSchemeInput] = useState('');
  const [ratingInput, setRatingInput] = useState('');
  const [isinInput, setIsinInput] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  // Debounced values
  const scheme = useDebounce(schemeInput);
  const rating = useDebounce(ratingInput);
  const isin = useDebounce(isinInput);
  const from = useDebounce(fromInput);
  const to = useDebounce(toInput);

  // Data
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [scheme, rating, isin, from, to, limit]);

  const params = useMemo(() => ({
    page, limit, scheme, rating, isin, from, to
  }), [page, limit, scheme, rating, isin, from, to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { items, total, totalPages } = await fetchImports(params);
        if (!cancelled) {
          setRows(items);
          setTotal(total);
          setTotalPages(totalPages);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params]);

  const onReset = () => {
    setSchemeInput('');
    setRatingInput('');
    setIsinInput('');
    setFromInput('');
    setToInput('');
  };

  return (
    <div className={styles.wrapper}>
      <Filters
        schemeInput={schemeInput} setSchemeInput={setSchemeInput}
        ratingInput={ratingInput} setRatingInput={setRatingInput}
        isinInput={isinInput} setIsinInput={setIsinInput}
        fromInput={fromInput} setFromInput={setFromInput}
        toInput={toInput} setToInput={setToInput}
        limit={limit} setLimit={setLimit}
        onReset={onReset}
        total={total}
        loading={loading}
      />

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.card}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Scheme</th>
                <th className={styles.th}>Instrument</th>        {/* NEW */}
                <th className={styles.th}>Quantity</th>          {/* NEW */}
                <th className={styles.th}>% to NAV</th>          {/* NEW */}
                <th className={styles.th}>Report Date</th>
                <th className={styles.th}>ISIN</th>
                <th className={styles.th}>Rating</th>
                <th className={styles.th}>YTM</th>
                <th className={styles.th}>Modified</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={`${styles.tr} ${i % 2 ? styles.trOdd : ''}`}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className={styles.td}><div className={styles.skeleton} /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr className={styles.tr}>
                  <td className={styles.td} colSpan={9} style={{ textAlign: 'center', padding: '24px 8px', opacity: 0.7 }}>
                    No results found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const modified = r._modifiedTime ? new Date(r._modifiedTime).toLocaleString() : '—';
                  const qty = (r.quantity ?? '—');
                  const pct = (r.pct_to_nav ?? r.pct_to_NAV ?? '—');

                  return (
                    <tr
                      key={r._id}
                      className={`${styles.tr} ${i % 2 ? styles.trOdd : ''} ${styles.rowHover}`}
                      title={`Scheme: ${r.scheme_name || '—'}\nInstrument: ${r.instrument_name || '—'}\nQuantity: ${qty}\n% to NAV: ${pct}\nISIN: ${r.isin || 'NA'}\nRating: ${r.rating || '—'}\nYTM: ${r.ytm ?? '—'}\nReport Date: ${r.report_date || '—'}`}
                    >
                      <td className={`${styles.td} ${styles.tdClamp}`} title={r.scheme_name || ''}>
                        <strong>{r.scheme_name || '—'}</strong>
                      </td>
                      <td className={`${styles.td} ${styles.tdClamp}`} title={r.instrument_name || ''}>
                        {r.instrument_name || '—'}
                      </td>
                      <td className={styles.td}>{qty}</td>
                      <td className={styles.td}>{pct}</td>
                      <td className={styles.td}>{r.report_date || '—'}</td>
                      <td className={`${styles.td} ${styles.tdClamp}`} title={r.isin || ''}>
                        {r.isin || 'NA'}
                      </td>
                      <td className={styles.td}>{r.rating || '—'}</td>
                      <td className={styles.td}>{r.ytm ?? '—'}</td>
                      <td className={styles.td}>{modified}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} setPage={setPage} totalPages={totalPages} disabled={loading} />
      </div>
    </div>
  );
}
