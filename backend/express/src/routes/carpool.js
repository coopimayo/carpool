const express = require('express');
const { randomUUID } = require('crypto');

const {
  users,
  optimizationResults,
  setLatestResultId,
} = require('../store');

const router = express.Router();

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
  const driversInput = req.body?.drivers;
  const passengersInput = req.body?.passengers;

  let drivers;
  let passengers;

  if (Array.isArray(driversInput) || Array.isArray(passengersInput)) {
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

  const normalizedDrivers = drivers.map((driver) => ({
    userId: driver.userId,
    name: driver.name,
    capacity: Number(driver.capacity ?? 0),
  }));
  const normalizedPassengers = passengers.map((passenger) => ({
    userId: passenger.userId,
    seatsRequired: Number(passenger.seatsRequired ?? 1),
  }));

  if (
    normalizedDrivers.some((driver) => !driver.userId || !driver.name || !Number.isFinite(driver.capacity) || driver.capacity < 1)
  ) {
    return res.status(400).json({
      error: 'Each driver requires userId, name, and capacity >= 1',
    });
  }

  if (
    normalizedPassengers.some(
      (passenger) =>
        !passenger.userId ||
        !Number.isFinite(passenger.seatsRequired) ||
        passenger.seatsRequired < 1,
    )
  ) {
    return res.status(400).json({
      error: 'Each passenger requires userId and seatsRequired >= 1',
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
