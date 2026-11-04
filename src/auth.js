import jwt from 'jsonwebtoken';

// Check if the user has a valid JWT token
export function auth(req, res, next) {
  const h = req.headers.authorization || '';

  // Get token from: Authorization: Bearer <token>
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;

  // No token
  if (!t) {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  try {
    // Verify the token
    req.user = jwt.verify(t, process.env.JWT_SECRET);

    // Continue to the next middleware/route
    next();
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
}

// Check if the user's role is allowed
export function roles(...r) {
  return (req, res, next) => {
    console.log('ROLE CHECK:', {
      actualRole: req.user?.role,
      allowedRoles: r,
    });

    return r.includes(req.user?.role)
      ? next()
      : res.status(403).json({
          message: 'Insufficient permission',
        });
  };
}