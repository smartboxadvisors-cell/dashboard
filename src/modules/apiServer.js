/**
 * Minimal Express API to query the ingested data
 */

import express from 'express';
import { MongoClient } from 'mongodb';
import { CONFIG } from '../config.js';
import { log } from '../logger.js';

export async function startApi({ port = Number(process.env.PORT || 3000) } = {}) {
  const app = express();
  app.use(express.json());

  const client = new MongoClient(CONFIG.mongoUri);
  await client.connect();
  const coll = client.db(CONFIG.dbName).collection(CONFIG.collName);
  log.info({ uri: CONFIG.mongoUri, db: CONFIG.dbName, coll: CONFIG.collName }, 'API connected to MongoDB');

  app.get('/health', (_req, res) => res.json({ ok: true }));

  /**
   * GET /
   * Query params (optional):
   *   _rowIndex, isin, scheme_name, report_date, _fileId, _sheetTitle
   *   limit (default 50, max 500), page (default 1), sort (e.g., "-_modifiedTime,isin")
   */
  app.get('/', async (req, res) => {
    try {
      const {
        _rowIndex,
        isin,
        scheme_name,
        report_date,
        _fileId,
        _sheetTitle,
        limit = '50',
        page = '1',
        sort = '-_modifiedTime',
      } = req.query;

      const q = {};
      if (_rowIndex !== undefined) q._rowIndex = Number(_rowIndex);
      if (isin) q.isin = String(isin);
      if (scheme_name) q.scheme_name = String(scheme_name);
      if (report_date) q.report_date = String(report_date);
      if (_fileId) q._fileId = String(_fileId);
      if (_sheetTitle) q._sheetTitle = String(_sheetTitle);

      const sortSpec = {};
      String(sort)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((token) => {
          if (token.startsWith('-')) sortSpec[token.slice(1)] = -1;
          else sortSpec[token] = 1;
        });

      const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
      const pg = Math.max(Number(page) || 1, 1);
      const skip = (pg - 1) * lim;

      const cursor = coll.find(q).sort(sortSpec).skip(skip).limit(lim);
      const [items, total] = await Promise.all([cursor.toArray(), coll.countDocuments(q)]);

      res.json({ ok: true, query: q, page: pg, limit: lim, total, items });
    } catch (err) {
      log.error({ err: err.message }, 'API error');
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.listen(port, () => log.info(`API listening on http://localhost:${port}`));
  return app;
}
