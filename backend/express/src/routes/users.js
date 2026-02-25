const express = require('express');

const { users } = require('../store');

const router = express.Router();

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeLocation(location) {
  if (!isPlainObject(location)) {
    return null;
  }

  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

router.post('/', (req, res) => {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { userId, name, role, location, capacity, seatsRequired } = req.body;
  const details = [];

  if (!isNonEmptyString(userId)) {
    details.push('userId must be a non-empty string');
  }

  if (!isNonEmptyString(name)) {
    details.push('name must be a non-empty string');
  }

  if (!isNonEmptyString(role) || (role !== 'driver' && role !== 'passenger')) {
    details.push("role must be either 'driver' or 'passenger'");
  }

  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    details.push('location.latitude and location.longitude must be numbers');
  }

  const normalizedCapacity = role === 'driver' ? Number(capacity ?? 4) : 0;
  const normalizedSeatsRequired = role === 'passenger' ? Number(seatsRequired ?? 1) : 0;

  if (role === 'driver' && (!Number.isInteger(normalizedCapacity) || normalizedCapacity < 1)) {
    details.push('capacity must be an integer >= 1 for driver role');
  }

  if (role === 'passenger' && (!Number.isInteger(normalizedSeatsRequired) || normalizedSeatsRequired < 1)) {
    details.push('seatsRequired must be an integer >= 1 for passenger role');
  }

  if (details.length > 0) {
    return res.status(400).json({
      error: 'Invalid user payload',
      details,
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
