export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const data = await response.json();

    const result = data?.quoteResponse?.result?.[0];
    const price = result?.regularMarketPrice;

    // 🔎 DEBUG temporaire
    if (!result) {
      console.error('Yahoo response empty:', data);
    }

    if (typeof price !== 'number') {
      return res.status(502).json({
        error: 'Invalid price received',
        debug: data,
      });
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

    return res.status(200).json({ price });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}