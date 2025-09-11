import { connectToMongo, fetchDataFromMongo } from '../api/query.js';

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
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});
