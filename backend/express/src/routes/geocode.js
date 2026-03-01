const express = require('express');

const router = express.Router();

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'routr-carpool/1.0';

/**
 * GET /geocode/search?q=<query>&limit=<n>
 *
 * Proxies address searches to Nominatim so the frontend avoids CORS issues
 * and we can centralise rate-limit / caching logic later.
 *
 * Nominatim usage policy requires a custom User-Agent and max 1 req/s.
 * A simple in-memory cache prevents duplicate upstream calls for the same query.
 */

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 500;

function pruneCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) {
    return;
  }
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [key, entry] of cache) {
    if (entry.ts < cutoff) {
      cache.delete(key);
    }
  }
}

router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.json([]);
  }

  const limit = Math.min(Number(req.query.limit) || 5, 10);
  const cacheKey = `${q.toLowerCase()}|${limit}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
  });

  try {
    const upstream = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!upstream.ok) {
      console.error(`Nominatim returned ${upstream.status}`);
      return res.status(502).json({ error: 'Geocoding service unavailable' });
    }

    const raw = await upstream.json();

    const results = raw.map((item) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      category: item.category,
      address: item.address || {},
    }));

    cache.set(cacheKey, { ts: Date.now(), data: results });
    pruneCache();

    return res.json(results);
  } catch (err) {
    console.error('Geocode proxy error', err);
    return res.status(502).json({ error: 'Geocoding request failed' });
  }
});

module.exports = router;
