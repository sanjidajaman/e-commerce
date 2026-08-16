// Wraps an async Express route handler so any rejected promise (thrown
// error) is forwarded to next(), landing in the central error middleware
// instead of crashing the process or requiring try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
