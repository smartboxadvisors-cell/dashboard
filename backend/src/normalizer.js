// // Header normalization & meta extraction tailored to your screenshots.

// const HEADER_SYNONYMS = {
//   instrument_name: ["name of the instrument","name of instrument","instrument","security name","name"],
//   isin: ["isin"],
//   rating: ["industry / rating","industry/rating","industry rating","rating","industry"],
//   quantity: ["quantity","qty","units"],
//   market_value_lacs: [
//     "market/fair value ( rs. in lakhs)","market/ fair value ( rs. in lakhs)",
//     "market/fair value ( rs. in lacs)","market value (rs. in lakhs)",
//     "market value (rs. in lacs)","market/fair value"
//   ],
//   pct_to_nav: ["% to nav","% to nav.","percent to nav","pct to nav"],
//   ytm: ["ytm","yield","yield to maturity","yield%", "ytm~"]
// };

// const SECTION_ROWS = [
//   "debt instruments","government securities","money market instruments",
//   "treps","reverse repo","others","cash margin","net current assets"
// ];
// const TOTAL_ROWS = ["subtotal","total","grand total","grand  total"];

// const keep = v => v !== undefined && v !== null && String(v).trim() !== '';

// export function normalizeRows(values, meta) {
//   if (!Array.isArray(values) || values.length === 0) return [];
//   const { report_date, scheme_name } = extractBanner(values, meta.fileName);

//   const headerIdx = findHeaderRow(values);
//   const header = values[headerIdx] || [];
//   const map = buildHeaderMap(header);

//   const docs = [];
//   for (let r = headerIdx + 1; r < values.length; r++) {
//     const row = values[r] || [];
//     if (row.every(c => !keep(c))) continue;
//     if (looksLikeSectionOrTotal(row[0])) continue;

//     const doc = {
//       instrument_name: null,
//       isin: null,
//       rating: null,
//       quantity: null,
//       market_value_lacs: null,
//       pct_to_nav: null,
//       ytm: null,

//       report_date,
//       scheme_name,

//       _fileId: meta.fileId,
//       _fileName: meta.fileName,
//       _sheetTitle: meta.sheetTitle,
//       _rowIndex: r - headerIdx,
//       _modifiedTime: meta.modifiedTime
//     };

//     header.forEach((_, idx) => {
//       const k = map[idx];
//       if (!k) return;
//       const val = row[idx];
//       switch (k) {
//         case 'instrument_name':
//         case 'rating':
//         case 'isin':
//           doc[k] = keep(val) ? String(val).trim() : null;
//           break;
//         case 'quantity':
//         case 'market_value_lacs':
//         case 'pct_to_nav':
//         case 'ytm':
//           doc[k] = toNumber(val);
//           break;
//       }
//     });


//     if (!doc.instrument_name && !doc.isin) continue;
//     if (isTotalOrSectionName(doc.instrument_name)) continue;

//     docs.push(doc);
//   }
//   return docs;
// }

// function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g,' ').trim(); }

// function findHeaderRow(values) {
//   for (let i = 0; i < Math.min(values.length, 60); i++) {
//     const r = values[i] || [];
//     const j = r.map(c => norm(c)).join(' | ');
//     let hits = 0;
//     if (j.includes('name of the instrument') || j.includes('instrument')) hits++;
//     if (j.includes('isin')) hits++;
//     if (j.includes('% to nav')) hits++;
//     if (j.includes('ytm') || j.includes('yield')) hits++;
//     if (hits >= 2) return i;
//   }
//   return 0;
// }

// function buildHeaderMap(headerRow) {
//   const map = {};
//   const canon = {};
//   for (const [k, arr] of Object.entries(HEADER_SYNONYMS)) canon[k] = arr.map(norm);
//   headerRow.forEach((h, i) => {
//     const H = norm(h);
//     let m = null;
//     for (const [k, arr] of Object.entries(canon)) if (arr.includes(H)) { m = k; break; }
//     if (!m) {
//       if (/isin/.test(H)) m = 'isin';
//       else if (/instrument|security/.test(H)) m = 'instrument_name';
//       else if (/%to\s?nav/.test(H)) m = 'pct_to_nav';
//       else if (/yield|ytm/.test(H)) m = 'ytm';
//       else if (/qty|quantity|units/.test(H)) m = 'quantity';
//       else if (/market.*value|fair.*value/.test(H)) m = 'market_value_lacs';
//       else if (/rating|industry/.test(H)) m = 'rating';
//     }
//     if (m) map[i] = m;
//   });
//   return map;
// }

// function extractBanner(values, fileName = '') {
//   const top = values.slice(0, 10).map(r => r.map(c => String(c || '')));
//   let date = null, scheme = null;

//   for (let i = 0; i < top.length; i++) {
//     const line = top[i].join(' ').trim();
//     const m = /portfolio statement\s+as on\s+(.+)/i.exec(line);
//     if (m) {
//       date = m[1].trim();
//       for (let j = i + 1; j < top.length; j++) {
//         const ln = top[j].join(' ').trim();
//         if (ln) { scheme = ln; break; }
//       }
//       break;
//     }
//   }

//   // fallback: first non-empty line
//   if (!scheme) {
//     for (const row of top) {
//       const ln = row.join(' ').trim();
//       if (ln && !/portfolio statement/i.test(ln)) { scheme = ln; break; }
//     }
//   }

//   // --- SMART FIX: if scheme looks generic, fallback to fileName ---
//   if (
//     !scheme ||
//     /^index/i.test(scheme) ||
//     scheme.toLowerCase() === 'n/a'
//   ) {
//     scheme = extractSchemeFromFileName(fileName);
//   }

//   return { report_date: date || null, scheme_name: scheme || null };
// }

// function extractSchemeFromFileName(fileName) {
//   if (!fileName) return null;
//   let base = fileName.toLowerCase();

//   // remove id/hash prefixes like "21e019ea-"
//   base = base.replace(/^[0-9a-f]{6,}-/, '');

//   // remove extensions
//   base = base.replace(/\.(xlsx|xls|csv)$/i, '');

//   // replace dashes/underscores with spaces
//   base = base.replace(/[-_]+/g, ' ');

//   // remove common trailing words like dates
//   base = base.replace(/\b\d{1,2}\s?[a-z]{3,}\s?\d{4}\b/i, '');
//   base = base.replace(/\b\d{4}-\d{2}-\d{2}\b/, '');

//   // trim & capitalize nicely
//   base = base.trim().replace(/\s+/g, ' ');
//   return titleCase(base);
// }

// function titleCase(str) {
//   return str.replace(/\w\S*/g, (txt) =>
//     txt.charAt(0).toUpperCase() + txt.substring(1)
//   );
// }

// function toNumber(x) {
//   if (x === null || x === undefined) return null;
//   if (typeof x === 'number') return x;
//   const s = String(x).trim();
//   if (!s || s === '-' || /^nil$/i.test(s)) return null;
//   const pct = s.endsWith('%') ? s.slice(0, -1) : s;
//   const num = Number(pct.replace(/,/g, ''));
//   return Number.isFinite(num) ? num : null;
// }

// function looksLikeSectionOrTotal(v) {
//   const s = norm(v);
//   return isTotalOrSectionName(s);
// }
// function isTotalOrSectionName(s) {
//   if (!s) return false;
//   if (SECTION_ROWS.some(t => s.startsWith(t))) return true;
//   if (TOTAL_ROWS.some(t => s === t)) return true;
//   return false;
// }

// src/normalizer.js

// --- Canonical header synonyms (case/space/char-insensitive via norm()) ---
const HEADER_SYNONYMS = {
  instrument_name: [
    'name of the instrument', 'name of instrument', 'instrument',
    'security name', 'name', 'security'
  ],
  isin: ['isin', 'i s i n'],
  rating: [
    'industry / rating', 'industry/rating', 'industry rating', 'rating', 'industry',
    'credit rating', 'credit/ rating'
  ],
  quantity: ['quantity', 'qty', 'units', 'no. of units', 'no of units'],
  market_value_lacs: [
    'market/fair value ( rs. in lakhs)', 'market/ fair value ( rs. in lakhs)',
    'market/fair value ( rs. in lacs)', 'market value (rs. in lakhs)',
    'market value (rs. in lacs)', 'market/fair value', 'market value',
    'fair value', 'market / fair value'
  ],
  pct_to_nav: [
    '% to nav', '% to net assets', '% to net asset', '% to nav.', 'percent to nav',
    'pct to nav', 'percentage to nav', '% to total assets'
  ],
  ytm: ['ytm', 'yield', 'yield to maturity', 'yield%', 'ytm~', 'coupon / ytm'],
};

// Rows that demarcate sections / totals (skip when encountered)
const SECTION_ROWS = [
  'debt instruments', 'government securities', 'money market instruments',
  'treps', 'reverse repo', 'others', 'cash margin', 'net current assets',
  'state development loans', 'psu bonds', 'corporate bonds'
];
const TOTAL_ROWS = [
  'subtotal', 'sub total', 'total', 'grand total', 'grand  total', 'total (a+b)'
];

const keep = (v) => v !== undefined && v !== null && String(v).trim() !== '';

export function normalizeRows(values, meta) {
  if (!Array.isArray(values) || values.length === 0) return [];

  // Extract banner (scheme + date) from top & meta fallback
  const banner = extractBanner(values, meta.fileName);
  const report_date_iso =
    toIsoDate(banner.report_date) ||
    toIsoDate(meta.modifiedTime) ||
    null;

  const scheme_name = banner.scheme_name || extractSchemeFromFileName(meta.fileName) || null;

  // Find the actual header row in the sheet
  const headerIdx = findHeaderRow(values);
  const header = values[headerIdx] || [];
  const map = buildHeaderMap(header);

  const docs = [];
  for (let r = headerIdx + 1; r < values.length; r++) {
    const row = values[r] || [];
    if (row.every((c) => !keep(c))) continue;

    // If first cell looks like a section or total, we stop or skip line
    const first = String(row[0] ?? '');
    if (looksLikeSectionOrTotal(first)) {
      // If it's a grand total-like row, assume table ended
      if (isStrictTotal(first)) break;
      continue;
    }

    const doc = {
      instrument_name: null,
      isin: null,
      rating: null,
      quantity: null,
      market_value_lacs: null,
      pct_to_nav: null,
      ytm: null,

      issuer: null, // inferred below

      report_date: banner.report_date || (report_date_iso ?? null),
      report_date_iso: report_date_iso,
      scheme_name,

      _fileId: meta.fileId,
      _fileName: meta.fileName,
      _sheetTitle: meta.sheetTitle,
      _rowIndex: r - headerIdx,
      _modifiedTime: meta.modifiedTime,
      _source: 'google_drive',
    };

    // Map each column to our canonical keys
    header.forEach((_, idx) => {
      const k = map[idx];
      if (!k) return;
      const val = row[idx];
      switch (k) {
        case 'instrument_name':
        case 'rating':
        case 'isin':
          doc[k] = keep(val) ? String(val).trim() : null;
          break;
        case 'quantity':
        case 'market_value_lacs':
        case 'pct_to_nav':
        case 'ytm':
          doc[k] = toNumber(val);
          break;
      }
    });

    // Discard empty lines & total lines
    if (!doc.instrument_name && !doc.isin) continue;
    if (isTotalOrSectionName(doc.instrument_name)) continue;

    // Infer issuer from instrument name (fallback to readable prefix)
    doc.issuer = inferIssuer(doc.instrument_name) || null;

    docs.push(doc);
  }

  return docs;
}

// ---------- Helpers ----------

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.]/g, '.')
    .replace(/[–—\-]+/g, '-') // normalize dashes
    .trim();
}

function findHeaderRow(values) {
  // Scan first 80 rows for something that contains at least two of: instrument/isin/% to nav/ytm
  for (let i = 0; i < Math.min(values.length, 80); i++) {
    const r = values[i] || [];
    const j = r.map((c) => norm(c)).join(' | ');

    let hits = 0;
    if (/\binstrument\b|\bsecurity\b|\bname of the instrument\b/.test(j)) hits++;
    if (/\bisin\b/.test(j)) hits++;
    if (/%\s*to\s*(nav|net assets)/.test(j)) hits++;
    if (/\bytm\b|\byield\b/.test(j)) hits++;

    if (hits >= 2) return i;
  }
  // fallback: 0 (rare)
  return 0;
}

function buildHeaderMap(headerRow) {
  const map = {};
  const canon = {};
  for (const [k, arr] of Object.entries(HEADER_SYNONYMS)) canon[k] = arr.map(norm);

  headerRow.forEach((h, i) => {
    const H = norm(h);

    let m = null;
    for (const [k, arr] of Object.entries(canon)) {
      if (arr.includes(H)) {
        m = k;
        break;
      }
    }
    if (!m) {
      if (/isin/.test(H)) m = 'isin';
      else if (/instrument|security/.test(H)) m = 'instrument_name';
      else if (/%\s*to\s*(nav|net assets)/.test(H)) m = 'pct_to_nav';
      else if (/yield|ytm/.test(H)) m = 'ytm';
      else if (/\bqty\b|\bquantity\b|\bunits?\b/.test(H)) m = 'quantity';
      else if (/market.*value|fair.*value/.test(H)) m = 'market_value_lacs';
      else if (/\brating\b|\bindustry\b/.test(H)) m = 'rating';
    }
    if (m) map[i] = m;
  });

  return map;
}

function extractBanner(values, fileName = '') {
  const top = values.slice(0, 15).map((r) => r.map((c) => String(c || '')));
  let date = null, scheme = null;

  // A) Look for "Portfolio Statement as on ..."
  for (let i = 0; i < top.length; i++) {
    const line = top[i].join(' ').trim();
    const m =
      /\b(portfolio|fortnightly|monthly)\s+statement.*\b(as on|as of)\b\s*[:\-]?\s*(.+)$/i.exec(line) ||
      /\b(as on|as of)\b\s*[:\-]?\s*(.+)$/i.exec(line);
    if (m && m[2]) {
      date = cleanDateString(m[2]);
      // try to find scheme near this line (next non-empty that ends with FUND)
      for (let j = i - 2; j <= i + 4; j++) {
        const ln = top[j]?.join(' ').trim();
        if (!ln) continue;
        const mFund = /([A-Za-z0-9 .&()\-]+fund)\b/i.exec(ln);
        if (mFund) { scheme = mFund[1].replace(/\s+/g, ' ').trim(); break; }
      }
      if (!scheme) {
        // or next non-empty line
        for (let j = i + 1; j < top.length; j++) {
          const ln = top[j].join(' ').trim();
          if (ln && !/portfolio|statement|fortnightly|monthly/i.test(ln)) {
            scheme = ln;
            break;
          }
        }
      }
      break;
    }
  }

  // B) If not found, scan top lines for something ending with FUND
  if (!scheme) {
    for (let i = 0; i < top.length; i++) {
      const line = top[i].join(' ').trim();
      const mFund = /([A-Za-z0-9 .&()\-]+fund)\b/i.exec(line);
      if (mFund) { scheme = mFund[1].replace(/\s+/g, ' ').trim(); break; }
    }
  }

  // C) Fallback to first non-empty line that's not meta
  if (!scheme) {
    for (const row of top) {
      const ln = row.join(' ').trim();
      if (ln && !/portfolio|statement|fortnightly|monthly/i.test(ln)) { scheme = ln; break; }
    }
  }

  // Fallback to filename-derived scheme
  if (!scheme || /^index/i.test(scheme) || scheme.toLowerCase() === 'n/a') {
    scheme = extractSchemeFromFileName(fileName);
  }

  // Try to find a date anywhere in the top banner if still not found
  if (!date) {
    for (let i = 0; i < top.length; i++) {
      const iso = toIsoDate(top[i].join(' '));
      if (iso) { date = top[i].join(' '); break; }
    }
  }

  return { report_date: date || null, scheme_name: scheme || null };
}

function extractSchemeFromFileName(fileName) {
  if (!fileName) return null;
  let base = fileName;

  // strip extension
  base = base.replace(/\.(xlsx?|csv)$/i, '');
  // remove leading hashes/ids
  base = base.replace(/^[0-9a-f]{6,}-/i, '');
  // spaces
  base = base.replace(/[-_]+/g, ' ');
  // drop trailing dates
  base = base.replace(/\b\d{1,2}\s?[A-Za-z]{3,}\s?\d{2,4}\b/i, '');
  base = base.replace(/\b\d{4}-\d{2}-\d{2}\b/, '');
  base = base.trim().replace(/\s+/g, ' ');
  return titleCase(base);
}

function titleCase(str) {
  return String(str || '').replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

function toNumber(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const s = String(x).trim();
  if (!s || s === '-' || /^nil$/i.test(s)) return null;
  const pct = s.endsWith('%') ? s.slice(0, -1) : s;
  const num = Number(pct.replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

function cleanDateString(s = '') {
  return s.replace(/^\s*[:\-]\s*/, '').trim();
}

function toIsoDate(s) {
  if (!s) return null;
  const str = String(s);
  // Try native parse first
  let d = new Date(str);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);

  // Patterns like 15-Aug-2025, 15/08/2025, Aug 15, 2025, 15 August 2025
  const mon = {
    jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11
  };

  // DD-MMM-YYYY or DD MMM YYYY
  let m = str.match(/(\d{1,2})[\s\-\/]([A-Za-z]{3,})[\s\-\/](\d{2,4})/);
  if (m) {
    const dd = +m[1], mm = mon[m[2].slice(0,4).toLowerCase()];
    const yyyy = +m[3] < 100 ? 2000 + (+m[3]) : +m[3];
    if (mm >= 0) {
      d = new Date(Date.UTC(yyyy, mm, dd));
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }

  // MMM DD, YYYY or Month DD, YYYY
  m = str.match(/([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{2,4})/);
  if (m) {
    const mm = mon[m[1].slice(0,4).toLowerCase()], dd = +m[2];
    const yyyy = +m[3] < 100 ? 2000 + (+m[3]) : +m[3];
    if (mm >= 0) {
      d = new Date(Date.UTC(yyyy, mm, dd));
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const dd = +m[1], mm = +m[2] - 1;
    const yyyy = +m[3] < 100 ? 2000 + (+m[3]) : +m[3];
    d = new Date(Date.UTC(yyyy, mm, dd));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }

  return null;
}

function looksLikeSectionOrTotal(v) {
  const s = norm(v);
  return isTotalOrSectionName(s);
}

function isStrictTotal(v) {
  const s = norm(v);
  return ['grand total', 'total', 'subtotal', 'sub total', 'grand  total'].includes(s);
}

function isTotalOrSectionName(s) {
  if (!s) return false;
  const S = norm(s);
  if (SECTION_ROWS.some((t) => S.startsWith(t))) return true;
  if (TOTAL_ROWS.some((t) => S === t)) return true;
  return false;
}

// --- Issuer inference from instrument_name ---
function inferIssuer(instrument = '') {
  const s = (instrument || '').toUpperCase();

  if (/\bGOI\b|\bG-?SEC\b|\bGOVT\b|GOVERNMENT OF INDIA/.test(s)) return 'Government of India';
  if (/STATE DEV(L|E)OPMENT LOAN|SDL\b/.test(s)) return 'State Government';
  if (/\bPFC\b|POWER FINANCE/.test(s)) return 'Power Finance Corporation Ltd';
  if (/\bIRFC\b/.test(s)) return 'Indian Railway Finance Corporation Ltd';
  if (/\bREC\b|RURAL ELECTRIFICATION/.test(s)) return 'REC Ltd';
  if (/\bNABARD\b/.test(s)) return 'NABARD';
  if (/\bSIDBI\b/.test(s)) return 'SIDBI';
  if (/\bNHAI\b/.test(s)) return 'NHAI';
  if (/\bHUDCO\b/.test(s)) return 'HUDCO';
  if (/\bKFC\b|KERALA FINANCIAL/.test(s)) return 'Kerala Financial Corporation';
  if (/AJMER VIDYUT|AVVNL/.test(s)) return 'Ajmer Vidyut Vitran Nigam Ltd';
  if (/AP STATE BEVERAGES/.test(s)) return 'AP State Beverages Corporation Ltd';
  if (/\bNHPC\b/.test(s)) return 'NHPC Ltd';
  if (/\bNTPC\b/.test(s)) return 'NTPC Ltd';
  if (/\bKSEB\b|KERALA STATE ELECTRICITY/.test(s)) return 'Kerala State Electricity Board';

  // Fallback: return the leading alphas as a coarse issuer guess
  const m = s.match(/^[A-Z&.\-\s()]+/);
  return m ? m[0].trim().replace(/\s+/g, ' ') : null;
}

export {
  inferIssuer, // exported in case you want to reuse in other modules
};
