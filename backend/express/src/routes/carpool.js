const express = require('express');
const { randomUUID } = require('crypto');

const { query } = require('../db');
const {
  optimizeAssignments,
  buildOptimizationResult,
  persistOptimizationResult,
} = require('../optimization');
const { enqueueOptimizationJob, getOptimizationJobForAccount } = require('../queue');
const { requireAuth } = require('../auth');

const router = express.Router();

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateDrivers(drivers) {
  const errors = [];
  const normalized = drivers.map((driver, index) => {
    if (!isPlainObject(driver)) {
      errors.push(`drivers[${index}] must be an object`);
      return null;
    }

    const userId = driver.userId;
    const name = driver.name;
    const capacity = Number(driver.capacity ?? 0);

    if (!isNonEmptyString(userId)) {
      errors.push(`drivers[${index}].userId must be a non-empty string`);
    }

    if (!isNonEmptyString(name)) {
      errors.push(`drivers[${index}].name must be a non-empty string`);
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      errors.push(`drivers[${index}].capacity must be an integer >= 1`);
    }

    return { userId, name, capacity };
  });

  return { errors, normalized };
}

function validatePassengers(passengers) {
  const errors = [];
  const normalized = passengers.map((passenger, index) => {
    if (!isPlainObject(passenger)) {
      errors.push(`passengers[${index}] must be an object`);
      return null;
    }

    const userId = passenger.userId;
    const seatsRequired = Number(passenger.seatsRequired ?? 1);

    if (!isNonEmptyString(userId)) {
      errors.push(`passengers[${index}].userId must be a non-empty string`);
    }

    if (!Number.isInteger(seatsRequired) || seatsRequired < 1) {
      errors.push(`passengers[${index}].seatsRequired must be an integer >= 1`);
    }

    return { userId, seatsRequired };
  });

  return { errors, normalized };
}

async function loadUsersByRole(role) {
  const result = await query(
    'SELECT user_id, name, role, capacity, seats_required FROM users WHERE role = $1',
    [role],
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    role: row.role,
    capacity: row.capacity,
    seatsRequired: row.seats_required,
  }));
}

async function resolveOptimizationInputs(req, res) {
  if (!isPlainObject(req.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return null;
  }

  const driversInput = req.body.drivers;
  const passengersInput = req.body.passengers;

  let drivers;
  let passengers;

  if (driversInput !== undefined || passengersInput !== undefined) {
    if (driversInput !== undefined && !Array.isArray(driversInput)) {
      res.status(400).json({
        error: 'drivers must be an array when provided',
      });
      return null;
    }

    if (passengersInput !== undefined && !Array.isArray(passengersInput)) {
      res.status(400).json({
        error: 'passengers must be an array when provided',
      });
      return null;
    }

    drivers = Array.isArray(driversInput) ? driversInput : [];
    passengers = Array.isArray(passengersInput) ? passengersInput : [];
  } else {
    try {
      drivers = await loadUsersByRole('driver');
      passengers = await loadUsersByRole('passenger');
    } catch (err) {
      console.error('Failed to load users for optimization', err);
      res.status(500).json({ error: 'Failed to load users for optimization' });
      return null;
    }
  }

  if (!drivers.length) {
    res.status(400).json({ error: 'No drivers provided for optimization' });
    return null;
  }

  if (!passengers.length) {
    res.status(400).json({ error: 'No passengers provided for optimization' });
    return null;
  }

  const { errors: driverErrors, normalized: normalizedDrivers } = validateDrivers(drivers);
  const { errors: passengerErrors, normalized: normalizedPassengers } = validatePassengers(passengers);

  const details = [...driverErrors, ...passengerErrors];
  if (details.length > 0) {
    res.status(400).json({
      error: 'Invalid optimize payload',
      details,
    });
    return null;
  }

  return {
    drivers: normalizedDrivers,
    passengers: normalizedPassengers,
  };
}

router.post('/optimize', requireAuth, async (req, res) => {
  const inputs = await resolveOptimizationInputs(req, res);
  if (!inputs) {
    return null;
  }

  const resultId = randomUUID();
  const assignment = optimizeAssignments(inputs.drivers, inputs.passengers);
  const result = buildOptimizationResult(resultId, assignment, req.auth.accountId);

  try {
    await persistOptimizationResult(result);
    return res.status(201).json(result);
  } catch (err) {
    console.error('Failed to persist optimization result', err);
    return res.status(500).json({ error: 'Failed to persist optimization result' });
  }
});

router.post('/optimize/async', requireAuth, async (req, res) => {
  const inputs = await resolveOptimizationInputs(req, res);
  if (!inputs) {
    return null;
  }

  try {
    const jobId = await enqueueOptimizationJob({
      ...inputs,
      accountId: req.auth.accountId,
    });
    return res.status(202).json({
      jobId,
      status: 'queued',
    });
  } catch (err) {
    console.error('Failed to enqueue optimization job', err);
    return res.status(500).json({ error: 'Failed to enqueue optimization job' });
  }
});

router.get('/results/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT id, account_id, created_at, status, routes, unassigned_passenger_ids
        FROM optimization_results
        WHERE id = $1 AND account_id = $2
      `,
      [req.params.id, req.auth.accountId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Optimization result not found' });
    }

    const row = result.rows[0];
    return res.json({
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      routes: row.routes,
      unassignedPassengerIds: row.unassigned_passenger_ids,
    });
  } catch (err) {
    console.error('Failed to fetch optimization result', err);
    return res.status(500).json({ error: 'Failed to fetch optimization result' });
  }
});

router.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const job = await getOptimizationJobForAccount(req.params.id, req.auth.accountId);
    if (!job) {
      return res.status(404).json({ error: 'Optimization job not found' });
    }

    let result = null;
    if (job.resultId) {
      const resultQuery = await query(
        `
          SELECT id, created_at, status, routes, unassigned_passenger_ids
          FROM optimization_results
          WHERE id = $1 AND account_id = $2
        `,
        [job.resultId, req.auth.accountId],
      );

      if (resultQuery.rowCount > 0) {
        const row = resultQuery.rows[0];
        result = {
          id: row.id,
          createdAt: row.created_at,
          status: row.status,
          routes: row.routes,
          unassignedPassengerIds: row.unassigned_passenger_ids,
        };
      }
    }

    return res.json({
      ...job,
      result,
    });
  } catch (err) {
    console.error('Failed to fetch optimization job', err);
    return res.status(500).json({ error: 'Failed to fetch optimization job' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        SELECT id, created_at, status, routes, unassigned_passenger_ids
        FROM optimization_results
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT 25
      `,
      [req.auth.accountId],
    );

    const history = result.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      routes: row.routes,
      unassignedPassengerIds: row.unassigned_passenger_ids,
    }));

    return res.json({ history });
  } catch (err) {
    console.error('Failed to fetch route history', err);
    return res.status(500).json({ error: 'Failed to fetch route history' });
  }
});

module.exports = router;
