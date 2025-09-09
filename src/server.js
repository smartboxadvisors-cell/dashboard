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
import express  from 'express'
import { connectToMongo, fetchDataFromMongo } from '../api/query.js';

const app = express()
const PORT = 3000;

connectToMongo();

const MODE = (process.env.MODE || 'ingest').toLowerCase();

async function main() {
  if (MODE === 'ingest') {
    // Run the ingestion process and allow the script to finish
    await runIngest();
    return;
  }

  if (MODE === 'api') {
    // Start the API server
    return startApi();
  }

  if (MODE === 'both') {
    // Run ingestion and start API concurrently
    await runIngest(); // Ensure ingestion runs asynchronously
    startApi(); // Start API server after ingestion completes
    return;
  }

  log.info('Set MODE=ingest | api | both');
}

// Run the main function with proper error handling
main().catch(err => { 
  log.error(err); 
  process.exit(1); 
});

app.get('/', (req, res) => {
  res.json({
    message:'ok'

  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'API is running' });
});

// API route to fetch data from MongoDB
app.get('/data', async (req, res) => {
  try {
    const data = await fetchDataFromMongo('drive_imports');  // Replace with your collection name
    res.json({
      total: data.length,
      data
    });  // Return data as JSON
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data from MongoDB' });
  }
});

// Start the API server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});