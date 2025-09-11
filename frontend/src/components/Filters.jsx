// // src/components/Filters.jsx
// import styles from '../styles/filters.module.css';

// // Common Indian MF instrument buckets
// const INSTRUMENT_OPTIONS = [
//   'ALL',
//   'NCD',
//   'Debenture/Bond',
//   'Zero Coupon Bond',
//   'Commercial Paper (CP)',
//   'Certificate of Deposit (CD)',
//   'Government Bond (G-Sec)',
//   'State Development Loan (SDL)',
//   'Treasury Bill (T-Bill)',
//   'Securitised Debt / PTC',
//   'MLD',
//   'Equity',
//   'Preference Share',
//   'TREPS/Reverse Repo/CBLO',
//   'Cash & Net Receivables',
//   'OTHER / CUSTOM',
// ];

// // Broad ratings list (long-term + short-term + extras)
// const RATING_OPTIONS = [
//   'ALL',
//   // Long-term
//   'AAA','AAA (CE)','AA+','AA+ (CE)','AA','AA (CE)','AA-','AA- (CE)',
//   'A+','A+ (CE)','A','A (CE)','A-','A- (CE)',
//   'BBB+','BBB+ (CE)','BBB','BBB (CE)','BBB-','BBB- (CE)',
//   'BB+','BB','BB-','B+','B','B-','C','D',
//   // Short-term
//   'A1+','A1','A2+','A2','A3+','A3','A4+','A4',
//   // Misc/edge
//   'Unrated','Not Rated','NR','IND AAA','CRISIL AAA','[ICRA]AAA'
// ];

// export default function Filters({
//   // Text filters
//   schemeInput, setSchemeInput,
//   instrumentInput, setInstrumentInput,
//   isinInput, setIsinInput,

//   // Rating
//   ratingInput, setRatingInput,

//   // Number ranges
//   quantityMin, setQuantityMin,
//   quantityMax, setQuantityMax,
//   pctToNavMin, setPctToNavMin,
//   pctToNavMax, setPctToNavMax,
//   ytmMin, setYtmMin,
//   ytmMax, setYtmMax,

//   // Dates
//   fromInput, setFromInput,
//   toInput, setToInput,
//   modifiedFrom, setModifiedFrom,
//   modifiedTo, setModifiedTo,

//   // Paging / meta
//   limit, setLimit,
//   onReset,
//   total, loading
// }) {
//   // local state to show/hide custom instrument text box
//   const isCustomInstrument = instrumentInput && !INSTRUMENT_OPTIONS.some(o =>
//     o !== 'OTHER / CUSTOM' && o !== 'ALL' && instrumentInput.toLowerCase() === o.toLowerCase()
//   );

//   const handleInstrumentSelect = (val) => {
//     if (val === 'ALL') return setInstrumentInput('');
//     if (val === 'OTHER / CUSTOM') return setInstrumentInput(''); // show input for custom text
//     setInstrumentInput(val);
//   };

//   return (
//     <div className={styles.card}>
//       <div className={styles.header}>
//         <div className={styles.title}>Filters</div>
//         <div className={styles.meta}>{loading ? 'Loading…' : `${total} results`}</div>
//       </div>

//       <div className={styles.grid}>
//         {/* Scheme */}
//         <div className={styles.field}>
//           <label className={styles.label}>Scheme</label>
//           <input
//             className={styles.input}
//             placeholder="e.g. Bandhan Liquid Fund"
//             value={schemeInput}
//             onChange={(e) => setSchemeInput(e.target.value)}
//           />
//         </div>

//         {/* Instrument (select + optional custom text) */}
//         <div className={styles.field}>
//           <label className={styles.label}>Instrument</label>
//           <select
//             className={styles.select}
//             value={
//               instrumentInput
//                 ? (INSTRUMENT_OPTIONS.find(o => o.toLowerCase() === instrumentInput.toLowerCase()) || 'OTHER / CUSTOM')
//                 : 'ALL'
//             }
//             onChange={(e) => handleInstrumentSelect(e.target.value)}
//           >
//             {INSTRUMENT_OPTIONS.map(opt => (
//               <option key={opt} value={opt}>{opt}</option>
//             ))}
//           </select>
//           {(instrumentInput && isCustomInstrument) || (!instrumentInput) ? (
//             <input
//               className={styles.input}
//               placeholder="type to match: e.g. NCD, Bond, CP…"
//               value={instrumentInput}
//               onChange={(e) => setInstrumentInput(e.target.value)}
//               style={{ marginTop: 6 }}
//             />
//           ) : null}
//         </div>

//         {/* ISIN */}
//         <div className={styles.field}>
//           <label className={styles.label}>ISIN</label>
//           <input
//             className={styles.input}
//             placeholder="e.g. INE123A01016"
//             value={isinInput}
//             onChange={(e) => setIsinInput(e.target.value)}
//           />
//         </div>

//         {/* Rating */}
//         <div className={styles.field}>
//           <label className={styles.label}>Rating</label>
//           <select
//             className={styles.select}
//             value={ratingInput}
//             onChange={(e) => setRatingInput(e.target.value)}
//             title="Matches even if the data has suffixes like (CE), (SO), Outlook, etc."
//           >
//             {RATING_OPTIONS.map(r => (
//               <option key={r} value={r === 'ALL' ? '' : r}>{r}</option>
//             ))}
//           </select>
//         </div>

//         {/* Quantity (Min/Max) */}
//         <div className={styles.field}>
//           <label className={styles.label}>Quantity (Min)</label>
//           <input
//             className={styles.input}
//             type="number"
//             inputMode="numeric"
//             placeholder="e.g. 1000"
//             value={quantityMin ?? ''}
//             onChange={(e) => setQuantityMin(e.target.value === '' ? null : Number(e.target.value))}
//           />
//         </div>
//         <div className={styles.field}>
//           <label className={styles.label}>Quantity (Max)</label>
//           <input
//             className={styles.input}
//             type="number"
//             inputMode="numeric"
//             placeholder="e.g. 50000"
//             value={quantityMax ?? ''}
//             onChange={(e) => setQuantityMax(e.target.value === '' ? null : Number(e.target.value))}
//           />
//         </div>

//         {/* % to NAV (Min/Max) */}
//         <div className={styles.field}>
//           <label className={styles.label}>% to NAV (Min)</label>
//           <input
//             className={styles.input}
//             type="number"
//             step="0.0001"
//             inputMode="decimal"
//             placeholder="e.g. 0.10"
//             value={pctToNavMin ?? ''}
//             onChange={(e) => setPctToNavMin(e.target.value === '' ? null : Number(e.target.value))}
//           />
//         </div>
//         <div className={styles.field}>
//           <label className={styles.label}>% to NAV (Max)</label>
//           <input
//             className={styles.input}
//             type="number"
//             step="0.0001"
//             inputMode="decimal"
//             placeholder="e.g. 5"
//             value={pctToNavMax ?? ''}
//             onChange={(e) => setPctToNavMax(e.target.value === '' ? null : Number(e.target.value))}
//           />
//         </div>

//         {/* YTM (Min/Max) */}
//         <div className={styles.field}>
//           <label className={styles.label}>YTM (Min)</label>
//           <input
//             className={styles.input}
//             type="number"
//             step="0.0001"
//             inputMode="decimal"
//             placeholder="e.g. 6.50"
//             value={ytmMin ?? ''}
//             onChange={(e) => setYtmMin(e.target.value === '' ? null : Number(e.target.value))}
//           />
//         </div>
//         <div className={styles.field}>
//           <label className={styles.label}>YTM (Max)</label>
//           <input
//             className={styles.input}
//             type="number"
//             step="0.0001"
//             inputMode="decimal"
//             placeholder="e.g. 12"
//             value={ytmMax ?? ''}
//             onChange={(e) => setYtmMax(e.target.value === '' ? null : Number(e.target.value))}
//           />
//         </div>

//         {/* Report Date (From/To) */}
//         <div className={styles.field}>
//           <label className={styles.label}>Report Date (From)</label>
//           <input
//             className={styles.input}
//             type="date"
//             value={fromInput || ''}
//             onChange={(e) => setFromInput(e.target.value)}
//           />
//         </div>
//         <div className={styles.field}>
//           <label className={styles.label}>Report Date (To)</label>
//           <input
//             className={styles.input}
//             type="date"
//             value={toInput || ''}
//             onChange={(e) => setToInput(e.target.value)}
//           />
//         </div>

//         {/* Modified (From/To) */}
//         <div className={styles.field}>
//           <label className={styles.label}>Modified (From)</label>
//           <input
//             className={styles.input}
//             type="date"
//             value={modifiedFrom || ''}
//             onChange={(e) => setModifiedFrom(e.target.value)}
//           />
//         </div>
//         <div className={styles.field}>
//           <label className={styles.label}>Modified (To)</label>
//           <input
//             className={styles.input}
//             type="date"
//             value={modifiedTo || ''}
//             onChange={(e) => setModifiedTo(e.target.value)}
//           />
//         </div>

//         {/* Footer row: page size + reset */}
//         <div className={styles.rowEnd}>
//           <select
//             className={styles.select}
//             value={limit}
//             onChange={(e) => setLimit(Number(e.target.value))}
//           >
//             {[25, 50, 100, 200].map(n => (
//               <option key={n} value={n}>{n} / page</option>
//             ))}
//           </select>

//           <button type="button" onClick={onReset} className={styles.ghostBtn}>
//             Reset
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// src/components/Filters.jsx
import styles from '../styles/filters.module.css';

// Broad ratings list used by Indian MFs (long/short term + variants + Sovereign)
const RATING_OPTIONS = [
  'ALL',

  // Sovereign / G-Sec style
  'Sovereign', 'SOVEREIGN', 'SOV',

  // Long-term with common credit enhancements
  'AAA','AAA (CE)','AAA (SO)',
  'AA+','AA+ (CE)','AA+ (SO)',
  'AA','AA (CE)','AA (SO)',
  'AA-','AA- (CE)','AA- (SO)',
  'A+','A+ (CE)','A+ (SO)',
  'A','A (CE)','A (SO)',
  'A-','A- (CE)','A- (SO)',
  'BBB+','BBB+ (CE)','BBB+ (SO)',
  'BBB','BBB (CE)','BBB (SO)',
  'BBB-','BBB- (CE)','BBB- (SO)',
  'BB+','BB','BB-','B+','B','B-','C','D',

  // Short-term (commercial paper/CD etc.)
  'A1+','A1','A2+','A2','A3+','A3','A4+','A4',

  // Generic/agency-tagged and non-rated
  'Unrated','Not Rated','NR',
  'CRISIL AAA','[ICRA]AAA','IND AAA','CARE AAA',
  'CRISIL A1+','[ICRA]A1+','IND A1+','CARE A1+',
];

export default function Filters({
  // Text filters
  schemeInput, setSchemeInput,
  instrumentInput, setInstrumentInput,   // plain input only
  isinInput, setIsinInput,

  // Rating
  ratingInput, setRatingInput,

  // Number ranges
  quantityMin, setQuantityMin,
  quantityMax, setQuantityMax,
  pctToNavMin, setPctToNavMin,
  pctToNavMax, setPctToNavMax,
  ytmMin, setYtmMin,
  ytmMax, setYtmMax,

  // Dates
  fromInput, setFromInput,         // Report Date From
  toInput, setToInput,             // Report Date To
  modifiedFrom, setModifiedFrom,   // Modified From
  modifiedTo, setModifiedTo,       // Modified To

  // Paging / meta
  limit, setLimit,
  onReset,
  total, loading
}) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Filters</div>
        <div className={styles.meta}>{loading ? 'Loading…' : `${total} results`}</div>
      </div>

      <div className={styles.grid}>
        {/* Scheme */}
        <div className={styles.field}>
          <label className={styles.label}>Scheme</label>
          <input
            className={styles.input}
            placeholder="e.g. Bandhan Liquid Fund"
            value={schemeInput}
            onChange={(e) => setSchemeInput(e.target.value)}
          />
        </div>

        {/* Instrument (plain search) */}
        <div className={styles.field}>
          <label className={styles.label}>Instrument</label>
          <input
            className={styles.input}
            placeholder="type to match: NCD, CP, Bond, G-Sec…"
            value={instrumentInput}
            onChange={(e) => setInstrumentInput(e.target.value)}
          />
        </div>

        {/* ISIN */}
        <div className={styles.field}>
          <label className={styles.label}>ISIN</label>
          <input
            className={styles.input}
            placeholder="e.g. INE123A01016"
            value={isinInput}
            onChange={(e) => setIsinInput(e.target.value)}
          />
        </div>

        {/* Rating */}
        <div className={styles.field}>
          <label className={styles.label}>Rating</label>
          <select
            className={styles.select}
            value={ratingInput}
            onChange={(e) => setRatingInput(e.target.value)}
            title="Matches even if data has suffixes like (CE), (SO), outlook, or agency tags."
          >
            {RATING_OPTIONS.map(r => (
              <option key={r} value={r === 'ALL' ? '' : r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Quantity (Min/Max) */}
        <div className={styles.field}>
          <label className={styles.label}>Quantity (Min)</label>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            placeholder="e.g. 1000"
            value={quantityMin ?? ''}
            onChange={(e) => setQuantityMin(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Quantity (Max)</label>
          <input
            className={styles.input}
            type="number"
            inputMode="numeric"
            placeholder="e.g. 50000"
            value={quantityMax ?? ''}
            onChange={(e) => setQuantityMax(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>

        {/* % to NAV (Min/Max) */}
        <div className={styles.field}>
          <label className={styles.label}>% to NAV (Min)</label>
          <input
            className={styles.input}
            type="number"
            step="0.0001"
            inputMode="decimal"
            placeholder="e.g. 0.10"
            value={pctToNavMin ?? ''}
            onChange={(e) => setPctToNavMin(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>% to NAV (Max)</label>
          <input
            className={styles.input}
            type="number"
            step="0.0001"
            inputMode="decimal"
            placeholder="e.g. 5"
            value={pctToNavMax ?? ''}
            onChange={(e) => setPctToNavMax(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>

        {/* YTM (Min/Max) */}
        <div className={styles.field}>
          <label className={styles.label}>YTM (Min)</label>
          <input
            className={styles.input}
            type="number"
            step="0.0001"
            inputMode="decimal"
            placeholder="e.g. 6.50"
            value={ytmMin ?? ''}
            onChange={(e) => setYtmMin(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>YTM (Max)</label>
          <input
            className={styles.input}
            type="number"
            step="0.0001"
            inputMode="decimal"
            placeholder="e.g. 12"
            value={ytmMax ?? ''}
            onChange={(e) => setYtmMax(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>

        {/* Report Date (From/To) */}
        <div className={styles.field}>
          <label className={styles.label}>Report Date (From)</label>
          <input
            className={styles.input}
            type="date"
            value={fromInput || ''}
            onChange={(e) => setFromInput(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Report Date (To)</label>
          <input
            className={styles.input}
            type="date"
            value={toInput || ''}
            onChange={(e) => setToInput(e.target.value)}
          />
        </div>

        {/* Modified (From/To) */}
        <div className={styles.field}>
          <label className={styles.label}>Modified (From)</label>
          <input
            className={styles.input}
            type="date"
            value={modifiedFrom || ''}
            onChange={(e) => setModifiedFrom(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Modified (To)</label>
          <input
            className={styles.input}
            type="date"
            value={modifiedTo || ''}
            onChange={(e) => setModifiedTo(e.target.value)}
          />
        </div>

        {/* Footer row: page size + reset */}
        <div className={styles.rowEnd}>
          <select
            className={styles.select}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[25, 50, 100, 200].map(n => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>

          <button type="button" onClick={onReset} className={styles.ghostBtn}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
