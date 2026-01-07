const authService = require('../services/authService');

/**
 * Middleware to verify admin authentication
 */
function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin role required.',
        code: 'NOT_ADMIN' 
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid or expired token.',
      code: 'INVALID_TOKEN' 
    });
  }
}

/**
 * Optional auth - doesn't block if no token
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.admin = authService.verifyToken(token);
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }
  next();
}

module.exports = {
  requireAdmin,
  optionalAuth,
};
