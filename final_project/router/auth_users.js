const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const books = require('./booksdb');
const { jwtSecret, jwtOptions } = require('../config');
const scrypt = promisify(scryptCallback);
const regd_users = express.Router();
const users = [];

const validCredentials = (username, password) => (
  typeof username === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(username) &&
  !['__proto__', 'constructor', 'prototype'].includes(username) &&
  typeof password === 'string' && password.trim().length > 0 && password.length <= 256
);
const isValid = username => users.some(user => user.username === username);
const authenticatedUser = async (username, password) => {
  const user = users.find(candidate => candidate.username === username);
  if (!user || !validCredentials(username, password)) return false;
  const hash = await scrypt(password, user.salt, 64);
  return timingSafeEqual(hash, Buffer.from(user.passwordHash, 'hex'));
};

// Hash synthetic/local passwords rather than storing plaintext credentials.
const registerUser = async (username, password) => {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
  // Recheck after awaiting the hash so simultaneous registrations cannot duplicate.
  if (isValid(username)) return false;
  users.push({ username, salt, passwordHash });
  return true;
};

regd_users.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  if (!validCredentials(username, password)) {
    return res.status(400).json({ message: 'Provide a valid username and password.' });
  }
  try {
    if (!(await authenticatedUser(username, password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    // Rotate the session ID on login. Each client keeps its own cookie.
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.authorization = {
        username,
        accessToken: jwt.sign({}, jwtSecret, { ...jwtOptions, subject: username })
      };
      req.session.save(error => {
        if (error) return next(error);
        return res.status(200).json({ message: 'Customer successfully logged in.', username });
      });
    });
  } catch (err) { next(err); }
});

// Task 8: use ?review=..., and derive ownership only from the verified session.
regd_users.put('/auth/review/:isbn', (req, res) => {
  const { isbn } = req.params;
  if (!Object.hasOwn(books, isbn)) return res.status(404).json({ message: 'Book not found.' });
  const review = req.query.review;
  if (typeof review !== 'string' || !review.trim() || review.length > 2000) {
    return res.status(400).json({ message: 'Provide a non-empty review query parameter (maximum 2000 characters).' });
  }
  const updated = Object.hasOwn(books[isbn].reviews, req.username);
  books[isbn].reviews[req.username] = review.trim();
  return res.status(200).json({
    message: updated ? 'Review successfully updated.' : 'Review successfully added.',
    isbn, reviews: books[isbn].reviews
  });
});

// Task 9: user-supplied usernames never select the review being deleted.
regd_users.delete('/auth/review/:isbn', (req, res) => {
  const { isbn } = req.params;
  if (!Object.hasOwn(books, isbn)) return res.status(404).json({ message: 'Book not found.' });
  if (!Object.hasOwn(books[isbn].reviews, req.username)) {
    return res.status(404).json({ message: 'You have no review for this book.' });
  }
  delete books[isbn].reviews[req.username];
  return res.status(200).json({ message: 'Your review was successfully deleted.', isbn, reviews: books[isbn].reviews });
});

module.exports = { authenticated: regd_users, isValid, authenticatedUser, validCredentials, registerUser, users };
