// Lightweight, dependency-free middleware guarding against stored-XSS and
// NoSQL/MongoDB operator injection in request input.
//
// We deliberately don't use `xss-clean` or `express-mongo-sanitize` here:
// both are effectively unmaintained, and both run into the same subtle bug
// on modern Express - `req.query` is defined with only a getter, so doing
// `req.query = sanitizedValue` silently no-ops (or throws in strict mode)
// instead of actually replacing it. This implementation instead uses
// Object.defineProperty to properly swap the accessor, which works
// regardless of Express version.
//
// req.params is intentionally left alone: it isn't populated yet at the
// point global middleware runs (Express fills it in during route matching),
// and the only param this API uses (Mongo `:id`) is already safely
// validated by Mongoose's ObjectId casting (invalid values become a
// CastError, handled in middleware/error.js).

const isPlainObject = (val) => val !== null && typeof val === 'object' && !Array.isArray(val);

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    // Neutralize angle brackets so stored input can never be interpreted as
    // HTML/script when later rendered on the client.
    return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (isPlainObject(value)) {
    return sanitizeObject(value);
  }
  return value;
};

const sanitizeObject = (obj) => {
  const clean = {};
  Object.keys(obj).forEach((key) => {
    // Drop any key that looks like a Mongo operator ($gt, $where) or a
    // dotted path - both are how NoSQL-injection payloads are shaped.
    if (key.startsWith('$') || key.includes('.')) return;
    clean[key] = sanitizeValue(obj[key]);
  });
  return clean;
};

const sanitizeRequest = (req, res, next) => {
  if (isPlainObject(req.body)) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && Object.keys(req.query).length) {
    const sanitizedQuery = sanitizeObject(req.query);
    Object.defineProperty(req, 'query', {
      value: sanitizedQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  next();
};

module.exports = sanitizeRequest;
