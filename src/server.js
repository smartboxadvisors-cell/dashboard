/**
 * Unified entrypoint:
 *   MODE=ingest  -> run ingestion once
 *   MODE=api     -> start API server
 *   MODE=both    -> run ingestion then start API
 *
 * Or use npm scripts below (recommended).
 */

import 'dotenv/config';
import { log } from './logger.js';
import { runIngest } from './modules/ingestor.js';
import { startApi } from './modules/apiServer.js';

const MODE = (process.env.MODE || 'ingest').toLowerCase();

async function main() {
  if (MODE === 'ingest') return runIngest();
  if (MODE === 'api')     return startApi();
  if (MODE === 'both')    { await runIngest(); return startApi(); }
  log.info('Set MODE=ingest | api | both');
}
main().catch(err => { log.error(err); process.exit(1); });
