import fs from 'fs';
import os from 'os';
import path from 'path';
import { google } from 'googleapis';
import { CONFIG } from './config.js';
import { log } from './logger.js';

export async function getGoogleClients() {
  if (!fs.existsSync(CONFIG.keyPath)) {
    throw new Error(`Service account key not found at: ${CONFIG.keyPath}`);
  }
  const auth = new google.auth.GoogleAuth({ keyFile: CONFIG.keyPath, scopes: CONFIG.scopes });
  const client = await auth.getClient();
  return {
    drive: google.drive({ version: 'v3', auth: client }),
    sheets: google.sheets({ version: 'v4', auth: client }),
  };
}

export async function listAllFilesInFolder(drive) {
  const files = [];
  let pageToken = null;
  const q = `'${CONFIG.folderId}' in parents and trashed=false`;
  do {
    const res = await drive.files.list({
      q,
      spaces: 'drive',
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return files;
}

export async function readGoogleSpreadsheetAllTabs(sheets, fileId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    fields: 'sheets(properties(title,gridProperties(rowCount,columnCount)))',
  });
  const out = [];
  for (const s of meta.data.sheets || []) {
    const title = s.properties?.title || 'Sheet1';
    const rows = Math.min(s.properties?.gridProperties?.rowCount || 1000, 50000);
    const cols = Math.min(s.properties?.gridProperties?.columnCount || 26, 200);
    const range = `'${title.replace(/'/g, "''")}'!A1:${toA1(cols)}${rows}`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId, range, majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
    });
    out.push({ sheetTitle: title, values: res.data.values || [] });
  }
  return out;
}

export async function downloadFileToTemp(drive, fileId, name) {
  const safe = name.replace(/\W+/g, '_');
  const tmpPath = path.join(os.tmpdir(), `drive_${fileId}_${Date.now()}_${safe}`);
  const dest = fs.createWriteStream(tmpPath);
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream', supportsAllDrives: true }
  );
  await new Promise((resolve, reject) => {
    res.data.on('end', resolve).on('error', reject).pipe(dest);
  });
  return tmpPath;
}

function toA1(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
