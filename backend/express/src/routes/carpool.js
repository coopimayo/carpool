const express = require('express');
const { randomUUID } = require('crypto');

const {
  users,
  optimizationResults,
  setLatestResultId,
} = require('../store');

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

router.post('/optimize', (req, res) => {
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
    const usersList = [...users.values()];
    drivers = usersList.filter((user) => user.role === 'driver');
    passengers = usersList.filter((user) => user.role === 'passenger');
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

  optimizationResults.set(resultId, result);
  setLatestResultId(resultId);

  return res.status(201).json(result);
});

router.get('/results/:id', (req, res) => {
  const result = optimizationResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Optimization result not found' });
  }
  return res.json(result);
});

module.exports = router;
