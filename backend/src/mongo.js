import { MongoClient } from 'mongodb';
import { CONFIG } from './config.js';
import { log } from './logger.js';

export async function withMongo(fn) {
  const client = new MongoClient(CONFIG.mongoUri);
  await client.connect();
  try { return await fn(client.db(CONFIG.dbName).collection(CONFIG.collName)); }
  finally { await client.close(); }
}

// Upsert by business keys to avoid duplicates across files:
// scheme_name + report_date + isin + instrument_name
export function toBulkOps(docs) {
  if (CONFIG.insertOnly) return docs.map(d => ({ insertOne: { document: d } }));
  return docs.map(d => ({
    updateOne: {
      filter: {
        scheme_name: d.scheme_name ?? null,
        report_date: d.report_date ?? null,
        isin: d.isin ?? null,
        instrument_name: d.instrument_name ?? null,
      },
      update: { $set: d, $setOnInsert: { _source: 'google_drive' } },
      upsert: true
    }
  }));
}

export async function bulkWriteInChunks(coll, docs, chunk = 1000) {
  let inserted = 0, upserts = 0, modified = 0;
  for (let i = 0; i < docs.length; i += chunk) {
    const ops = toBulkOps(docs.slice(i, i + chunk));
    if (!ops.length) continue;
    const res = await coll.bulkWrite(ops, { ordered: false });
    inserted += res.insertedCount || 0;
    upserts  += res.upsertedCount || 0;
    modified += res.modifiedCount || 0;
  }
  return { inserted, upserts, modified };
}
