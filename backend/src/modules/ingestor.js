// /**
//  * Drive → MongoDB Ingestor (module)
//  * - Supports Google Sheets + Excel + CSV
//  * - Uses normalizeRows + business-key upserts
//  */

// import fs from 'fs';
// import { CONFIG } from '../config.js';
// import { log } from '../logger.js';
// import {
//   getGoogleClients,
//   listAllFilesInFolder,
//   readGoogleSpreadsheetAllTabs,
//   downloadFileToTemp,
// } from '../google.js';
// import { detectFileKind, parseExcelToSheets, parseCsvToSheets } from '../parsers.js';
// import { normalizeRows } from '../normalizer.js';
// import { withMongo, bulkWriteInChunks } from '../mongo.js';

// const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// async function retry(attempts, baseMs, fn, label) {
//   let attempt = 0;
//   const max = Math.max(1, attempts || 1);
//   while (true) {
//     try {
//       return await fn();
//     } catch (e) {
//       attempt++;
//       if (attempt >= max) throw e;
//       const wait = (baseMs || 400) * Math.pow(2, attempt - 1);
//       log.warn({ err: e.message, attempt, wait }, `Retrying ${label} in ${wait}ms`);
//       await sleep(wait);
//     }
//   }
// }

// async function processFile(clients, coll, file) {
//   const { drive, sheets } = clients;
//   const { id: fileId, name: fileName, mimeType, modifiedTime } = file;

//   const kind = detectFileKind(mimeType, fileName);
//   let bundles = [];

//   try {
//     if (kind === 'gsheet') {
//       log.info({ fileName }, 'Reading Google Sheet');
//       bundles = await readGoogleSpreadsheetAllTabs(sheets, fileId);
//     } else if (kind === 'excel' || kind === 'csv') {
//       log.info({ fileName, kind }, 'Downloading file');
//       const tmp = await downloadFileToTemp(drive, fileId, fileName);
      
//       // Process large files chunk by chunk (e.g., by rows or sheets)
//       if (kind === 'excel') {
//         bundles = parseExcelToSheets(tmp); // Process Excel in chunks/sheets
//       } else {
//         bundles = parseCsvToSheets(tmp);  // Process CSV in chunks
//       }
      
//       // Clean up temp file after processing
//       fs.unlink(tmp, () => {});
//     } else {
//       log.info({ fileName, mimeType }, 'Skipping unsupported file');
//       return;
//     }

//     for (const b of bundles) {
//       const docs = normalizeRows(b.values, {
//         fileId,
//         fileName,
//         sheetTitle: b.sheetTitle,
//         modifiedTime,
//       });

//       if (docs.length) {
//         const res = await bulkWriteInChunks(coll, docs, 1000); // Insert in batches of 1000 rows
//         log.info({ fileName, sheet: b.sheetTitle, rows: docs.length, ...res }, 'Ingested');
//       } else {
//         log.info({ fileName, sheet: b.sheetTitle }, 'No data rows to ingest');
//       }
//     }
//   } catch (error) {
//     log.error({ fileName, error: error.message }, 'Error processing file');
//     return;  // Skip to the next file if there is an issue
//   }
// }

// export async function runIngest() {
//   const clients = await getGoogleClients();
//   const files = await listAllFilesInFolder(clients.drive);
//   if (!files.length) {
//     log.warn('Folder is empty or inaccessible');
//     return;
//   }
//   log.info({ count: files.length }, 'Found files');

//   const batchSize = CONFIG.batchSize || 10;  // Process files in batches of batchSize
//   const parallel = Math.max(1, CONFIG.maxConcurrentFiles || 3); // Control parallelism

//   await withMongo(async (coll) => {
//     for (let i = 0; i < files.length; i += batchSize) {
//       const filesBatch = files.slice(i, i + batchSize);
//       await Promise.all(
//         filesBatch.map((f) =>
//           processFile(clients, coll, f).catch((err) =>
//             log.error({ file: f.name, err: err.message }, 'Failed file'),
//           ),
//         ),
//       );
//     }
//   });

//   log.info('Ingest complete.');
// }


// src/modules/ingestor.js
/**
 * Drive → MongoDB Ingestor (module)
 * - Google Sheets + Excel + CSV
 * - Reads ALL tabs per file
 * - Robust Scheme Name / Report Date handled by normalizer.js
 * - Upserts using business keys (see mongo.js)
 */

// import fs from 'fs';
// import pLimit from 'p-limit';
// import { CONFIG } from '../config.js';
// import { log, childLogger } from '../logger.js';
// import {
//   getGoogleClients,
//   listFolderSpreadsheetsSince,
//   listAllFilesInFolder,          // kept for fallback / manual runs
//   readGoogleSpreadsheetAllTabs,
//   downloadFileToTemp,
// } from '../google.js';
// import {
//   detectFileKind,
//   parseExcelToSheets,
//   parseCsvToSheets,
// } from '../parsers.js';           // keep this path as in your project
// import { normalizeRows } from '../normalizer.js';
// import { withMongo, bulkWriteInChunks } from '../mongo.js';

// const logIngest = childLogger('ingestor');

// const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// async function retry(attempts, baseMs, fn, label) {
//   let attempt = 0;
//   const max = Math.max(1, attempts || 1);
//   while (true) {
//     try {
//       return await fn();
//     } catch (e) {
//       attempt++;
//       if (attempt >= max) throw e;
//       const wait = (baseMs || 400) * Math.pow(2, attempt - 1);
//       logIngest.warn({ err: e.message, attempt, wait, label }, `Retrying ${label} in ${wait}ms`);
//       await sleep(wait);
//     }
//   }
// }

// async function processFile(clients, coll, file) {
//   const { drive, sheets } = clients;
//   const { id: fileId, name: fileName, mimeType, modifiedTime } = file;

//   const kind = detectFileKind(mimeType, fileName);
//   let bundles = [];
//   let tmp = null;

//   try {
//     if (kind === 'gsheet') {
//       logIngest.info({ fileName, fileId }, 'Reading Google Sheet');
//       bundles = await retry(
//         CONFIG.retryAttempts,
//         CONFIG.retryBaseMs,
//         () => readGoogleSpreadsheetAllTabs(sheets, fileId),
//         `readGoogleSpreadsheetAllTabs(${fileName})`
//       );
//     } else if (kind === 'excel' || kind === 'csv') {
//       logIngest.info({ fileName, kind }, 'Downloading Drive file');
//       tmp = await retry(
//         CONFIG.retryAttempts,
//         CONFIG.retryBaseMs,
//         () => downloadFileToTemp(drive, fileId, fileName),
//         `downloadFileToTemp(${fileName})`
//       );

//       // Parse locally
//       if (kind === 'excel') {
//         bundles = parseExcelToSheets(tmp);
//       } else {
//         bundles = parseCsvToSheets(tmp);
//       }
//     } else {
//       logIngest.info({ fileName, mimeType }, 'Skipping unsupported file');
//       return { rows: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };
//     }

//     let agg = { rows: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };

//     for (const b of bundles) {
//       const docs = normalizeRows(b.values, {
//         fileId,
//         fileName,
//         sheetTitle: b.sheetTitle,
//         modifiedTime,
//       });

//       if (docs.length) {
//         const res = await bulkWriteInChunks(coll, docs, 1000);
//         logIngest.info(
//           { fileName, sheet: b.sheetTitle, rows: docs.length, ...res },
//           'Ingested sheet'
//         );
//         agg.rows += docs.length;
//         agg.inserted += res.inserted || 0;
//         agg.upserts  += res.upserts  || 0;
//         agg.modified += res.modified || 0;
//         agg.matched  += res.matched  || 0;
//         agg.failures += res.failures || 0;
//       } else {
//         logIngest.debug({ fileName, sheet: b.sheetTitle }, 'No data rows to ingest');
//       }
//     }

//     return agg;
//   } catch (error) {
//     logIngest.error({ fileName, error: error.message }, 'Error processing file');
//     return { rows: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };
//   } finally {
//     if (tmp) {
//       fs.unlink(tmp, () => {});
//     }
//   }
// }

// /**
//  * Run ingestion.
//  * @param {Object} opts
//  * @param {string|null} opts.sinceIso  Only process files with modifiedTime > sinceIso (RFC3339)
//  * @param {Array<string>} [opts.onlyFileIds] Optional: process only these Drive file IDs
//  * @returns {{ processed: number, files: number, inserted: number, upserts: number, modified: number, matched: number, failures: number, message: string }}
//  */
// export async function runIngest({ sinceIso = null, onlyFileIds = null } = {}) {
//   const clients = await getGoogleClients();

//   // Prefer Sheets in folder; fall back to all files if needed
//   let files;
//   if (onlyFileIds && onlyFileIds.length) {
//     // Get minimal file objects
//     const all = await listAllFilesInFolder(clients.drive);
//     const set = new Set(onlyFileIds);
//     files = all.filter(f => set.has(f.id));
//   } else {
//     files = await listFolderSpreadsheetsSince(clients.drive, sinceIso);
//   }

//   if (!files.length) {
//     logIngest.warn('No new/updated files found (or folder inaccessible)');
//     return {
//       processed: 0, files: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0,
//       message: 'No files to process',
//     };
//   }

//   logIngest.info({ count: files.length, sinceIso }, 'Found files to ingest');

//   const parallel = Math.max(1, CONFIG.maxConcurrentFiles || 3);
//   const limit = pLimit(parallel);

//   let totals = { processed: 0, files: files.length, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };

//   await withMongo(async (coll) => {
//     await Promise.all(
//       files.map((f) =>
//         limit(async () => {
//           try {
//             const res = await processFile(clients, coll, f);
//             totals.processed += res.rows || 0;
//             totals.inserted  += res.inserted || 0;
//             totals.upserts   += res.upserts  || 0;
//             totals.modified  += res.modified || 0;
//             totals.matched   += res.matched  || 0;
//             totals.failures  += res.failures || 0;
//           } catch (err) {
//             logIngest.error({ file: f.name, err: err.message }, 'Failed file');
//           }
//         })
//       )
//     );
//   });

//   const message = `Processed ${totals.processed} rows from ${totals.files} file(s)`;
//   logIngest.info({ ...totals }, message);
//   return { ...totals, message };
// }

// src/modules/ingestor.js
/**
 * Drive → MongoDB Ingestor (module)
 * - Google Sheets + Excel + CSV
 * - Reads ALL tabs per file
 * - Robust Scheme Name / Report Date handled by normalizer.js
 * - Upserts using business keys (see mongo.js)
 */

import fs from 'fs';
import { CONFIG } from '../config.js';
import { log, childLogger } from '../logger.js';
import {
  getGoogleClients,
  listSpreadsheetsRecursive,
  listAllFilesInFolder,
  readGoogleSpreadsheetAllTabs,
  downloadFileToTemp,
} from '../google.js';
import { detectFileKind, parseExcelToSheets, parseCsvToSheets } from '../parser.js';
import { normalizeRows } from '../normalizer.js';
import { withMongo, bulkWriteInChunks } from '../mongo.js';
import { sanitizeForMongo } from '../util/sanitize.js';


const logIngest = childLogger('ingestor');

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function retry(attempts, baseMs, fn, label) {
  let attempt = 0;
  const max = Math.max(1, attempts || 1);
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt >= max) throw e;
      const wait = (baseMs || 400) * Math.pow(2, attempt - 1);
      logIngest.warn({ err: e.message, attempt, wait, label }, `Retrying ${label} in ${wait}ms`);
      await sleep(wait);
    }
  }
}

// --- simple concurrency limiter (like p-limit) ---
function createLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (queue.length && active < concurrency) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve).catch(reject).finally(() => {
        active--;
        next();
      });
    }
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

async function processFile(clients, coll, file) {
  const { drive, sheets } = clients;
  const { id: fileId, name: fileName, mimeType, modifiedTime } = file;

  const kind = detectFileKind(mimeType, fileName);
  let bundles = [];
  let tmp = null;

  try {
    if (kind === 'gsheet') {
      logIngest.info({ fileName, fileId }, 'Reading Google Sheet');
      bundles = await retry(
        CONFIG.retryAttempts,
        CONFIG.retryBaseMs,
        () => readGoogleSpreadsheetAllTabs(sheets, fileId),
        `readGoogleSpreadsheetAllTabs(${fileName})`
      );
    } else if (kind === 'excel' || kind === 'csv') {
      logIngest.info({ fileName, kind }, 'Downloading Drive file');
      tmp = await retry(
        CONFIG.retryAttempts,
        CONFIG.retryBaseMs,
        () => downloadFileToTemp(drive, fileId, fileName),
        `downloadFileToTemp(${fileName})`
      );

      if (kind === 'excel') {
        bundles = parseExcelToSheets(tmp);
        if (!bundles.length) {
          // quick retry on possible partial file
          logIngest.warn({ fileName }, 'Excel parse returned empty, retrying download once');
          tmp && fs.unlink(tmp, () => {});
          tmp = await retry(CONFIG.retryAttempts, CONFIG.retryBaseMs,
            () => downloadFileToTemp(drive, fileId, fileName),
            `reDownloadFileToTemp(${fileName})`
          );
          bundles = parseExcelToSheets(tmp);
        }
      } else {
        bundles = parseCsvToSheets(tmp);
      }
    } else {
      logIngest.info({ fileName, mimeType }, 'Skipping unsupported file');
      return { rows: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };
    }

    let agg = { rows: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };

    for (const b of bundles) {
      let docs = normalizeRows(b.values, {
        fileId,
        fileName,
        sheetTitle: b.sheetTitle,
        modifiedTime,
      });

      // Prevent Mongo path conflicts by merging dotted keys into nested objects
      docs = docs.map(sanitizeForMongo);
      
      if (docs.length) {
        const res = await bulkWriteInChunks(coll, docs, 1000);
        logIngest.info(
          { fileName, sheet: b.sheetTitle, rows: docs.length, ...res },
          'Ingested sheet'
        );
        agg.rows += docs.length;
        agg.inserted += res.inserted || 0;
        agg.upserts  += res.upserts  || 0;
        agg.modified += res.modified || 0;
        agg.matched  += res.matched  || 0;
        agg.failures += res.failures || 0;
      } else {
        logIngest.debug({ fileName, sheet: b.sheetTitle }, 'No data rows to ingest');
      }
    }

    return agg;
  } catch (error) {
    logIngest.error({ fileName, error: error.message }, 'Error processing file');
    return { rows: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };
  } finally {
    if (tmp) fs.unlink(tmp, () => {});
  }
}

/**
 * Run ingestion.
 * @param {Object} opts
 * @param {string|null} opts.sinceIso  Only process files with modifiedTime > sinceIso (RFC3339)
 * @param {Array<string>} [opts.onlyFileIds] Optional: process only these Drive file IDs
 */
export async function runIngest({ sinceIso = null, onlyFileIds = null } = {}) {
  const clients = await getGoogleClients();

  let files;
  if (onlyFileIds && onlyFileIds.length) {
    const all = await listAllFilesInFolder(clients.drive);
    const set = new Set(onlyFileIds);
    files = all.filter((f) => set.has(f.id));
  } else {
    files = await listSpreadsheetsRecursive(clients.drive, CONFIG.folderId, sinceIso);
  }

  if (files.length) {
    logIngest.info(
      { count: files.length, sample: files.slice(0, 3).map(f => ({ n: f.name, m: f.mimeType })) },
      'Files discovered for ingest'
    );
  }

  if (!files.length) {
    logIngest.warn('No new/updated files found (or folder inaccessible)');
    return {
      processed: 0, files: 0, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0,
      message: 'No files to process',
    };
  }

  logIngest.info({ count: files.length, sinceIso }, 'Found files to ingest');

  const parallel = Math.max(1, CONFIG.maxConcurrentFiles || 3);
  const limit = createLimit(parallel);

  let totals = { processed: 0, files: files.length, inserted: 0, upserts: 0, modified: 0, matched: 0, failures: 0 };

  await withMongo(async (coll) => {
    await Promise.all(
      files.map((f) =>
        limit(async () => {
          try {
            const res = await processFile(clients, coll, f);
            totals.processed += res.rows || 0;
            totals.inserted  += res.inserted || 0;
            totals.upserts   += res.upserts  || 0;
            totals.modified  += res.modified || 0;
            totals.matched   += res.matched  || 0;
            totals.failures  += res.failures || 0;
          } catch (err) {
            logIngest.error({ file: f.name, err: err.message }, 'Failed file');
          }
        })
      )
    );
  });

  const message = `Processed ${totals.processed} rows from ${totals.files} file(s)`;
  logIngest.info({ ...totals }, message);
  return { ...totals, message };
}
