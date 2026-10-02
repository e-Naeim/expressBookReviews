#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$(cd "$PROJECT_DIR/.." && pwd)/evidence"
TEMP_DIR="$(mktemp -d)"
PORT="${PORT:-5000}"
BASE="http://127.0.0.1:$PORT"
SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
mkdir -p "$OUTPUT_DIR"
cd "$PROJECT_DIR"
# Refuse to send test mutations to an unrelated process on the selected port.
if curl --silent --max-time 1 "$BASE/" >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Stop that server or choose another PORT." >&2
  exit 1
fi
PORT="$PORT" HOST=127.0.0.1 node index.js >"$TEMP_DIR/server.log" 2>&1 &
SERVER_PID=$!
READY=0
for attempt in {1..100}; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then cat "$TEMP_DIR/server.log" >&2; exit 1; fi
  if curl --silent --fail "$BASE/" >/dev/null; then READY=1; break; fi
  sleep 0.1
done
if [[ "$READY" != 1 ]]; then echo 'Test server did not become ready.' >&2; exit 1; fi
cd "$TEMP_DIR"
record() {
  local filename="$1"; shift
  { printf '$ '; printf '%q ' "$@"; printf '\n'; "$@"; printf '\n\n'; } >>"$OUTPUT_DIR/$filename.txt"
}
for name in getallbooks getbooksbyISBN getbooksbyauthor getbooksbytitle getbookreview register login reviewadded deletereview; do
  : >"$OUTPUT_DIR/$name.txt"
done
record getallbooks curl --silent --show-error --fail-with-body "$BASE/"
record getbooksbyISBN curl --silent --show-error --fail-with-body "$BASE/isbn/1"
record getbooksbyauthor curl --silent --show-error --fail-with-body "$BASE/author/Unknown"
record getbooksbytitle curl --silent --show-error --fail-with-body "$BASE/title/Things%20Fall%20Apart"
record register curl --silent --show-error --fail-with-body -X POST "$BASE/register" -H 'Content-Type: application/json' -d '{"username":"demo_alice","password":"Synthetic-demo-123"}'
record register curl --silent --show-error --fail-with-body -X POST "$BASE/register" -H 'Content-Type: application/json' -d '{"username":"demo_bob","password":"Synthetic-demo-456"}'
record login curl --silent --show-error --fail-with-body -c alice-cookies.txt -X POST "$BASE/customer/login" -H 'Content-Type: application/json' -d '{"username":"demo_alice","password":"Synthetic-demo-123"}'
record login curl --silent --show-error --fail-with-body -c bob-cookies.txt -X POST "$BASE/customer/login" -H 'Content-Type: application/json' -d '{"username":"demo_bob","password":"Synthetic-demo-456"}'
record reviewadded curl --silent --show-error --fail-with-body -b alice-cookies.txt -X PUT "$BASE/customer/auth/review/1?review=A%20thoughtful%20and%20powerful%20novel."
record reviewadded curl --silent --show-error --fail-with-body -b bob-cookies.txt -X PUT "$BASE/customer/auth/review/1?review=Rich%20characters%20and%20memorable%20storytelling."
record reviewadded curl --silent --show-error --fail-with-body -b alice-cookies.txt -X PUT "$BASE/customer/auth/review/1?review=Updated%3A%20a%20powerful%20portrait%20of%20culture%20and%20change."
record getbookreview curl --silent --show-error --fail-with-body "$BASE/review/1"
record deletereview curl --silent --show-error --fail-with-body -b alice-cookies.txt -X DELETE "$BASE/customer/auth/review/1"
record deletereview curl --silent --show-error --fail-with-body "$BASE/review/1"
cd "$PROJECT_DIR"
{ printf '$ npm run async-demo\n\n'; PORT="$PORT" npm run async-demo; } >"$OUTPUT_DIR/axios-demo.txt"
printf 'Generated all nine requested cURL evidence files and axios-demo.txt in %s\n' "$OUTPUT_DIR"
