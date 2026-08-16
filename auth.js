const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Verifies the JWT sent in the Authorization header and attaches the
// corresponding user document to req.user for downstream handlers.
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorResponse('Not authorized, no token provided', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ErrorResponse('User belonging to this token no longer exists', 401));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorResponse('Not authorized, token failed or expired', 401));
  }
});

// Restricts a route to specific roles, e.g. router.get('/', protect, authorize('admin'), ...)
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(
      new ErrorResponse(`Role '${req.user?.role}' is not authorized to access this route`, 403)
    );
  }
  next();
};
