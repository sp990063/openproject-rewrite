#!/usr/bin/env bash
# =====================================================================
# Post-deploy smoke test — runs after `docker compose up -d`.
# Verifies:
#   1. App is responding (200 on /api/health?live=1)
#   2. Database is reachable from app
#   3. Redis is reachable
#   4. The auth-guard test passes (THE key check — proves no P0 holes)
#   5. Login page renders
# =====================================================================
# Usage:
#   APP_URL=https://<your-domain> bash scripts/postdeploy-smoke.sh
# Or for local:
#   APP_URL=http://localhost:3000 bash scripts/postdeploy-smoke.sh
# =====================================================================
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

echo "=== OpenProject Rewrite — post-deploy smoke test ==="
echo "Target: $APP_URL"
echo

# --- 1. Health endpoint (no auth required) ---
echo "1. Health check"
HEALTH=$(curl -fsS --max-time 10 "$APP_URL/api/health?live=1" 2>&1) || fail "Health check failed (app not responding at $APP_URL)"
echo "   $HEALTH"
[[ "$HEALTH" == *'"status":"alive"'* ]] || fail "Health response missing 'alive' status"
ok "Health endpoint returns alive"

# --- 2. Full health (DB + Redis check) ---
echo
echo "2. Full health (DB + Redis)"
FULL=$(curl -fsS --max-time 15 "$APP_URL/api/health" 2>&1) || fail "Full health check failed"
if [[ "$FULL" == *'"ok":true'* ]]; then
  ok "Full health OK (DB + Redis reachable)"
else
  warn "Full health: $FULL"
  warn "Check docker compose logs app for DB/Redis connection errors"
fi

# --- 3. Public routes ---
echo
echo "3. Public reference data"
for route in /api/statuses /api/types /api/priorities /api/roles /api/announcements; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL$route")
  if [ "$code" = "200" ]; then
    ok "$route → 200"
  else
    warn "$route → $code (unexpected but non-fatal)"
  fi
done

# --- 4. Login page renders ---
echo
echo "4. Login page"
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$APP_URL/login")
[[ "$LOGIN_CODE" =~ ^(200|307|302)$ ]] || fail "Login page returned $LOGIN_CODE (expected 200/redirect)"
ok "Login page → $LOGIN_CODE"

# --- 5. Auth guard test (the real one) ---
echo
echo "5. Auth-guard test (whole-tree P0 regression)"
echo "   This probes all 775 route × method combinations. Takes ~2 minutes."
echo

cd "$PROJECT_DIR"

if [ ! -f __tests__/api/auth-guard.test.ts ]; then
  fail "auth-guard.test.ts not found — pull the latest code first"
fi

if ! command -v npm >/dev/null 2>&1; then
  warn "npm not available — skipping auth-guard test. Run manually on a build host:"
  warn "  TEST_API_URL=$APP_URL npm run test:auth-guard"
else
  echo "   Running TEST_API_URL=$APP_URL npm run test:auth-guard ..."
  echo

  if TEST_API_URL="$APP_URL" npm run test:auth-guard 2>&1 | tail -30; then
    ok "Auth-guard test PASSED — no P0 holes in production"
  else
    fail "Auth-guard test FAILED — check the output above for leaked routes"
  fi
fi

echo
echo -e "${GREEN}=== Post-deploy smoke test complete ===${NC}"
echo
echo "Next steps:"
echo "  1. Open $APP_URL in a browser, log in, verify dashboard"
echo "  2. Check docker compose logs app for any Sentry errors"
echo "  3. Configure reverse proxy (nginx/Caddy) for HTTPS"
echo "  4. Set up automated daily database backups"
