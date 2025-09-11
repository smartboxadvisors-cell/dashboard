// import fs from 'fs';
// import XLSX from 'xlsx';
// import { log } from './logger.js';

// export function parseExcelToSheets(filePath) {
//   const wb = XLSX.readFile(filePath, { cellDates: true });
//   const out = [];
//   for (const sheetName of wb.SheetNames) {
//     const ws = wb.Sheets[sheetName];
//     const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
//     if (aoa.length) out.push({ sheetTitle: sheetName, values: aoa });
//   }
//   return out;
// }

// export function parseCsvToSheets(filePath) {
//   const wb = XLSX.readFile(filePath); // XLSX can read CSV
//   const sheetName = wb.SheetNames[0];
//   const ws = wb.Sheets[sheetName];
//   const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
//   return [{ sheetTitle: sheetName || 'CSV', values: aoa }];
// }

// export function detectFileKind(mime, name) {
//   const n = (name || '').toLowerCase();
//   if (mime === 'application/vnd.google-apps.spreadsheet') return 'gsheet';
//   if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel' || n.endsWith('.xlsx') || n.endsWith('.xls')) return 'excel';
//   if (mime === 'text/csv' || n.endsWith('.csv')) return 'csv';
//   return 'other';
// }


// src/parser.js
import fs from 'fs';
import XLSX from 'xlsx';
import { log } from './logger.js';

/**
 * Parse an Excel file (.xlsx, .xls) into [{ sheetTitle, values }]
 * values = array of arrays (AOA).
 */
export function parseExcelToSheets(filePath) {
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const out = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: true,
        blankrows: false,
      });
      if (aoa.length) out.push({ sheetTitle: sheetName, values: aoa });
    }
    return out;
  } catch (e) {
    log.error({ err: e?.message, filePath }, 'Failed to parse Excel');
    return [];
  }
}

/**
 * Parse a CSV file into [{ sheetTitle, values }]
 * Uses XLSX to handle various delimiters.
 */
export function parseCsvToSheets(filePath) {
  try {
    // Ensure UTF-8 BOM is handled
    const buf = fs.readFileSync(filePath);
    const str = buf.toString('utf8').replace(/^\uFEFF/, ''); // strip BOM
    const wb = XLSX.read(str, { type: 'string' });
    const sheetName = wb.SheetNames[0] || 'CSV';
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      blankrows: false,
    });
    return [{ sheetTitle: sheetName, values: aoa }];
  } catch (e) {
    log.error({ err: e?.message, filePath }, 'Failed to parse CSV');
    return [];
  }
}

/**
 * Detect the kind of file based on mime type and filename.
 * Returns one of: 'gsheet', 'excel', 'csv', 'other'.
 */
export function detectFileKind(mime, name) {
  const n = (name || '').toLowerCase();

  if (mime === 'application/vnd.google-apps.spreadsheet') return 'gsheet';

  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    n.endsWith('.xlsx') ||
    n.endsWith('.xls')
  ) {
    return 'excel';
  }

  if (mime === 'text/csv' || n.endsWith('.csv')) return 'csv';

  return 'other';
}
