// /**
//  * Minimal Express API to query the ingested data
//  */

// import express from 'express';
// import { MongoClient } from 'mongodb';
// import { CONFIG } from '../config.js';
// import { log } from '../logger.js';

// export async function startApi({ port = Number(process.env.PORT || 3000) } = {}) {
//   const app = express();
//   app.use(express.json());

//   const client = new MongoClient(CONFIG.mongoUri);
//   await client.connect();
//   const coll = client.db(CONFIG.dbName).collection(CONFIG.collName);
//   log.info({ uri: CONFIG.mongoUri, db: CONFIG.dbName, coll: CONFIG.collName }, 'API connected to MongoDB');

//   app.get('/health', (_req, res) => res.json({ ok: true }));

//   /**
//    * GET /
//    * Query params (optional):
//    *   _rowIndex, isin, scheme_name, report_date, _fileId, _sheetTitle
//    *   limit (default 50, max 500), page (default 1), sort (e.g., "-_modifiedTime,isin")
//    */
//   app.get('/', async (req, res) => {
//     try {
//       const {
//         _rowIndex,
//         isin,
//         scheme_name,
//         report_date,
//         _fileId,
//         _sheetTitle,
//         limit = '50',
//         page = '1',
//         sort = '-_modifiedTime',
//       } = req.query;

//       const q = {};
//       if (_rowIndex !== undefined) q._rowIndex = Number(_rowIndex);
//       if (isin) q.isin = String(isin);
//       if (scheme_name) q.scheme_name = String(scheme_name);
//       if (report_date) q.report_date = String(report_date);
//       if (_fileId) q._fileId = String(_fileId);
//       if (_sheetTitle) q._sheetTitle = String(_sheetTitle);

//       const sortSpec = {};
//       String(sort)
//         .split(',')
//         .map((s) => s.trim())
//         .filter(Boolean)
//         .forEach((token) => {
//           if (token.startsWith('-')) sortSpec[token.slice(1)] = -1;
//           else sortSpec[token] = 1;
//         });

//       const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
//       const pg = Math.max(Number(page) || 1, 1);
//       const skip = (pg - 1) * lim;

//       const cursor = coll.find(q).sort(sortSpec).skip(skip).limit(lim);
//       const [items, total] = await Promise.all([cursor.toArray(), coll.countDocuments(q)]);

//       res.json({ ok: true, query: q, page: pg, limit: lim, total, items });
//     } catch (err) {
//       log.error({ err: err.message }, 'API error');
//       res.status(500).json({ ok: false, error: err.message });
//     }
//   });

//   app.listen(port, () => log.info(`API listening on http://localhost:${port}`));
//   return app;
// }

// src/modules/apiServer.js
/**
 * Minimal Express API to query the ingested data (enhanced)
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { CONFIG } from '../config.js';
import { log, childLogger } from '../logger.js';
import { getCollection } from '../mongo.js';

const logApi = childLogger('api');

export async function startApi({ port = CONFIG.port } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(compression());

  const coll = await getCollection();
  logApi.info({ db: CONFIG.dbName, coll: CONFIG.collName }, 'API connected to MongoDB');

  app.get('/health', (_req, res) => res.json({ ok: true }));

  /**
   * GET /
   * Query params:
   *   search           -> free text across instrument_name, isin
   *   scheme_name      -> exact or regex (use scheme_name_regex=true to treat as regex)
   *   issuer           -> exact or regex (?issuer_regex=true)
   *   isin             -> exact match or CSV ("IN00...,IN00...")
   *   _fileId, _sheetTitle -> exact match
   *   report_date      -> exact date (YYYY-MM-DD)
   *   date_from/date_to-> range on report_date_iso (YYYY-MM-DD)
   *   limit,page       -> pagination (limit <= 500)
   *   sort             -> e.g., "-report_date_iso,_modifiedTime"
   *   fields           -> projection CSV e.g. "scheme_name,isin,instrument_name,pct_to_nav"
   */
  app.get('/', async (req, res) => {
    try {
      const {
        search,
        scheme_name,
        scheme_name_regex,
        issuer,
        issuer_regex,
        isin,
        _fileId,
        _sheetTitle,
        report_date,
        date_from,
        date_to,
        limit = '50',
        page = '1',
        sort = '-report_date_iso,-_modifiedTime',
        fields,
      } = req.query;

      const q = {};

      // Free-text search across instrument_name / isin
      if (search) {
        const rx = new RegExp(escapeRegex(String(search)), 'i');
        q.$or = [{ instrument_name: rx }, { isin: rx }];
      }

      // Scheme filter (regex or exact)
      if (scheme_name) {
        q.scheme_name = scheme_name_regex === 'true'
          ? new RegExp(String(scheme_name), 'i')
          : String(scheme_name);
      }

      // Issuer filter (regex or exact)
      if (issuer) {
        q.issuer = issuer_regex === 'true'
          ? new RegExp(String(issuer), 'i')
          : String(issuer);
      }

      // ISIN filter (single or CSV)
      if (isin) {
        const list = String(isin).split(',').map(s => s.trim()).filter(Boolean);
        q.isin = list.length > 1 ? { $in: list } : list[0];
      }

      if (_fileId) q._fileId = String(_fileId);
      if (_sheetTitle) q._sheetTitle = String(_sheetTitle);

      // Exact date match
      if (report_date) q.report_date = String(report_date);

      // Date range on ISO date
      if (date_from || date_to) {
        q.report_date_iso = {};
        if (date_from) q.report_date_iso.$gte = String(date_from);
        if (date_to) q.report_date_iso.$lte = String(date_to);
      }

      // Sort
      const sortSpec = {};
      String(sort)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((token) => {
          if (token.startsWith('-')) sortSpec[token.slice(1)] = -1;
          else sortSpec[token] = 1;
        });

      // Projection (fields)
      let projection = undefined;
      if (fields) {
        projection = {};
        String(fields)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((f) => (projection[f] = 1));
      }

      // Pagination
      const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const pg = Math.max(Number(page) || 1, 1);
      const skip = (pg - 1) * lim;

      // Query
      const cursor = coll.find(q, { projection }).sort(sortSpec).skip(skip).limit(lim);
      const [items, total] = await Promise.all([cursor.toArray(), coll.countDocuments(q)]);

      res.json({
        ok: true,
        query: q,
        page: pg,
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim),
        items,
      });
    } catch (err) {
      logApi.error({ err: err.message, stack: err.stack }, 'API error');
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.listen(port, () => logApi.info(`API listening on http://localhost:${port}`));
  return app;
}

// --- utils ---
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
