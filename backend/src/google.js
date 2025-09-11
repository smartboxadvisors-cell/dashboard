// import fs from 'fs';
// import os from 'os';
// import path from 'path';
// import { google } from 'googleapis';
// import { CONFIG } from './config.js';
// import { log } from './logger.js';

// export async function getGoogleClients() {
//   if (!fs.existsSync(CONFIG.keyPath)) {
//     throw new Error(`Service account key not found at: ${CONFIG.keyPath}`);
//   }
//   const auth = new google.auth.GoogleAuth({ keyFile: CONFIG.keyPath, scopes: CONFIG.scopes });
//   const client = await auth.getClient();
//   return {
//     drive: google.drive({ version: 'v3', auth: client }),
//     sheets: google.sheets({ version: 'v4', auth: client }),
//   };
// }

// export async function listAllFilesInFolder(drive) {
//   const files = [];
//   let pageToken = null;
//   const q = `'${CONFIG.folderId}' in parents and trashed=false`;
//   do {
//     const res = await drive.files.list({
//       q,
//       spaces: 'drive',
//       fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
//       pageToken,
//       includeItemsFromAllDrives: true,
//       supportsAllDrives: true,
//     });
//     files.push(...(res.data.files || []));
//     pageToken = res.data.nextPageToken || null;
//   } while (pageToken);
//   return files;
// }

// export async function readGoogleSpreadsheetAllTabs(sheets, fileId) {
//   const meta = await sheets.spreadsheets.get({
//     spreadsheetId: fileId,
//     fields: 'sheets(properties(title,gridProperties(rowCount,columnCount)))',
//   });
//   const out = [];
//   for (const s of meta.data.sheets || []) {
//     const title = s.properties?.title || 'Sheet1';
//     const rows = Math.min(s.properties?.gridProperties?.rowCount || 1000, 50000);
//     const cols = Math.min(s.properties?.gridProperties?.columnCount || 26, 200);
//     const range = `'${title.replace(/'/g, "''")}'!A1:${toA1(cols)}${rows}`;
//     const res = await sheets.spreadsheets.values.get({
//       spreadsheetId: fileId, range, majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
//     });
//     out.push({ sheetTitle: title, values: res.data.values || [] });
//   }
//   return out;
// }

// export async function downloadFileToTemp(drive, fileId, name) {
//   const safe = name.replace(/\W+/g, '_');
//   const tmpPath = path.join(os.tmpdir(), `drive_${fileId}_${Date.now()}_${safe}`);
//   const dest = fs.createWriteStream(tmpPath);
//   const res = await drive.files.get(
//     { fileId, alt: 'media' },
//     { responseType: 'stream', supportsAllDrives: true }
//   );
//   await new Promise((resolve, reject) => {
//     res.data.on('end', resolve).on('error', reject).pipe(dest);
//   });
//   return tmpPath;
// }

// function toA1(n) {
//   let s = '';
//   while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
//   return s;
// }

// src/google.js
// import fs from 'fs';
// import os from 'os';
// import path from 'path';
// import { google } from 'googleapis';
// import { CONFIG } from './config.js';
// import { log } from './logger.js';

// /**
//  * Build an authenticated client.
//  * - If CONFIG.delegatedUser is present, use JWT with domain-wide delegation.
//  * - Otherwise, use GoogleAuth with a service-account key file.
//  */
// export async function getGoogleClients() {
//   if (!fs.existsSync(CONFIG.keyPath)) {
//     throw new Error(`Service account key not found at: ${CONFIG.keyPath}`);
//   }

//   let authClient;

//   // Prefer JWT when delegated user is provided (G Suite domain-wide delegation)
//   if (CONFIG.delegatedUser) {
//     const raw = fs.readFileSync(CONFIG.keyPath, 'utf8');
//     const key = JSON.parse(raw);
//     authClient = new google.auth.JWT({
//       email: CONFIG.serviceAccountMail || key.client_email,
//       key: key.private_key,
//       scopes: CONFIG.scopes,
//       subject: CONFIG.delegatedUser,
//     });
//     await authClient.authorize();
//     log.info?.('Google auth: using JWT (delegated user)');
//   } else {
//     const auth = new google.auth.GoogleAuth({
//       keyFile: CONFIG.keyPath,
//       scopes: CONFIG.scopes,
//     });
//     authClient = await auth.getClient();
//     log.info?.('Google auth: using GoogleAuth');
//   }

//   return {
//     drive: google.drive({ version: 'v3', auth: authClient }),
//     sheets: google.sheets({ version: 'v4', auth: authClient }),
//   };
// }

// /**
//  * List ONLY Google Sheets files in a Drive folder.
//  * Optional: pass sinceIso (RFC3339) to fetch only files modified after that time.
//  */
// export async function listFolderSpreadsheetsSince(drive, sinceIso = null) {
//   const terms = [
//     `'${CONFIG.folderId}' in parents`,
//     `mimeType='application/vnd.google-apps.spreadsheet'`,
//     'trashed=false',
//   ];
//   if (sinceIso) terms.push(`modifiedTime > '${sinceIso}'`);

//   const q = terms.join(' and ');
//   const files = [];
//   let pageToken = null;

//   do {
//     const res = await drive.files.list({
//       q,
//       spaces: 'drive',
//       fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,owners,emailAddress)',
//       pageSize: 1000,
//       pageToken,
//       includeItemsFromAllDrives: true,
//       supportsAllDrives: true,
//       orderBy: 'modifiedTime desc',
//     });
//     files.push(...(res.data.files || []));
//     pageToken = res.data.nextPageToken || null;
//   } while (pageToken);

//   log.info?.(`Found files`, { count: files.length });
//   return files;
// }

// /**
//  * Backward-compatible: list all files (any mime) in folder.
//  * Prefer listFolderSpreadsheetsSince for ingestion.
//  */
// export async function listAllFilesInFolder(drive) {
//   const files = [];
//   let pageToken = null;
//   const q = `'${CONFIG.folderId}' in parents and trashed=false`;

//   do {
//     const res = await drive.files.list({
//       q,
//       spaces: 'drive',
//       fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
//       pageToken,
//       includeItemsFromAllDrives: true,
//       supportsAllDrives: true,
//       orderBy: 'modifiedTime desc',
//     });
//     files.push(...(res.data.files || []));
//     pageToken = res.data.nextPageToken || null;
//   } while (pageToken);

//   return files;
// }

// /**
//  * Get spreadsheet metadata (title + sheet list).
//  */
// export async function getSpreadsheetMeta(sheets, fileId) {
//   const res = await sheets.spreadsheets.get({
//     spreadsheetId: fileId,
//     fields:
//       'spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
//   });
//   return res.data;
// }

// /**
//  * Read all tabs from a spreadsheet.
//  * Returns [{ sheetTitle, values }]
//  */
// export async function readGoogleSpreadsheetAllTabs(sheets, fileId) {
//   const meta = await getSpreadsheetMeta(sheets, fileId);
//   const out = [];

//   for (const s of meta.sheets || []) {
//     const title = s.properties?.title || 'Sheet1';
//     const rows = Math.min(s.properties?.gridProperties?.rowCount || 1000, 50000);
//     const cols = Math.min(s.properties?.gridProperties?.columnCount || 26, 200);
//     const range = `'${title.replace(/'/g, "''")}'!A1:${toA1(cols)}${rows}`;

//     const res = await sheets.spreadsheets.values.get({
//       spreadsheetId: fileId,
//       range,
//       majorDimension: 'ROWS',
//       valueRenderOption: 'UNFORMATTED_VALUE',
//     });

//     out.push({ sheetTitle: title, values: res.data.values || [] });
//   }

//   return out;
// }

// /**
//  * Download any Drive file to a temp path.
//  */
// export async function downloadFileToTemp(drive, fileId, name) {
//   const safe = (name || 'file').replace(/\W+/g, '_');
//   const tmpPath = path.join(os.tmpdir(), `drive_${fileId}_${Date.now()}_${safe}`);
//   const dest = fs.createWriteStream(tmpPath);

//   const res = await drive.files.get(
//     { fileId, alt: 'media' },
//     { responseType: 'stream', supportsAllDrives: true }
//   );

//   await new Promise((resolve, reject) => {
//     res.data.on('end', resolve).on('error', reject).pipe(dest);
//   });

//   return tmpPath;
// }

// /** Convert a column number (1-based) to A1 letters. */
// function toA1(n) {
//   let s = '';
//   while (n > 0) {
//     const m = (n - 1) % 26;
//     s = String.fromCharCode(65 + m) + s;
//     n = Math.floor((n - 1) / 26);
//   }
//   return s;
// }




// src/google.js
import fs from 'fs';
import os from 'os';
import path from 'path';
import { google } from 'googleapis';
import { CONFIG } from './config.js';
import { log } from './logger.js';

// src/google.js (add this helper)
const MIME_GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_XLS  = "application/vnd.ms-excel";
const MIME_CSV  = "text/csv";

const SPREADSHEET_MIMES = new Set([MIME_GOOGLE_SHEET, MIME_XLSX, MIME_XLS, MIME_CSV]);

export async function listSpreadsheetsRecursive(drive, rootFolderId, sinceIso = null) {
  const out = [];
  const folderQueue = [rootFolderId];

  while (folderQueue.length) {
    const folderId = folderQueue.pop();

    let pageToken = null;
    do {
      const { data } = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        spaces: 'drive',
        fields:
          'nextPageToken,files(id,name,mimeType,modifiedTime,parents,webViewLink,' +
            'owners(emailAddress,displayName))',
        orderBy: 'modifiedTime desc',
        pageSize: 1000,
        pageToken,
      });

      for (const f of data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          // enqueue subfolder
          folderQueue.push(f.id);
          continue;
        }
        // filter by time (if provided)
        if (sinceIso && new Date(f.modifiedTime) <= new Date(sinceIso)) continue;

        // keep only spreadsheet-ish files
        if (SPREADSHEET_MIMES.has(f.mimeType)) out.push(f);
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);
  }

  return out;
}


/**
 * Build an authenticated client.
 * - If CONFIG.delegatedUser is present, use JWT with domain-wide delegation (impersonate human).
 * - Otherwise, act as the service account (share the folder to the SA email).
 */
export async function getGoogleClients() {
  const keyPath = CONFIG.keyPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error(`Service account key not found at: ${keyPath || '(unset)'}`);
  }

  // Read SA JSON once
  const raw = fs.readFileSync(keyPath, 'utf8');
  const key = JSON.parse(raw);

  const scopes = CONFIG.scopes && CONFIG.scopes.length
    ? CONFIG.scopes
    : [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ];

  let authClient;

  // Prefer JWT when delegated user is provided (Workspace domain-wide delegation)
  if (CONFIG.delegatedUser) {
    authClient = new google.auth.JWT({
      // Prefer explicit env SA mail if provided; fallback to key.client_email
      email: CONFIG.serviceAccountMail || key.client_email,
      key: key.private_key,
      scopes,
      subject: CONFIG.delegatedUser, // <- critical for DWD
    });
    await authClient.authorize();
    log.info?.('Google auth: using JWT (delegated user)');
  } else {
    // No impersonation — act as the service account
    const googleAuth = new google.auth.GoogleAuth({
      credentials: key, // avoid path issues on Windows
      scopes,
    });
    authClient = await googleAuth.getClient();
    log.info?.('Google auth: using GoogleAuth (service account identity)');
  }

  return {
    drive: google.drive({ version: 'v3', auth: authClient }),
    sheets: google.sheets({ version: 'v4', auth: authClient }),
  };
}

/**
 * List ONLY Google Sheets files in a Drive folder.
 * Optional: pass sinceIso (RFC3339) to fetch only files modified after that time.
 */
export async function listFolderSpreadsheetsSince(drive, sinceIso = null) {
  if (!CONFIG.folderId) {
    throw new Error('CONFIG.folderId is not set');
  }

  const terms = [
    `'${CONFIG.folderId}' in parents`,
    `mimeType='application/vnd.google-apps.spreadsheet'`,
    'trashed=false',
  ];
  if (sinceIso) terms.push(`modifiedTime > '${sinceIso}'`);

  const q = terms.join(' and ');
  const files = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q,
      spaces: 'drive',
      // ✅ FIX: emailAddress must be nested under owners(...) or lastModifyingUser(...)
      fields:
        'nextPageToken,files(' +
          'id,name,mimeType,modifiedTime,parents,webViewLink,' +
          'owners(emailAddress,displayName),' +
          'lastModifyingUser(emailAddress,displayName)' +
        ')',
      pageSize: 1000,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: 'modifiedTime desc',
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  log.info?.('Found files', { count: files.length });
  return files;
}

/**
 * Backward-compatible: list all files (any mime) in folder.
 * Prefer listFolderSpreadsheetsSince for ingestion.
 */
export async function listAllFilesInFolder(drive) {
  if (!CONFIG.folderId) {
    throw new Error('CONFIG.folderId is not set');
  }

  const files = [];
  let pageToken = null;
  const q = `'${CONFIG.folderId}' in parents and trashed=false`;

  do {
    const res = await drive.files.list({
      q,
      spaces: 'drive',
      fields:
        'nextPageToken,files(' +
          'id,name,mimeType,modifiedTime,parents,webViewLink,' +
          'owners(emailAddress,displayName)' +
        ')',
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: 'modifiedTime desc',
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  return files;
}

/**
 * Get spreadsheet metadata (title + sheet list).
 */
export async function getSpreadsheetMeta(sheets, fileId) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    fields:
      'spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
  });
  return res.data;
}

/**
 * Read all tabs from a spreadsheet.
 * Returns [{ sheetTitle, values }]
 */
export async function readGoogleSpreadsheetAllTabs(sheets, fileId) {
  const meta = await getSpreadsheetMeta(sheets, fileId);
  const out = [];

  for (const s of meta.sheets || []) {
    const title = s.properties?.title || 'Sheet1';
    const rows = Math.min(s.properties?.gridProperties?.rowCount || 1000, 50000);
    const cols = Math.min(s.properties?.gridProperties?.columnCount || 26, 200);
    const range = `'${title.replace(/'/g, "''")}'!A1:${toA1(cols)}${rows}`;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range,
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    out.push({ sheetTitle: title, values: res.data.values || [] });
  }

  return out;
}

/**
 * Download any Drive file to a temp path.
 */
export async function downloadFileToTemp(drive, fileId, name) {
  const safe = (name || 'file').replace(/\W+/g, '_');
  const tmpPath = path.join(os.tmpdir(), `drive_${fileId}_${Date.now()}_${safe}`);
  const dest = fs.createWriteStream(tmpPath);

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );

  await new Promise((resolve, reject) => {
   res.data.on('error', reject);
   dest.on('error', reject);
   dest.on('finish', resolve);  // wait for file to be fully written
   res.data.pipe(dest);
 });

  return tmpPath;
}

/** Convert a column number (1-based) to A1 letters. */
function toA1(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
