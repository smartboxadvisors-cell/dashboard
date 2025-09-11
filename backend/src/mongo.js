// import { MongoClient } from 'mongodb';
// import { CONFIG } from './config.js';
// import { log } from './logger.js';

// export async function withMongo(fn) {
//   const client = new MongoClient(CONFIG.mongoUri);
//   await client.connect();
//   try { return await fn(client.db(CONFIG.dbName).collection(CONFIG.collName)); }
//   finally { await client.close(); }
// }

// // Upsert by business keys to avoid duplicates across files:
// // scheme_name + report_date + isin + instrument_name
// export function toBulkOps(docs) {
//   if (CONFIG.insertOnly) return docs.map(d => ({ insertOne: { document: d } }));
//   return docs.map(d => ({
//     updateOne: {
//       filter: {
//         scheme_name: d.scheme_name ?? null,
//         report_date: d.report_date ?? null,
//         isin: d.isin ?? null,
//         instrument_name: d.instrument_name ?? null,
//       },
//       update: { $set: d, $setOnInsert: { _source: 'google_drive' } },
//       upsert: true
//     }
//   }));
// }

// export async function bulkWriteInChunks(coll, docs, chunk = 1000) {
//   let inserted = 0, upserts = 0, modified = 0;
//   for (let i = 0; i < docs.length; i += chunk) {
//     const ops = toBulkOps(docs.slice(i, i + chunk));
//     if (!ops.length) continue;
//     const res = await coll.bulkWrite(ops, { ordered: false });
//     inserted += res.insertedCount || 0;
//     upserts  += res.upsertedCount || 0;
//     modified += res.modifiedCount || 0;
//   }
//   return { inserted, upserts, modified };
// }

// src/mongo.js
import { MongoClient } from 'mongodb';
import { CONFIG } from './config.js';
import { log, childLogger } from './logger.js';

const logDb = childLogger('mongo');

let _client = null;
let _indexesEnsured = false;

async function getClient() {
  if (_client?.topology?.isConnected()) return _client;
  _client = new MongoClient(CONFIG.mongoUri, {
    // sensible pool defaults; tune if needed
    maxPoolSize: 20,
    minPoolSize: 0,
    retryWrites: true,
  });
  await _client.connect();
  logDb.info('Mongo connected');
  return _client;
}

export async function getCollection() {
  const client = await getClient();
  const db = client.db(CONFIG.dbName);
  const coll = db.collection(CONFIG.collName);
  if (!_indexesEnsured) {
    await ensureIndexes(coll);
    _indexesEnsured = true;
  }
  return coll;
}

/**
 * Utility that hands you the collection and closes nothing (since we reuse the client).
 * Use this instead of creating new clients each call.
 */
export async function withMongo(fn) {
  const coll = await getCollection();
  return fn(coll);
}

/**
 * Create helpful indexes once.
 * - Unique dedupe key: (scheme_name, report_date, isin, instrument_name, _fileId, _sheetName)
 *   (include file/sheet to avoid cross-file accidental collisions)
 * - Secondary indexes to speed common queries.
 */
async function ensureIndexes(coll) {
  try {
    await coll.createIndexes([
      {
        key: {
          scheme_name: 1,
          report_date: 1,
          isin: 1,
          instrument_name: 1,
          _fileId: 1,
          _sheetName: 1,
        },
        name: 'uniq_business_key',
        unique: !CONFIG.insertOnly, // only enforce when we’re upserting
        sparse: true,
      },
      { key: { report_date_iso: -1 }, name: 'report_date_iso_desc' },
      { key: { scheme_name: 1, report_date_iso: -1 }, name: 'scheme_date' },
      { key: { isin: 1 }, name: 'by_isin' },
    ]);
    logDb.info('Indexes ensured');
  } catch (e) {
    logDb.warn({ err: e?.message }, 'Index creation failed (continuing)');
  }
}

/**
 * Convert docs to bulk operations.
 * Upsert by business keys to avoid duplicates across files.
 */
export function toBulkOps(docs) {
  if (!Array.isArray(docs) || !docs.length) return [];
  if (CONFIG.insertOnly) {
    return docs.map((d) => ({ insertOne: { document: d } }));
  }
  return docs.map((d) => ({
    updateOne: {
      filter: {
        scheme_name: d.scheme_name ?? null,
        report_date: d.report_date ?? null,
        isin: d.isin ?? null,
        instrument_name: d.instrument_name ?? null,
        _fileId: d._fileId ?? null,
        _sheetName: d._sheetName ?? null,
      },
      update: { $set: d, $setOnInsert: { _source: d._source ?? 'google_drive' } },
      upsert: true,
    },
  }));
}

/**
 * Bulk write in chunks (unordered) for speed.
 * Returns aggregated counts.
 */
// export async function bulkWriteInChunks(coll, docs, chunk = 1000) {

//   const chunks = [];
//   for (let i = 0; i < docs.length; i += chunkSize) {
//     chunks.push(docs.slice(i, i + chunkSize));
//   }

//   let inserted = 0, upserts = 0, modified = 0, matched = 0, failures = 0;

//   for (let i = 0; i < docs.length; i += chunk) {
//     const slice = docs.slice(i, i + chunk);
//     const ops = toBulkOps(slice);
//     if (!ops.length) continue;

//     try {
//       const res = await coll.bulkWrite(ops, { ordered: false });
//       inserted += res.insertedCount || 0;
//       upserts  += res.upsertedCount || 0;
//       modified += res.modifiedCount || 0;
//       matched  += res.matchedCount || 0;
//     } catch (e) {
//       failures += slice.length;
//       logDb.warn({ err: e?.message, batchStart: i, batchSize: slice.length }, 'bulkWrite batch failed');
//     }
//   }

//   return { inserted, upserts, modified, matched, failures };
// }

export async function bulkWriteInChunks(coll, docs, chunkSize = 1000) {
  const chunks = [];
  for (let i = 0; i < docs.length; i += chunkSize) {
    chunks.push(docs.slice(i, i + chunkSize));
  }

  let inserted = 0, upserts = 0, modified = 0, matched = 0, failures = 0;

  for (const batch of chunks) {
    const ops = [];

    for (const doc of batch) {
      // You likely already set a unique _id in normalizeRows; prefer that.
      // If not, define a deterministic key here (e.g., hash of fileId+sheetTitle+row).
      if (!doc._id) {
        // Fallback: create a synthetic id using a stable combo if you have one:
        // doc._id = `${doc.fileId}|${doc.sheetTitle}|${doc._rowIndex ?? ops.length}`;
        // If you can't guarantee uniqueness, keep your existing filter logic.
      }

      const { _id, ...rest } = doc;

      if (_id) {
        ops.push({
          replaceOne: {
            filter: { _id },
            replacement: doc,    // full doc
            upsert: true,
          }
        });
      } else {
        // If you don't have _id, use your unique compound key fields instead:
        ops.push({
          replaceOne: {
            filter: { fileId: doc.fileId, sheetTitle: doc.sheetTitle, __rowKey: doc.__rowKey ?? JSON.stringify(rest).slice(0, 512) },
            replacement: doc,
            upsert: true,
          }
        });
      }
    }

    try {
      const res = await coll.bulkWrite(ops, { ordered: false });
      inserted += res.upsertedCount || 0;
      upserts  += res.upsertedCount || 0;
      modified += res.modifiedCount || 0;
      matched  += res.matchedCount  || 0;
    } catch (e) {
      failures += batch.length;
      // optional: log first op to inspect shape
      // console.warn('bulkWrite batch failed', { err: e.message, sampleOp: ops[0] });
    }
  }

  return { inserted, upserts, modified, matched, failures };
}

/** Graceful shutdown (optional) */
export async function closeMongo() {
  try {
    if (_client) {
      await _client.close();
      logDb.info('Mongo closed');
    }
  } catch (e) {
    logDb.warn({ err: e?.message }, 'Error closing Mongo');
  } finally {
    _client = null;
  }
}
