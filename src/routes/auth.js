const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

/**
 * POST /api/auth/login
 * Admin login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.loginAdmin(email, password);

    res.json({
      token: result.token,
      expiresIn: result.expiresIn,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

/**
 * GET /api/auth/verify
 * Verify token is valid
 */
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    res.json({ 
      valid: true, 
      email: decoded.email,
      role: decoded.role,
    });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

/**
 * POST /api/auth/hash-password
 * Utility endpoint to generate password hash (disable in production!)
 */
router.post('/hash-password', async (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const hash = await authService.hashPassword(password);
    
    res.json({ 
      hash,
      message: 'Add this hash to your .env file as ADMIN_PASSWORD_HASH',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to hash password' });
  }
});

module.exports = router;
