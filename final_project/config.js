const { randomBytes } = require('node:crypto');

// Local educational app: secrets are regenerated at restart unless supplied by
// the environment. Never commit real production secrets.
module.exports = {
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  jwtOptions: { algorithm: 'HS256', expiresIn: '1h', issuer: 'bookshop', audience: 'bookshop-customer' }
};
