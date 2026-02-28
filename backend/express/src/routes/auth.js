const express = require('express');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

const { query } = require('../db');
const { createAuthToken, requireAuth } = require('../auth');

const router = express.Router();

function isValidEmail(value) {
  return typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value);
}

function isValidPassword(value) {
  return typeof value === 'string' && value.length >= 8;
}

router.post('/register', async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();
  const password = req.body?.password;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await query('SELECT id FROM auth_accounts WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const accountId = randomUUID();

    await query(
      `
        INSERT INTO auth_accounts (id, email, password_hash)
        VALUES ($1, $2, $3)
      `,
      [accountId, email, passwordHash],
    );

    const token = createAuthToken({ id: accountId, email });

    return res.status(201).json({
      token,
      account: {
        id: accountId,
        email,
      },
    });
  } catch (err) {
    console.error('Failed to register account', err);
    return res.status(500).json({ error: 'Failed to register account' });
  }
});

router.post('/login', async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();
  const password = req.body?.password;

  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await query(
      'SELECT id, email, password_hash FROM auth_accounts WHERE email = $1',
      [email],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const account = result.rows[0];
    const isMatch = await bcrypt.compare(password, account.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createAuthToken({ id: account.id, email: account.email });

    return res.json({
      token,
      account: {
        id: account.id,
        email: account.email,
      },
    });
  } catch (err) {
    console.error('Failed to log in', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT id, email, created_at FROM auth_accounts WHERE id = $1', [
      req.auth.accountId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];
    return res.json({
      id: account.id,
      email: account.email,
      createdAt: account.created_at,
    });
  } catch (err) {
    console.error('Failed to fetch account', err);
    return res.status(500).json({ error: 'Failed to fetch account' });
  }
});

module.exports = router;
