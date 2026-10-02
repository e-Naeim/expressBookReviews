const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../index');
const books = require('../router/booksdb');
const { users } = require('../router/auth_users');
const { getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle } = require('../router/general');
let server;
let baseURL;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  users.length = 0;
  for (const book of Object.values(books)) book.reviews = {};
});

async function request(path, { method = 'GET', data, cookie } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {})
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
const register = (username, password = 'demo-password') => request('/register', { method: 'POST', data: { username, password } });
async function login(username) {
  await register(username);
  const result = await request('/customer/login', { method: 'POST', data: { username, password: 'demo-password' } });
  assert.equal(result.status, 200);
  assert.ok(result.cookie);
  return result.cookie;
}
const review = (cookie, text, isbn = '1', extra = '') => request(`/customer/auth/review/${isbn}?review=${encodeURIComponent(text)}${extra}`, { method: 'PUT', cookie });

test('Task 1: all ten original books are returned', async () => {
  const result = await request('/');
  assert.equal(result.status, 200);
  assert.equal(Object.keys(result.body).length, 10);
  assert.equal(result.body['1'].author, 'Chinua Achebe');
  assert.equal(result.body['10'].title, 'Molloy, Malone Dies, The Unnamable, the trilogy');
});
test('Task 2: ISBN lookup returns its book', async () => {
  const result = await request('/isbn/8');
  assert.equal(result.status, 200);
  assert.equal(result.body.title, 'Pride and Prejudice');
});
test('Task 3: author lookup returns all matching books', async () => {
  const result = await request('/author/Unknown');
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body), ['4', '5', '6', '7']);
});
test('Task 4: title lookup handles encoded spaces and case', async () => {
  const result = await request('/title/things%20fall%20apart');
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body), ['1']);
});
test('Task 5: reviews are public and initially empty', async () => {
  const result = await request('/review/1');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {});
});
test('Unknown ISBN, author, title and inherited object keys return 404', async () => {
  for (const path of ['/isbn/999', '/review/999', '/author/nobody', '/title/missing', '/isbn/toString', '/review/__proto__']) {
    assert.equal((await request(path)).status, 404, path);
  }
});
test('Task 6: registration succeeds and passwords are hashed', async () => {
  const result = await register('alice');
  assert.equal(result.status, 201);
  assert.equal(users.length, 1);
  assert.equal(users[0].password, undefined);
  assert.notEqual(users[0].passwordHash, 'demo-password');
});
test('Registration rejects missing, invalid, duplicate and unsafe usernames', async () => {
  for (const data of [{}, { username: 'alice' }, { username: 'alice', password: '' }, { username: [], password: 'x' }, { username: '__proto__', password: 'x' }]) {
    assert.equal((await request('/register', { method: 'POST', data })).status, 400);
  }
  await register('alice');
  assert.equal((await register('alice')).status, 409);
});
test('Concurrent registration cannot create duplicate accounts', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => register('sameuser')));
  assert.equal(results.filter(result => result.status === 201).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 3);
  assert.equal(users.length, 1);
});
test('Task 7: valid login creates an HttpOnly session cookie', async () => {
  await register('alice');
  const result = await request('/customer/login', { method: 'POST', data: { username: 'alice', password: 'demo-password' } });
  assert.equal(result.status, 200);
  assert.match(result.headers.get('set-cookie'), /HttpOnly/);
  assert.match(result.headers.get('set-cookie'), /SameSite=Strict/);
  assert.equal(result.body.username, 'alice');
});
test('Login rejects bad passwords, unregistered users and missing fields', async () => {
  await register('alice');
  assert.equal((await request('/customer/login', { method: 'POST', data: { username: 'alice', password: 'wrong' } })).status, 401);
  assert.equal((await request('/customer/login', { method: 'POST', data: { username: 'bob', password: 'demo-password' } })).status, 401);
  assert.equal((await request('/customer/login', { method: 'POST', data: {} })).status, 400);
});
test('Anonymous and tampered-cookie clients cannot add or delete reviews', async () => {
  assert.equal((await review(undefined, 'Blocked')).status, 401);
  assert.equal((await review('bookshop.sid=forged', 'Blocked')).status, 401);
  assert.equal((await request('/customer/auth/review/1', { method: 'DELETE' })).status, 401);
  assert.deepEqual(books['1'].reviews, {});
});
test('Task 8: add and update only the current user review', async () => {
  const cookie = await login('alice');
  assert.equal((await review(cookie, 'First review')).status, 200);
  const result = await review(cookie, 'Updated review');
  assert.match(result.body.message, /updated/);
  assert.deepEqual((await request('/review/1')).body, { alice: 'Updated review' });
});
test('Different users keep separate reviews and cannot spoof another username', async () => {
  const alice = await login('alice');
  const bob = await login('bob');
  await review(alice, 'Alice review');
  await review(bob, 'Bob review', '1', '&username=alice');
  assert.deepEqual((await request('/review/1')).body, { alice: 'Alice review', bob: 'Bob review' });
});
test('Task 9: deleting own review preserves another user review', async () => {
  const alice = await login('alice');
  const bob = await login('bob');
  await review(alice, 'Alice review');
  await review(bob, 'Bob review');
  const result = await request('/customer/auth/review/1?username=bob', { method: 'DELETE', cookie: alice });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.reviews, { bob: 'Bob review' });
  assert.equal((await request('/customer/auth/review/1?username=bob', { method: 'DELETE', cookie: alice })).status, 404);
  assert.deepEqual((await request('/review/1')).body, { bob: 'Bob review' });
});
test('Review validation handles missing, blank, repeated, oversized and unknown book', async () => {
  const cookie = await login('alice');
  for (const path of ['/customer/auth/review/1', '/customer/auth/review/1?review=%20', '/customer/auth/review/1?review=a&review=b']) {
    assert.equal((await request(path, { method: 'PUT', cookie })).status, 400);
  }
  assert.equal((await review(cookie, 'a'.repeat(2001))).status, 400);
  assert.equal((await review(cookie, 'Good', '999')).status, 404);
  assert.equal((await request('/customer/auth/review/999', { method: 'DELETE', cookie })).status, 404);
});
test('Eight concurrent users retain separate sessions and reviews', async () => {
  const cookies = await Promise.all(Array.from({ length: 8 }, (_, i) => login(`reader${i}`)));
  const results = await Promise.all(cookies.map((cookie, i) => review(cookie, `Review ${i}`)));
  assert.ok(results.every(result => result.status === 200));
  const result = await request('/review/1');
  assert.equal(Object.keys(result.body).length, 8);
  for (let i = 0; i < 8; i++) assert.equal(result.body[`reader${i}`], `Review ${i}`);
});
test('Task 10–13: all four Axios functions make successful concurrent HTTP requests', async () => {
  const [all, isbn, author, title] = await Promise.all([
    getAllBooks(baseURL), getBookByISBN('8', baseURL), getBooksByAuthor('Unknown', baseURL), getBooksByTitle('Things Fall Apart', baseURL)
  ]);
  assert.equal(Object.keys(all).length, 10);
  assert.equal(isbn.title, 'Pride and Prejudice');
  assert.deepEqual(Object.keys(author), ['4', '5', '6', '7']);
  assert.equal(title['1'].author, 'Chinua Achebe');
});
test('Axios retrieval helpers propagate failed HTTP requests to the caller', async () => {
  await assert.rejects(getBookByISBN('999', baseURL), error => error.response.status === 404);
  await assert.rejects(getBooksByAuthor('nobody', baseURL), error => error.response.status === 404);
  await assert.rejects(getBooksByTitle('missing', baseURL), error => error.response.status === 404);
});
test('Malformed JSON and unknown routes return structured errors', async () => {
  const response = await fetch(`${baseURL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Invalid JSON body.');
  assert.equal((await request('/missing-route')).status, 404);
});
