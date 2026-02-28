const jwt = require('jsonwebtoken');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  return secret;
}

function createAuthToken(account) {
  const secret = requireJwtSecret();
  return jwt.sign(
    {
      sub: account.id,
      email: account.email,
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function getBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Authorization token is required' });
  }

  try {
    const secret = requireJwtSecret();
    const payload = jwt.verify(token, secret);
    req.auth = {
      accountId: payload.sub,
      email: payload.email,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  createAuthToken,
  requireAuth,
};
