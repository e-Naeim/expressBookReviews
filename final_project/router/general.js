const express = require('express');
const axios = require('axios');
const books = require('./booksdb');
const { isValid, validCredentials, registerUser } = require('./auth_users');
const public_users = express.Router();

public_users.post('/register', async (req, res, next) => {
  const { username, password } = req.body || {};
  if (!validCredentials(username, password)) {
    return res.status(400).json({ message: 'Provide a valid username and password.' });
  }
  if (isValid(username)) return res.status(409).json({ message: 'Username already exists.' });
  try {
    if (!(await registerUser(username, password))) {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    return res.status(201).json({ message: 'User successfully registered. You can now log in.', username });
  } catch (err) { next(err); }
});

// Tasks 1–5: public REST endpoints use the unchanged starter book catalog.
public_users.get('/', (req, res) => res.status(200).json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  return res.status(200).json(books[req.params.isbn]);
});

const findBooks = (field, value) => Object.fromEntries(
  Object.entries(books).filter(([, book]) => book[field].toLowerCase() === value.trim().toLowerCase())
);
public_users.get('/author/:author', (req, res) => {
  const matches = findBooks('author', req.params.author);
  if (!Object.keys(matches).length) return res.status(404).json({ message: 'No books found for this author.' });
  return res.status(200).json(matches);
});
public_users.get('/title/:title', (req, res) => {
  const matches = findBooks('title', req.params.title);
  if (!Object.keys(matches).length) return res.status(404).json({ message: 'No books found for this title.' });
  return res.status(200).json(matches);
});
public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  return res.status(200).json(books[req.params.isbn].reviews);
});

// Tasks 10–13 in the lab (combined in the AI rubric): real Axios HTTP calls.
// The service endpoints above read the catalog; these exported client functions
// consume them asynchronously. This separation avoids recursive self-requests.
// Run all four with `npm run async-demo` while the server is running.
const defaultBaseURL = () => `http://127.0.0.1:${process.env.PORT || 5000}`;
const client = baseURL => axios.create({ baseURL, timeout: 5000, proxy: false });

// Task 10: list every book using async/await with Axios.
async function getAllBooks(baseURL = defaultBaseURL()) {
  const response = await client(baseURL).get('/');
  return response.data;
}

// Task 11: search ISBN using Axios Promise callbacks.
function getBookByISBN(isbn, baseURL = defaultBaseURL()) {
  return client(baseURL).get(`/isbn/${encodeURIComponent(isbn)}`)
    .then(response => response.data);
}

// Task 12: search author using async/await with Axios.
async function getBooksByAuthor(author, baseURL = defaultBaseURL()) {
  const response = await client(baseURL).get(`/author/${encodeURIComponent(author)}`);
  return response.data;
}

// Task 13: search title using Axios Promise callbacks.
function getBooksByTitle(title, baseURL = defaultBaseURL()) {
  return client(baseURL).get(`/title/${encodeURIComponent(title)}`)
    .then(response => response.data);
}

module.exports = { general: public_users, getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle };
