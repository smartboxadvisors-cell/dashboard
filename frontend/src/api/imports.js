// const API_BASE = 'http://localhost:5000/api';

// export async function fetchImports({ page = 1, limit = 50, scheme = '', rating = '', isin = '', from = '', to = '' } = {}) {
//   const params = new URLSearchParams({
//     page: String(page),
//     limit: String(limit),
//   });
//   if (scheme) params.set('scheme', scheme);
//   if (rating) params.set('rating', rating);
//   if (isin) params.set('isin', isin);
//   if (from) params.set('from', from);
//   if (to) params.set('to', to);

//   const res = await fetch(`${API_BASE}/imports?${params.toString()}`, {
//     headers: { Accept: 'application/json' },
//   });

//   const ct = res.headers.get('content-type') || '';
//   const raw = await res.text();
//   if (!ct.includes('application/json')) {
//     throw new Error(`Expected JSON, got: ${raw.slice(0, 150)}…`);
//   }
//   const json = JSON.parse(raw);
//   if (!res.ok) throw new Error(json?.error || json?.message || 'Request failed');

//   return {
//     items: Array.isArray(json.items) ? json.items : [],
//     total: Number(json.total || 0),
//     totalPages: Math.max(1, Number(json.totalPages || 1)),
//   };
// }

// src/api/imports.js
const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Fetch paged, filtered imports from backend.
 *
 * @param {Object} params
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.scheme
 * @param {string} params.instrument
 * @param {string} params.isin
 * @param {string} params.rating
 * @param {string} params.from           // report_date from (yyyy-mm-dd)
 * @param {string} params.to             // report_date to   (yyyy-mm-dd)
 * @param {number|null} params.quantityMin
 * @param {number|null} params.quantityMax
 * @param {number|null} params.pctToNavMin
 * @param {number|null} params.pctToNavMax
 * @param {number|null} params.ytmMin
 * @param {number|null} params.ytmMax
 * @param {string} params.modifiedFrom   // ISO date (yyyy-mm-dd)
 * @param {string} params.modifiedTo     // ISO date (yyyy-mm-dd)
 * @param {AbortSignal} [signal]         // optional AbortController signal
 */
export async function fetchImports(
  {
    page = 1,
    limit = 50,
    scheme = '',
    instrument = '',
    isin = '',
    rating = '',
    from = '',
    to = '',
    quantityMin = null,
    quantityMax = null,
    pctToNavMin = null,
    pctToNavMax = null,
    ytmMin = null,
    ytmMax = null,
    modifiedFrom = '',
    modifiedTo = '',
  } = {},
  { signal } = {}
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  const setIfPresent = (key, val) => {
    if (val === null || val === undefined) return;
    // allow 0 and "0", skip only empty string
    if (typeof val === 'string') {
      if (val.trim() === '') return;
      params.set(key, val.trim());
    } else {
      params.set(key, String(val));
    }
  };

  // text / exact-ish
  setIfPresent('scheme', scheme);
  setIfPresent('instrument', instrument);
  setIfPresent('isin', isin);
  setIfPresent('rating', rating);

  // report_date range
  setIfPresent('from', from);
  setIfPresent('to', to);

  // numeric ranges
  setIfPresent('quantityMin', quantityMin);
  setIfPresent('quantityMax', quantityMax);
  setIfPresent('pctToNavMin', pctToNavMin);
  setIfPresent('pctToNavMax', pctToNavMax);
  setIfPresent('ytmMin', ytmMin);
  setIfPresent('ytmMax', ytmMax);

  // modified range
  setIfPresent('modifiedFrom', modifiedFrom);
  setIfPresent('modifiedTo', modifiedTo);

  const url = `${API_BASE}/imports?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  const ct = res.headers.get('content-type') || '';
  const body = await res.text();

  if (!ct.includes('application/json')) {
    throw new Error(`Expected JSON, got: ${body.slice(0, 200)}…`);
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    throw new Error(`Invalid JSON: ${body.slice(0, 200)}…`);
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
  }

  return {
    items: Array.isArray(json.items) ? json.items : [],
    total: Number(json.total || 0),
    totalPages: Math.max(1, Number(json.totalPages || 1)),
  };
}
