const jwt = require('jsonwebtoken');

// Signs a JWT containing the user's id and role. The role is included so
// authorization checks don't need an extra DB round trip on every request.
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });

module.exports = generateToken;
