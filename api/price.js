/**
 * GET /api/price?symbol=UKOIL
 * Proxies Twelve Data so the API key stays server-side.
 *
 * Symbols used:
 *   UKOIL   → Brent Crude Oil
 *   BTC/USD → Bitcoin
 */

export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error') {
      return res.status(502).json({ error: data.message });
    }

    const price = parseFloat(data.price);
    if (isNaN(price)) {
      return res.status(502).json({ error: 'Invalid price received' });
    }

    // No caching — always return fresh data
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ price });

  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed: ' + err.message });
  }
}