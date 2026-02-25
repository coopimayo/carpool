const express = require('express');

const { optimizationResults, getLatestResultId } = require('../store');

const router = express.Router();

router.get('/:driverId', (req, res) => {
  if (!req.params.driverId || typeof req.params.driverId !== 'string') {
    return res.status(400).json({ error: 'driverId path parameter is required' });
  }

  const latestResultId = getLatestResultId();

  if (!latestResultId) {
    return res.status(404).json({ error: 'No optimization results available' });
  }

  const result = optimizationResults.get(latestResultId);
  if (!result) {
    return res.status(404).json({ error: 'Optimization result not found' });
  }

  const driverRoute = result.routes.find((route) => route.driverId === req.params.driverId);
  if (!driverRoute) {
    return res.status(404).json({ error: 'Driver route not found' });
  }

  return res.json(driverRoute);
});

module.exports = router;
