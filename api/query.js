import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB || "mutualfunds";
const collName = process.env.MONGO_COLLECTION || "drive_imports";

let client;
async function getColl() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db(dbName).collection(collName);
}

export default async function handler(req, res) {
  if (!uri) return res.status(500).json({ ok: false, error: "Missing MONGO_URI" });

  try {
    const coll = await getColl();
    const items = await coll.find({}).limit(5).toArray();
    res.status(200).json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
