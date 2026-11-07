const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kolkata_ff_default_secret_key_2026';

function getAdminPin(customPin) {
  return customPin || process.env.ADMIN_PIN || '7788';
}

function generateToken(pin) {
  return jwt.sign({ role: 'admin', authorizedAt: Date.now() }, JWT_SECRET, {
    expiresIn: '24h'
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Bearer token missing.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  req.admin = decoded;
  next();
}

module.exports = {
  getAdminPin,
  generateToken,
  verifyToken,
  authMiddleware
};
