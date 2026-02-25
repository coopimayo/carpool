const express = require('express');

const { query } = require('../db');

const router = express.Router();

router.get('/:driverId', async (req, res) => {
  if (!req.params.driverId || typeof req.params.driverId !== 'string') {
    return res.status(400).json({ error: 'driverId path parameter is required' });
  }
  try {
    const latest = await query(
      'SELECT id, routes FROM optimization_results ORDER BY created_at DESC LIMIT 1',
      [],
    );

    if (latest.rowCount === 0) {
      return res.status(404).json({ error: 'No optimization results available' });
    }

    const result = latest.rows[0];
    const driverRoute = result.routes.find((route) => route.driverId === req.params.driverId);
    if (!driverRoute) {
      return res.status(404).json({ error: 'Driver route not found' });
    }

    return res.json(driverRoute);
  } catch (err) {
    console.error('Failed to fetch driver route', err);
    return res.status(500).json({ error: 'Failed to fetch driver route' });
  }
});

module.exports = router;
