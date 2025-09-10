// Header normalization & meta extraction tailored to your screenshots.

const HEADER_SYNONYMS = {
  instrument_name: ["name of the instrument","name of instrument","instrument","security name","name"],
  isin: ["isin"],
  rating: ["industry / rating","industry/rating","industry rating","rating","industry"],
  quantity: ["quantity","qty","units"],
  market_value_lacs: [
    "market/fair value ( rs. in lakhs)","market/ fair value ( rs. in lakhs)",
    "market/fair value ( rs. in lacs)","market value (rs. in lakhs)",
    "market value (rs. in lacs)","market/fair value"
  ],
  pct_to_nav: ["% to nav","% to nav.","percent to nav","pct to nav"],
  ytm: ["ytm","yield","yield to maturity","yield%"]
};

const SECTION_ROWS = [
  "debt instruments","government securities","money market instruments",
  "treps","reverse repo","others","cash margin","net current assets"
];
const TOTAL_ROWS = ["subtotal","total","grand total","grand  total"];

const keep = v => v !== undefined && v !== null && String(v).trim() !== '';

export function normalizeRows(values, meta) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const { report_date, scheme_name } = extractBanner(values, meta.fileName);

  const headerIdx = findHeaderRow(values);
  const header = values[headerIdx] || [];
  const map = buildHeaderMap(header);

  const docs = [];
  for (let r = headerIdx + 1; r < values.length; r++) {
    const row = values[r] || [];
    if (row.every(c => !keep(c))) continue;
    if (looksLikeSectionOrTotal(row[0])) continue;

    const doc = {
      instrument_name: null,
      isin: null,
      rating: null,
      quantity: null,
      market_value_lacs: null,
      pct_to_nav: null,
      ytm: null,

      report_date,
      scheme_name,

      _fileId: meta.fileId,
      _fileName: meta.fileName,
      _sheetTitle: meta.sheetTitle,
      _rowIndex: r - headerIdx,
      _modifiedTime: meta.modifiedTime
    };

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


    if (!doc.instrument_name && !doc.isin) continue;
    if (isTotalOrSectionName(doc.instrument_name)) continue;

    docs.push(doc);
  }
  return docs;
}

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g,' ').trim(); }

function findHeaderRow(values) {
  for (let i = 0; i < Math.min(values.length, 60); i++) {
    const r = values[i] || [];
    const j = r.map(c => norm(c)).join(' | ');
    let hits = 0;
    if (j.includes('name of the instrument') || j.includes('instrument')) hits++;
    if (j.includes('isin')) hits++;
    if (j.includes('% to nav')) hits++;
    if (j.includes('ytm') || j.includes('yield')) hits++;
    if (hits >= 2) return i;
  }
  return 0;
}

function buildHeaderMap(headerRow) {
  const map = {};
  const canon = {};
  for (const [k, arr] of Object.entries(HEADER_SYNONYMS)) canon[k] = arr.map(norm);
  headerRow.forEach((h, i) => {
    const H = norm(h);
    let m = null;
    for (const [k, arr] of Object.entries(canon)) if (arr.includes(H)) { m = k; break; }
    if (!m) {
      if (/isin/.test(H)) m = 'isin';
      else if (/instrument|security/.test(H)) m = 'instrument_name';
      else if (/%to\s?nav/.test(H)) m = 'pct_to_nav';
      else if (/yield|ytm/.test(H)) m = 'ytm';
      else if (/qty|quantity|units/.test(H)) m = 'quantity';
      else if (/market.*value|fair.*value/.test(H)) m = 'market_value_lacs';
      else if (/rating|industry/.test(H)) m = 'rating';
    }
    if (m) map[i] = m;
  });
  return map;
}

function extractBanner(values, fileName = '') {
  const top = values.slice(0, 10).map(r => r.map(c => String(c || '')));
  let date = null, scheme = null;

  for (let i = 0; i < top.length; i++) {
    const line = top[i].join(' ').trim();
    const m = /portfolio statement\s+as on\s+(.+)/i.exec(line);
    if (m) {
      date = m[1].trim();
      for (let j = i + 1; j < top.length; j++) {
        const ln = top[j].join(' ').trim();
        if (ln) { scheme = ln; break; }
      }
      break;
    }
  }

  // fallback: first non-empty line
  if (!scheme) {
    for (const row of top) {
      const ln = row.join(' ').trim();
      if (ln && !/portfolio statement/i.test(ln)) { scheme = ln; break; }
    }
  }

  // --- SMART FIX: if scheme looks generic, fallback to fileName ---
  if (
    !scheme ||
    /^index/i.test(scheme) ||
    scheme.toLowerCase() === 'n/a'
  ) {
    scheme = extractSchemeFromFileName(fileName);
  }

  return { report_date: date || null, scheme_name: scheme || null };
}

function extractSchemeFromFileName(fileName) {
  if (!fileName) return null;
  let base = fileName.toLowerCase();

  // remove id/hash prefixes like "21e019ea-"
  base = base.replace(/^[0-9a-f]{6,}-/, '');

  // remove extensions
  base = base.replace(/\.(xlsx|xls|csv)$/i, '');

  // replace dashes/underscores with spaces
  base = base.replace(/[-_]+/g, ' ');

  // remove common trailing words like dates
  base = base.replace(/\b\d{1,2}\s?[a-z]{3,}\s?\d{4}\b/i, '');
  base = base.replace(/\b\d{4}-\d{2}-\d{2}\b/, '');

  // trim & capitalize nicely
  base = base.trim().replace(/\s+/g, ' ');
  return titleCase(base);
}

function titleCase(str) {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substring(1)
  );
}

function toNumber(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return x;
  const s = String(x).trim();
  if (!s || s === '-' || /^nil$/i.test(s)) return null;
  const pct = s.endsWith('%') ? s.slice(0, -1) : s;
  const num = Number(pct.replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

function looksLikeSectionOrTotal(v) {
  const s = norm(v);
  return isTotalOrSectionName(s);
}
function isTotalOrSectionName(s) {
  if (!s) return false;
  if (SECTION_ROWS.some(t => s.startsWith(t))) return true;
  if (TOTAL_ROWS.some(t => s === t)) return true;
  return false;
}
