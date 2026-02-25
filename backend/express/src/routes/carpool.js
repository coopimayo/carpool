const express = require('express');
const { randomUUID } = require('crypto');

const { query } = require('../db');

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

function optimizeAssignments(drivers, passengers) {
  const remainingPassengers = [...passengers];
  const routes = [];

  for (const driver of drivers) {
    const assignedPassengers = [];
    let seatsRemaining = driver.capacity;

    for (let index = 0; index < remainingPassengers.length;) {
      const passenger = remainingPassengers[index];
      if (passenger.seatsRequired <= seatsRemaining) {
        assignedPassengers.push(passenger);
        seatsRemaining -= passenger.seatsRequired;
        remainingPassengers.splice(index, 1);
      } else {
        index += 1;
      }
    }

    routes.push({
      driverId: driver.userId,
      driverName: driver.name,
      passengerIds: assignedPassengers.map((passenger) => passenger.userId),
      unfilledSeats: seatsRemaining,
    });
  }

  return {
    routes,
    unassignedPassengerIds: remainingPassengers.map((passenger) => passenger.userId),
  };
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

router.post('/optimize', async (req, res) => {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const driversInput = req.body.drivers;
  const passengersInput = req.body.passengers;

  let drivers;
  let passengers;

  if (driversInput !== undefined || passengersInput !== undefined) {
    if (driversInput !== undefined && !Array.isArray(driversInput)) {
      return res.status(400).json({
        error: 'drivers must be an array when provided',
      });
    }

    if (passengersInput !== undefined && !Array.isArray(passengersInput)) {
      return res.status(400).json({
        error: 'passengers must be an array when provided',
      });
    }

    drivers = Array.isArray(driversInput) ? driversInput : [];
    passengers = Array.isArray(passengersInput) ? passengersInput : [];
  } else {
    try {
      drivers = await loadUsersByRole('driver');
      passengers = await loadUsersByRole('passenger');
    } catch (err) {
      console.error('Failed to load users for optimization', err);
      return res.status(500).json({ error: 'Failed to load users for optimization' });
    }
  }

  if (!drivers.length) {
    return res.status(400).json({ error: 'No drivers provided for optimization' });
  }

  if (!passengers.length) {
    return res.status(400).json({ error: 'No passengers provided for optimization' });
  }

  const { errors: driverErrors, normalized: normalizedDrivers } = validateDrivers(drivers);
  const { errors: passengerErrors, normalized: normalizedPassengers } = validatePassengers(passengers);

  const details = [...driverErrors, ...passengerErrors];
  if (details.length > 0) {
    return res.status(400).json({
      error: 'Invalid optimize payload',
      details,
    });
  }

  const resultId = randomUUID();
  const assignment = optimizeAssignments(normalizedDrivers, normalizedPassengers);

  const result = {
    id: resultId,
    createdAt: new Date().toISOString(),
    status: 'completed',
    ...assignment,
  };

  try {
    await query(
      `
        INSERT INTO optimization_results (id, created_at, status, routes, unassigned_passenger_ids)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      `,
      [
        resultId,
        result.createdAt,
        result.status,
        JSON.stringify(result.routes),
        JSON.stringify(result.unassignedPassengerIds),
      ],
    );

    return res.status(201).json(result);
  } catch (err) {
    console.error('Failed to persist optimization result', err);
    return res.status(500).json({ error: 'Failed to persist optimization result' });
  }
});

router.get('/results/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, created_at, status, routes, unassigned_passenger_ids FROM optimization_results WHERE id = $1',
      [req.params.id],
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

module.exports = router;
