const ErrorResponse = require('../utils/errorResponse');

const notFound = (req, res, next) => {
  next(new ErrorResponse(`Route not found - ${req.originalUrl}`, 404));
};

// Single place that turns any error (thrown, passed to next(), or a raw
// Mongoose/JWT error) into a consistent JSON response shape.
const errorHandler = (err, req, res, next) => {
  let error = { statusCode: err.statusCode, message: err.message };

  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  if (err.name === 'CastError') {
    error = { statusCode: 404, message: 'Resource not found' };
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = { statusCode: 400, message: `Duplicate value entered for: ${field}` };
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = { statusCode: 400, message };
  }

  if (err.name === 'JsonWebTokenError') {
    error = { statusCode: 401, message: 'Invalid token' };
  }

  if (err.name === 'TokenExpiredError') {
    error = { statusCode: 401, message: 'Token expired, please log in again' };
  }

  if (err.type === 'entity.too.large') {
    error = { statusCode: 413, message: 'Request payload too large' };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
  });
};

module.exports = { notFound, errorHandler };
