// import 'dotenv/config';

// export const CONFIG = {
//   folderId: process.env.FOLDER_ID,
//   keyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service-account.json',
//   mongoUri: process.env.MONGO_URI,
//   dbName: process.env.MONGO_DB || 'mutualfunds',
//   collName: process.env.MONGO_COLLECTION || 'drive_imports',
//   insertOnly: String(process.env.INSERT_ONLY || 'false').toLowerCase() === 'true',

//   maxConcurrentFiles: Number(process.env.MAX_CONCURRENT_FILES || 3),
//   batchSize: Number(process.env.BATCH_SIZE || 10), // Added batch size configuration
//   retryAttempts: Number(process.env.RETRY_ATTEMPTS || 3),
//   retryBaseMs: Number(process.env.RETRY_BASE_MS || 400),

//   scopes: [
//     'https://www.googleapis.com/auth/drive.readonly',
//     'https://www.googleapis.com/auth/spreadsheets.readonly',
//   ],
// };

// // Ensure required environment variables are present
// for (const [k, v] of Object.entries({
//   FOLDER_ID: CONFIG.folderId,
//   GOOGLE_SERVICE_ACCOUNT_KEY: CONFIG.keyPath,
//   MONGO_URI: CONFIG.mongoUri,
// })) {
//   if (!v) throw new Error(`Missing required env: ${k}`);
// }

// src/config.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

function unquote(s = '') {
  // handle Windows-style quoted paths in .env
  return typeof s === 'string' ? s.replace(/^"(.*)"$/, '$1') : s;
}

function resolveKeyPath(p) {
  const cleaned = unquote(p || './service-account.json');
  if (cleaned.startsWith('~')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', cleaned.slice(1));
  }
  return cleaned;
}

export const CONFIG = {
  // Google Drive / Sheets
  folderId: process.env.FOLDER_ID,
  keyPath: resolveKeyPath(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service-account.json'),
  serviceAccountMail: process.env.SERVICE_ACCOUNT_MAIL || undefined, // optional
  delegatedUser: process.env.DELEGATED_USER || undefined,           // optional (for domain-wide delegation)
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],

  // Mongo
  mongoUri: process.env.MONGO_URI,
  dbName: process.env.MONGO_DB || 'mutualfunds',
  collName: process.env.MONGO_COLLECTION || 'drive_imports',
  insertOnly: String(process.env.INSERT_ONLY || 'false').toLowerCase() === 'true',

  // Ingestion / concurrency / polling
  maxConcurrentFiles: Number(process.env.MAX_CONCURRENT_FILES || 3),
  batchSize: Number(process.env.BATCH_SIZE || 10),
  retryAttempts: Number(process.env.RETRY_ATTEMPTS || 3),
  retryBaseMs: Number(process.env.RETRY_BASE_MS || 400),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 10 * 60 * 1000), // default 10 minutes
  // optional: persist cursor between restarts (file path). Leave undefined to keep in-memory.
  cursorFile: unquote(process.env.INGEST_CURSOR_FILE || '' ) || undefined,

  // API server
  port: Number(process.env.PORT || 3000),
};

// Required envs sanity-check
for (const [k, v] of Object.entries({
  FOLDER_ID: CONFIG.folderId,
  GOOGLE_SERVICE_ACCOUNT_KEY: CONFIG.keyPath,
  MONGO_URI: CONFIG.mongoUri,
})) {
  if (!v) throw new Error(`Missing required env: ${k}`);
}

// Helpful early warning if key file is missing (won’t throw here to allow tests to run)
// The actual auth path check still happens in google client builder.
try {
  if (!fs.existsSync(CONFIG.keyPath)) {
    console.warn(`[config] Warning: service account key not found at ${CONFIG.keyPath}`);
  }
} catch {
  // ignore fs permission issues here; handled later during auth
}
