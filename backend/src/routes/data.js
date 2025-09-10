

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
