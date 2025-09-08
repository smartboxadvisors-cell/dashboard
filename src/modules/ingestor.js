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

  if (kind === 'gsheet') {
    log.info({ fileName }, 'Reading Google Sheet');
    bundles = await retry(
      CONFIG.retryAttempts,
      CONFIG.retryBaseMs,
      () => readGoogleSpreadsheetAllTabs(sheets, fileId),
      `sheets:${fileId}`,
    );
  } else if (kind === 'excel' || kind === 'csv') {
    log.info({ fileName, kind }, 'Downloading file');
    const tmp = await retry(
      CONFIG.retryAttempts,
      CONFIG.retryBaseMs,
      () => downloadFileToTemp(drive, fileId, fileName),
      `download:${fileId}`,
    );
    try {
      bundles = kind === 'excel' ? parseExcelToSheets(tmp) : parseCsvToSheets(tmp);
    } finally {
      fs.unlink(tmp, () => {});
    }
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
    if (!docs.length) {
      log.info({ fileName, sheet: b.sheetTitle }, 'No data rows');
      continue;
    }

    const res = await bulkWriteInChunks(coll, docs, 1000);
    log.info({ fileName, sheet: b.sheetTitle, rows: docs.length, ...res }, 'Ingested');
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

  const parallel = Math.max(1, CONFIG.maxConcurrentFiles || 3);

  await withMongo(async (coll) => {
    for (let i = 0; i < files.length; i += parallel) {
      await Promise.all(
        files.slice(i, i + parallel).map((f) =>
          processFile(clients, coll, f).catch((err) =>
            log.error({ file: f.name, err: err.message }, 'Failed file'),
          ),
        ),
      );
    }
  });

  log.info('Ingest complete.');
}
