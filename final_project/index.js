const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { authenticated: customerRoutes, isValid } = require('./router/auth_users');
const { general: generalRoutes } = require('./router/general');
const { jwtSecret, sessionSecret } = require('./config');

const app = express();
app.disable('x-powered-by');
app.set('json spaces', 2);
app.use(express.json({ limit: '16kb' }));
app.use('/customer', session({
  name: 'bookshop.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 60 * 60 * 1000 }
}));

// Authenticate every protected route using the JWT saved in this session.
app.use('/customer/auth', (req, res, next) => {
  const authorization = req.session.authorization;
  if (!authorization) return res.status(401).json({ message: 'Please log in first.' });
  try {
    const payload = jwt.verify(authorization.accessToken, jwtSecret, {
      algorithms: ['HS256'], issuer: 'bookshop', audience: 'bookshop-customer'
    });
    if (payload.sub !== authorization.username || !isValid(payload.sub)) {
      return res.status(401).json({ message: 'Invalid session. Please log in again.' });
    }
    req.username = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
});

app.use('/customer', customerRoutes);
app.use('/', generalRoutes);
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large.' });
  console.error(err.message);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`Book Review API running at http://${process.env.HOST || '127.0.0.1'}:${port}`);
  });
}
module.exports = app;
