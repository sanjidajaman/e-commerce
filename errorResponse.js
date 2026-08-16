// A regular Error subclass that also carries an HTTP status code, so the
// central error handler knows what status to respond with.
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorResponse;
