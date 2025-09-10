// /**
//  * Unified entrypoint:
//  *   MODE=ingest  -> run ingestion once
//  *   MODE=api     -> start API server
//  *   MODE=both    -> run ingestion then start API
//  *
//  * Or use npm scripts below (recommended).
//  */

// import 'dotenv/config';
// import { log } from './logger.js';
// import { runIngest } from './modules/ingestor.js';
// import { startApi } from './modules/apiServer.js';
// import express  from 'express'
// import { connectToMongo, fetchDataFromMongo } from '../api/query.js';
// import cors from 'cors'

// const app = express()
// const PORT = 3000;

// connectToMongo();

// app.use(cors())

// const MODE = (process.env.MODE || 'ingest').toLowerCase();

// async function main() {
//   if (MODE === 'ingest') {
//     // Run the ingestion process and allow the script to finish
//     await runIngest();
//     return;
//   }

//   if (MODE === 'api') {
//     // Start the API server
//     return startApi();
//   }

//   if (MODE === 'both') {
//     // Run ingestion and start API concurrently
//     await runIngest(); // Ensure ingestion runs asynchronously
//     startApi(); // Start API server after ingestion completes
//     return;
//   }

//   log.info('Set MODE=ingest | api | both');
// }

// // Run the main function with proper error handling
// main().catch(err => { 
//   log.error(err); 
//   process.exit(1); 
// });

// app.get('/', (req, res) => {
//   res.json({
//     message:'ok'

//   })
// })

// app.get('/health', (req, res) => {
//   res.json({ status: 'API is running' });
// });

// // API route to fetch data from MongoDB
// app.get('/data', async (req, res) => {
//   const limit = parseInt(req.query.limit) || 50; // Default to 50 records if no limit is provided
//   const skip = parseInt(req.query.skip) || 0;   // Default to skip 0 records if no skip is provided
//   try {
//     const data = await fetchDataFromMongo('drive_imports', limit, skip);  // Replace with your collection name
//     res.json({
//       total: data.length,
//       data
//     });  // Return data as JSON
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).json({ error: 'Failed to fetch data from MongoDB' });
//   }
// });

// // Start the API server
// app.listen(PORT, () => {
//   console.log(`Server is running on http://localhost:${PORT}`);
// });
/**
 * Unified entrypoint:
 *   MODE=ingest  -> run ingestion once
 *   MODE=api     -> start API server
 *   MODE=both    -> run ingestion then start API
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { log } from './logger.js';
import { runIngest } from './modules/ingestor.js';
import { connectToMongo, fetchDataFromMongo } from '../api/query.js';
// import dataRouter from './routes/data.js';

const app = express();

// ---- middleware
app.use(cors());
app.use(express.json());
app.use(helmet({
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
}));
// app.use(dataRouter);

// ---- helpers
const parseIntSafe = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const MODE = (process.env.MODE || 'api').toLowerCase(); // default to 'api'

// ---- health
app.get('/', (_req, res) => res.json({ message: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'API is running' }));

// ---- data route
// ---- data route
app.get('/data', async (req, res) => {
  // allow either skip/limit or page/limit
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const parsedSkip  = Number.parseInt(req.query.skip, 10);
  const parsedPage  = Number.parseInt(req.query.page, 10);

  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 500)) : 100; // cap to 500
  let skip   = Number.isFinite(parsedSkip) ? Math.max(0, parsedSkip) : 0;

  if (Number.isFinite(parsedPage) && parsedPage > 0) {
    skip = (parsedPage - 1) * limit;
  }

  try {
    const { data, totalCount } = await fetchDataFromMongo(
      process.env.MONGO_COLLECTION || 'drive_imports',
      limit,
      skip,
      req.query // pass filters/sort
    );

    // include both totalCount and total for frontend compatibility
    return res.json({
      data,
      totalCount,
      total: totalCount,
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : Math.floor(skip / limit) + 1,
      pageSize: limit,
    });
  } catch (err) {
    console.error('Error fetching data:', err);
    return res.status(500).json({ error: 'Failed to fetch data from MongoDB' });
  }
});


// ---- bootstrap
async function main() {
  if (MODE === 'ingest') {
    await connectToMongo();       // in case your ingestor needs DB
    await runIngest();
    return;                       // exit after single run
  }

  if (MODE === 'both') {
    await connectToMongo();
    await runIngest();            // finish ingest first, then start API
  } else if (MODE === 'api') {
    await connectToMongo();
  } else {
    log.info('Set MODE=ingest | api | both');
    process.exit(1);
  }

  app.listen(PORT, () => {
    log.info(`API listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  log.error(err);
  process.exit(1);
});