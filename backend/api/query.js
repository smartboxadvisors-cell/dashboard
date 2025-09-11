// // api/query.js
// import { MongoClient } from 'mongodb';
// import { log } from '../src/logger.js';

// let client;
// let db;

// export async function connectToMongo() {
//   if (db) return db;
//   const uri = process.env.MONGO_URI;
//   const dbName = process.env.MONGO_DB;

//   client = new MongoClient(uri, { ignoreUndefined: true });
//   await client.connect();
//   db = client.db(dbName);
//   log.info('Connected to Mongo');
//   return db;
// }

// /**
//  * Fetch paginated data with bulletproof integer handling.
//  * @param {string} collectionName
//  * @param {number|string} limitIn
//  * @param {number|string} skipIn
//  * @returns {{data:any[], total:number}}
//  */
// export async function fetchDataFromMongo(collectionName, limitIn = 50, skipIn = 0) {
//   if (!db) await connectToMongo();

//   // Coerce to safe integers with defaults and caps
//   const toInt = (v, def) => {
//     const n = Number.parseInt(v, 10);
//     return Number.isFinite(n) ? n : def;
//   };

//   let limit = toInt(limitIn, 50);
//   let skip  = toInt(skipIn, 0);

//   // guardrails
//   if (!Number.isInteger(limit) || limit < 1) limit = 50;
//   if (!Number.isInteger(skip)  || skip  < 0) skip  = 0;
//   if (limit > 1000) limit = 1000;

//   try {
//     const col = db.collection(collectionName);

//     // IMPORTANT: ensure integers reach driver
//     const cursor = col.find({})
//       .skip(skip | 0)   // |0 guarantees 32-bit int
//       .limit(limit | 0);

//     const data = await cursor.toArray();
//     const total = await col.estimatedDocumentCount();

//     return { data, total };
//   } catch (err) {
//     log.error('fetchDataFromMongo error', err);
//     throw new Error('Failed to fetch data from MongoDB');
//   }
// }
// api/query.js
import { MongoClient } from 'mongodb';
import { log } from '../src/logger.js';

let client;
let db;

export async function connectToMongo() {
  if (db) return db;
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB;

  client = new MongoClient(uri, { ignoreUndefined: true });
  await client.connect();
  db = client.db(dbName);
  log.info('Connected to Mongo');
  return db;
}

/**
 * Fetch paginated data with bulletproof integer handling.
 * @param {string} collectionName
 * @param {number|string} limitIn
 * @param {number|string} skipIn
 * @returns {{data:any[], total:number}}
 */
export async function fetchDataFromMongo(collectionName, limitIn = 50, skipIn = 0) {
  if (!db) await connectToMongo();

  // Coerce to safe integers with defaults and caps
  const toInt = (v, def) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
  };

  let limit = toInt(limitIn, 50);
  let skip  = toInt(skipIn, 0);

  // guardrails
  if (!Number.isInteger(limit) || limit < 1) limit = 50;
  if (!Number.isInteger(skip)  || skip  < 0) skip  = 0;
  if (limit > 1000) limit = 1000;

  try {
    const col = db.collection(collectionName);

    // IMPORTANT: ensure integers reach driver
    const cursor = col.find({})
      .skip(skip | 0)   // |0 guarantees 32-bit int
      .limit(limit | 0);

    const data = await cursor.toArray();
    const total = await col.estimatedDocumentCount();

    return { data, total };
  } catch (err) {
    log.error('fetchDataFromMongo error', err);
    throw new Error('Failed to fetch data from MongoDB');
  }
}
