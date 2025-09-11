// /**
//  * Unified entrypoint:
//  *   MODE=ingest  -> run ingestion once
//  *   MODE=api     -> start API server
//  *   MODE=both    -> run ingestion then start API
//  */

// import 'dotenv/config';
// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';

// import { log } from './logger.js';
// import { runIngest } from './modules/ingestor.js';
// import { connectToMongo, fetchDataFromMongo } from '../api/query.js';

// const app = express();

// // ---- middleware
// app.use(cors());
// app.use(express.json());
// app.use(helmet({
//   contentSecurityPolicy: {
//     useDefaults: true,
//     directives: {
//       defaultSrc: ["'self'"],
//       connectSrc: ["'self'", "http://localhost:3000", "ws://localhost:3000", "ws://localhost:5173"],
//       imgSrc: ["'self'", "data:", "blob:"],
//       scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // relax for dev; tighten in prod
//       styleSrc: ["'self'", "'unsafe-inline'"],
//       fontSrc: ["'self'", "data:"],
//       frameAncestors: ["'self'"],
//     },
//   },
// }));

// // ---- helpers
// const parseIntSafe = (v, def) => {
//   const n = Number.parseInt(v, 10);
//   return Number.isFinite(n) ? n : def;
// };

// const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
// const MODE = (process.env.MODE || 'api').toLowerCase(); // default to 'api'

// // ---- health
// app.get('/', (_req, res) => res.json({ message: 'ok' }));
// app.get('/health', (_req, res) => res.json({ status: 'API is running' }));

// // ---- data route
// // app.get('/data', async (req, res) => {
// //   // allow either skip/limit or page/limit
// //   const parsedLimit = Number.parseInt(req.query.limit, 10);
// //   const parsedSkip  = Number.parseInt(req.query.skip, 10);
// //   const parsedPage  = Number.parseInt(req.query.page, 10);

// //   const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 500)) : 100; // cap to 500
// //   let skip   = Number.isFinite(parsedSkip) ? Math.max(0, parsedSkip) : 0;

// //   if (Number.isFinite(parsedPage) && parsedPage > 0) {
// //     skip = (parsedPage - 1) * limit;
// //   }

// //   try {
// //     const { data, totalCount } = await fetchDataFromMongo(
// //       process.env.MONGO_COLLECTION || 'drive_imports',
// //       limit,
// //       skip,
// //       req.query // pass filters/sort
// //     );

// //     // include both totalCount and total for frontend compatibility
// //     return res.json({
// //       data,
// //       totalCount,
// //       total: totalCount,
// //       page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : Math.floor(skip / limit) + 1,
// //       pageSize: limit,
// //     });
// //   } catch (err) {
// //     console.error('Error fetching data:', err);
// //     return res.status(500).json({ error: 'Failed to fetch data from MongoDB' });
// //   }
// // });
// app.get('/data', async (req, res) => {
//   const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 100, 500));
//   const page  = Math.max(1, parseInt(req.query.page) || 1);
//   const skip  = (page - 1) * limit;

//   try {
//     const { data, totalCount } = await fetchDataFromMongo(
//       process.env.MONGO_COLLECTION || 'drive_imports',
//       limit,
//       skip,
//       req.query
//     );

//     res.json({
//       data,
//       totalCount,
//       page,
//       pageSize: limit,
//       totalPages: Math.ceil(totalCount / limit),
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch data' });
//   }
// });



// // ---- bootstrap
// async function main() {
//   if (MODE === 'ingest') {
//     await connectToMongo();       // in case your ingestor needs DB
//     await runIngest();
//     return;                       // exit after single run
//   }

//   if (MODE === 'both') {
//     await connectToMongo();
//     await runIngest();            // finish ingest first, then start API
//   } else if (MODE === 'api') {
//     await connectToMongo();
//   } else {
//     log.info('Set MODE=ingest | api | both');
//     process.exit(1);
//   }

//   app.listen(PORT, () => {
//     log.info(`API listening on http://localhost:${PORT}`);
//   });
// }

// main().catch(err => {
//   log.error(err);
//   process.exit(1);
// });

// src/server.js
/**
 * Unified entrypoint:
 *   MODE=ingest  -> run ingestion once
 *   MODE=api     -> start API server (with auto-polling)
 *   MODE=both    -> run ingestion once, then start API (with auto-polling)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { CONFIG } from './config.js';
import { log, childLogger } from './logger.js';
import { runIngest } from './modules/ingestor.js';

// If you're still using ../api/query.js, keep these:
import { connectToMongo, fetchDataFromMongo } from '../api/query.js';

const app = express();
const logSrv = childLogger('server');

// ---- middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "http://localhost:3000", "ws://localhost:3000", "ws://localhost:5173"],
        imgSrc: ["'self'", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // relax for dev; tighten in prod
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

// ---- helpers
const PORT = CONFIG.port;
const MODE = (process.env.MODE || 'api').toLowerCase(); // default to 'api'

// --- cursor persistence (optional via CONFIG.cursorFile) ---
function loadCursor() {
  if (!CONFIG.cursorFile) return null;
  try {
    const p = path.resolve(CONFIG.cursorFile);
    if (!fs.existsSync(p)) return null;
    const v = fs.readFileSync(p, 'utf8').trim();
    return v || null;
  } catch {
    return null;
  }
}
function saveCursor(iso) {
  if (!CONFIG.cursorFile || !iso) return;
  try {
    const p = path.resolve(CONFIG.cursorFile);
    fs.writeFileSync(p, iso, 'utf8');
  } catch (e) {
    logSrv.warn({ err: e?.message }, 'Failed to persist cursor');
  }
}

// ---- health
app.get('/', (_req, res) => res.json({ message: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'API is running' }));

// ---- data route (kept as in your current code)
app.get('/data', async (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 100, 500));
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const skip  = (page - 1) * limit;

  try {
    const { data, totalCount } = await fetchDataFromMongo(
      process.env.MONGO_COLLECTION || 'drive_imports',
      limit,
      skip,
      req.query
    );

    res.json({
      data,
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    logSrv.error({ err: err?.message }, 'Failed to fetch data');
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// ---- manual ingest trigger
// POST /ingest/run  body: { since?: "2025-09-01T00:00:00Z", onlyFileIds?: ["...","..."] }
app.post('/ingest/run', async (req, res) => {
  try {
    const { since, onlyFileIds } = req.body || {};
    const result = await runIngest({ sinceIso: since || null, onlyFileIds });
    // Advance cursor on success
    const nowIso = new Date().toISOString();
    saveCursor(nowIso);
    res.json({ ok: true, ...result, cursor: nowIso });
  } catch (e) {
    logSrv.error({ err: e?.message }, 'Manual ingest failed');
    res.status(500).json({ ok: false, error: e?.message });
  }
});

// ---- auto-polling for new/updated files
let lastCheckIso = loadCursor(); // restore persisted cursor if available
async function poll() {
  try {
    const result = await runIngest({ sinceIso: lastCheckIso || null });
    const nowIso = new Date().toISOString();
    // advance cursor only after a successful run
    lastCheckIso = nowIso;
    saveCursor(nowIso);

    logSrv.info({ result, lastCheckIso }, 'Poll cycle complete');
  } catch (e) {
    // keep lastCheckIso unchanged on error
    logSrv.error({ err: e?.message }, 'Poll cycle failed');
  }
}

// ---- bootstrap
async function main() {
  if (MODE === 'ingest') {
    await connectToMongo(); // if your ingestor needs DB init from this module
    const result = await runIngest();
    logSrv.info({ result }, 'One-off ingest complete');
    return; // exit after single run
  }

  if (MODE === 'both') {
    await connectToMongo();
    const result = await runIngest(); // finish ingest first, then start API
    logSrv.info({ result }, 'Initial ingest complete, starting API...');
  } else if (MODE === 'api') {
    await connectToMongo();
  } else {
    logSrv.info('Set MODE=ingest | api | both');
    process.exit(1);
  }

  // Start API
  app.listen(PORT, () => {
    logSrv.info(`API listening on http://localhost:${PORT}`);
  });

  // Start polling loop (api & both modes)
  setTimeout(poll, 0); // initial kick
  setInterval(poll, CONFIG.pollIntervalMs); // default 10 minutes
}

main().catch((err) => {
  logSrv.error({ err: err?.message, stack: err?.stack }, 'Fatal error');
  process.exit(1);
});
