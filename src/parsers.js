import fs from 'fs';
import XLSX from 'xlsx';
import { log } from './logger.js';

export function parseExcelToSheets(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const out = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    if (aoa.length) out.push({ sheetTitle: sheetName, values: aoa });
  }
  return out;
}

export function parseCsvToSheets(filePath) {
  const wb = XLSX.readFile(filePath); // XLSX can read CSV
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  return [{ sheetTitle: sheetName || 'CSV', values: aoa }];
}

export function detectFileKind(mime, name) {
  const n = (name || '').toLowerCase();
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'gsheet';
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel' || n.endsWith('.xlsx') || n.endsWith('.xls')) return 'excel';
  if (mime === 'text/csv' || n.endsWith('.csv')) return 'csv';
  return 'other';
}
