# Book Review API

This completed implementation was prepared with AI assistance. Review and understand the code before making any academic submission.

Completed IBM Express Book Reviews starter project. The original ten-book catalog
in `final_project/router/booksdb.js` is unchanged.

## Run

Requires Node.js 20 or newer.

```bash
cd final_project
npm ci
npm start
```

The API listens at `http://127.0.0.1:5000`. Use `PORT=5001 npm start` to change
ports. Run `npm test` for the automated checks.

## Features

- List books; search by ISBN, author, or title; read public reviews
- Register and log in with a JWT stored in an individual server-side session
- Add or replace your own review through the `review` query parameter
- Delete only your own review; other customers' reviews remain unchanged
- Four real Axios retrieval functions in `router/general.js`, using both
  async/await and Promise callbacks
- Validation, structured errors, hashed passwords, and concurrent-user tests

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/` | List all books |
| GET | `/isbn/:isbn` | Retrieve a book by ISBN |
| GET | `/author/:author` | Retrieve every exact author match, case-insensitive |
| GET | `/title/:title` | Retrieve every exact title match, case-insensitive |
| GET | `/review/:isbn` | Read a book's reviews |
| POST | `/register` | Register using JSON `username` and `password` |
| POST | `/customer/login` | Log in and set a session cookie |
| PUT | `/customer/auth/review/:isbn?review=...` | Add/update the logged-in user's review |
| DELETE | `/customer/auth/review/:isbn` | Delete the logged-in user's review |

Use URL encoding for spaces and special characters. The username used for review
ownership is always taken from the verified session, never from request data.

## Assignment evidence

The `evidence/` directory contains actual local cURL commands followed by their
complete JSON output, captured by `npm run evidence`:

| Task | File |
| --- | --- |
| 1 | `getallbooks.txt` |
| 2 | `getbooksbyISBN.txt` |
| 3 | `getbooksbyauthor.txt` |
| 4 | `getbooksbytitle.txt` |
| 5 | `getbookreview.txt` |
| 6 | `register.txt` |
| 7 | `login.txt` |
| 8 | `reviewadded.txt` |
| 9 | `deletereview.txt` |

`reviewadded.txt` demonstrates adding two users' reviews and modifying only one.
`deletereview.txt` demonstrates deleting that user's review while preserving the
other user's review. All demonstration accounts are synthetic.

To regenerate the evidence, stop any running server on the selected port first:

```bash
cd final_project
npm run evidence
```

The script starts a clean local server, captures real responses, then stops it.
Cookies stay in a temporary directory and are removed afterwards. Files are
recorded by task, but requests run in dependency order: register, log in, add
reviews, read reviews, then delete a review.

## Asynchronous retrieval (lab Tasks 10–13)

The four exported functions are implemented in `final_project/router/general.js`:

- `getAllBooks`: async/await with Axios
- `getBookByISBN`: Axios Promise callback
- `getBooksByAuthor`: async/await with Axios
- `getBooksByTitle`: Axios Promise callback

With the server running in one terminal, use another terminal:

```bash
cd final_project
npm run async-demo
```

This makes all four HTTP requests concurrently with `Promise.all`. The server
routes read the local catalog, and the Axios client functions consume those
routes. This avoids accidentally making a route call itself forever. Tests call
all four helpers against a real HTTP server on an isolated local port and also
check failed lookups. Captured demonstration output is `evidence/axios-demo.txt`.

The lab numbers these four functions as Tasks 10–13 and repository publication as
Task 14. The current AI grading form may combine these into two questions. Follow
the grading form's labels and use the public `general.js` link for the Axios
question and the public fork link for the repository question.

## Verification

- `npm test`: 20 tests passed, including eight concurrent users
- `npm audit --omit=dev`: zero reported vulnerabilities at verification time
- All nine cURL evidence files generated successfully
- Starter `booksdb.js` preserved byte-for-byte

`evidence/test-results.txt` and `evidence/dependency-audit.txt` contain the captured
verification output.

## Educational scope

Users, reviews, and sessions are intentionally in memory, matching the starter.
They reset when the process restarts. This is a local course project, not a
production deployment: production would need persistent storage, HTTPS-secure
cookies, rate limiting, and a production session store. Optional `JWT_SECRET` and
`SESSION_SECRET` environment variables are supported; otherwise random temporary
secrets are generated on startup. Do not commit real credentials.

Course submission and honor-code confirmation are separate learner actions.
