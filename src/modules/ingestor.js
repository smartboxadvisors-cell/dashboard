/**
 * Drive → MongoDB Ingestor (module)
 * - Supports Google Sheets + Excel + CSV
 * - Uses normalizeRows + business-key upserts
 */

import fs from 'fs';
import { CONFIG } from '../config.js';
import { log } from '../logger.js';
import {
  getGoogleClients,
  listAllFilesInFolder,
  readGoogleSpreadsheetAllTabs,
  downloadFileToTemp,
} from '../google.js';
import { detectFileKind, parseExcelToSheets, parseCsvToSheets } from '../parsers.js';
import { normalizeRows } from '../normalizer.js';
import { withMongo, bulkWriteInChunks } from '../mongo.js';

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
      log.warn({ err: e.message, attempt, wait }, `Retrying ${label} in ${wait}ms`);
      await sleep(wait);
    }
  }
}

async function processFile(clients, coll, file) {
  const { drive, sheets } = clients;
  const { id: fileId, name: fileName, mimeType, modifiedTime } = file;

  const kind = detectFileKind(mimeType, fileName);
  let bundles = [];

  try {
    if (kind === 'gsheet') {
      log.info({ fileName }, 'Reading Google Sheet');
      bundles = await readGoogleSpreadsheetAllTabs(sheets, fileId);
    } else if (kind === 'excel' || kind === 'csv') {
      log.info({ fileName, kind }, 'Downloading file');
      const tmp = await downloadFileToTemp(drive, fileId, fileName);
      
      // Process large files chunk by chunk (e.g., by rows or sheets)
      if (kind === 'excel') {
        bundles = parseExcelToSheets(tmp); // Process Excel in chunks/sheets
      } else {
        bundles = parseCsvToSheets(tmp);  // Process CSV in chunks
      }
      
      // Clean up temp file after processing
      fs.unlink(tmp, () => {});
    } else {
      log.info({ fileName, mimeType }, 'Skipping unsupported file');
      return;
    }

    for (const b of bundles) {
      const docs = normalizeRows(b.values, {
        fileId,
        fileName,
        sheetTitle: b.sheetTitle,
        modifiedTime,
      });

      if (docs.length) {
        const res = await bulkWriteInChunks(coll, docs, 1000); // Insert in batches of 1000 rows
        log.info({ fileName, sheet: b.sheetTitle, rows: docs.length, ...res }, 'Ingested');
      } else {
        log.info({ fileName, sheet: b.sheetTitle }, 'No data rows to ingest');
      }
    }
  } catch (error) {
    log.error({ fileName, error: error.message }, 'Error processing file');
    return;  // Skip to the next file if there is an issue
  }
}

export async function runIngest() {
  const clients = await getGoogleClients();
  const files = await listAllFilesInFolder(clients.drive);
  if (!files.length) {
    log.warn('Folder is empty or inaccessible');
    return;
  }
  log.info({ count: files.length }, 'Found files');

  const batchSize = CONFIG.batchSize || 10;  // Process files in batches of batchSize
  const parallel = Math.max(1, CONFIG.maxConcurrentFiles || 3); // Control parallelism

  await withMongo(async (coll) => {
    for (let i = 0; i < files.length; i += batchSize) {
      const filesBatch = files.slice(i, i + batchSize);
      await Promise.all(
        filesBatch.map((f) =>
          processFile(clients, coll, f).catch((err) =>
            log.error({ file: f.name, err: err.message }, 'Failed file'),
          ),
        ),
      );
    }
  });

  log.info('Ingest complete.');
}

