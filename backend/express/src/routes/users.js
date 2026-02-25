const express = require('express');

const { users } = require('../store');

const router = express.Router();

function normalizeLocation(location) {
  if (
    !location ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number'
  ) {
    return null;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

router.post('/', (req, res) => {
  const { userId, name, role, location, capacity, seatsRequired } = req.body || {};

  if (!userId || !name || !role) {
    return res.status(400).json({
      error: 'userId, name, and role are required',
    });
  }

  if (role !== 'driver' && role !== 'passenger') {
    return res.status(400).json({
      error: "role must be either 'driver' or 'passenger'",
    });
  }

  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    return res.status(400).json({
      error: 'location.latitude and location.longitude must be numbers',
    });
  }

  const normalizedCapacity = role === 'driver' ? Number(capacity ?? 4) : 0;
  const normalizedSeatsRequired = role === 'passenger' ? Number(seatsRequired ?? 1) : 0;

  if (role === 'driver' && (!Number.isInteger(normalizedCapacity) || normalizedCapacity < 1)) {
    return res.status(400).json({
      error: 'capacity must be an integer >= 1 for driver role',
    });
  }

  if (role === 'passenger' && (!Number.isInteger(normalizedSeatsRequired) || normalizedSeatsRequired < 1)) {
    return res.status(400).json({
      error: 'seatsRequired must be an integer >= 1 for passenger role',
    });
  }

  const user = {
    userId,
    name,
    role,
    location: normalizedLocation,
    ...(role === 'driver' ? { capacity: normalizedCapacity } : {}),
    ...(role === 'passenger' ? { seatsRequired: normalizedSeatsRequired } : {}),
  };

  const alreadyExists = users.has(userId);
  users.set(userId, user);

  return res.status(alreadyExists ? 200 : 201).json({
    message: alreadyExists ? 'User updated' : 'User created',
    user,
  });
});

module.exports = router;
