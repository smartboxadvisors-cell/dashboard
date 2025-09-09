import 'dotenv/config';

export const CONFIG = {
  folderId: process.env.FOLDER_ID,
  keyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || './service-account.json',
  mongoUri: process.env.MONGO_URI,
  dbName: process.env.MONGO_DB || 'mutualfunds',
  collName: process.env.MONGO_COLLECTION || 'drive_imports',
  insertOnly: String(process.env.INSERT_ONLY || 'false').toLowerCase() === 'true',

  maxConcurrentFiles: Number(process.env.MAX_CONCURRENT_FILES || 3),
  batchSize: Number(process.env.BATCH_SIZE || 10), // Added batch size configuration
  retryAttempts: Number(process.env.RETRY_ATTEMPTS || 3),
  retryBaseMs: Number(process.env.RETRY_BASE_MS || 400),

  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
};

// Ensure required environment variables are present
for (const [k, v] of Object.entries({
  FOLDER_ID: CONFIG.folderId,
  GOOGLE_SERVICE_ACCOUNT_KEY: CONFIG.keyPath,
  MONGO_URI: CONFIG.mongoUri,
})) {
  if (!v) throw new Error(`Missing required env: ${k}`);
}

