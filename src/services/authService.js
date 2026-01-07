const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * Verify admin credentials and generate JWT token
 */
async function loginAdmin(email, password) {
  // Check email
  if (email !== config.admin.email) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, config.admin.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token
  const token = jwt.sign(
    { email, role: 'admin' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { token, expiresIn: config.jwt.expiresIn };
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate password hash (utility for setup)
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

module.exports = {
  loginAdmin,
  verifyToken,
  hashPassword,
};
