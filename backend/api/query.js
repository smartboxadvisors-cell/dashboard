// import { MongoClient } from "mongodb";

// const uri = process.env.MONGO_URI;
// const dbName = process.env.MONGO_DB || "mutualfunds";
// const collName = process.env.MONGO_COLLECTION || "drive_imports";

// let client;
// async function getColl() {
//   if (!client) {
//     client = new MongoClient(uri);
//     await client.connect();
//   }
//   return client.db(dbName).collection(collName);
// }

// export default async function handler(req, res) {
//   if (!uri) return res.status(500).json({ ok: false, error: "Missing MONGO_URI" });

//   try {
//     const coll = await getColl();
//     const items = await coll.find({}).limit(5).toArray();
//     res.status(200).json({ ok: true, items });
//   } catch (err) {
//     res.status(500).json({ ok: false, error: err.message });
//   }
// }

import { MongoClient } from 'mongodb';

// MongoDB URI from environment
const mongoUri = process.env.MONGO_URI || 'your-mongo-uri';
let db;

// Connect to MongoDB
export async function connectToMongo() {
  try {
    const client = await MongoClient.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    db = client.db('mutualfunds');  // Replace with your DB name
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);  // Exit if unable to connect
  }
}

// Fetch data from the MongoDB collection
export async function fetchDataFromMongo(collectionName) {
  try {
    const collection = db.collection(collectionName); // Replace with your collection name
    const data = await collection.find().skip().limit(limit).toArray();  // Fetch all data
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw new Error('Failed to fetch data from MongoDB');
  }
}
