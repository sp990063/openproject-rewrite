#!/usr/bin/env bash
# =====================================================================
# Pre-deploy check — verifies everything is ready before
# `docker compose up`. Run on the deploy host (or in CI).
# =====================================================================
# Exit on any failure. Use `bash scripts/predeploy-check.sh` to run.
set -euo pipefail

# --- Color output (skip if not a TTY) ---
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

echo "=== OpenProject Rewrite — pre-deploy check ==="
echo

# --- 1. Docker is installed + daemon running ---
command -v docker >/dev/null 2>&1 || fail "docker not installed"
docker info >/dev/null 2>&1       || fail "docker daemon not running (try: sudo systemctl start docker)"
ok "Docker $(docker --version) running"

# --- 2. docker compose v2 ---
docker compose version >/dev/null 2>&1 || fail "docker compose v2 not installed (apt: docker-compose-plugin)"
ok "docker compose $(docker compose version --short)"

# --- 3. .env.production exists ---
[ -f .env.production ] || fail ".env.production not found. Copy from .env.production.example and fill in values."
ok ".env.production exists"

# --- 4. Required env vars are set + non-empty ---
required_vars=(
  DATABASE_URL
  POSTGRES_PASSWORD
  NEXTAUTH_URL
  NEXTAUTH_SECRET
  REDIS_URL
  SMTP_HOST
  SMTP_USER
  SMTP_PASSWORD
  EMAIL_FROM
  CRON_SECRET
)

set +e
# shellcheck disable=SC1091
source .env.production
set -e

for var in "${required_vars[@]}"; do
  eval val="\${$var:-}"
  if [ -z "$val" ]; then
    fail "Required env var $var is empty in .env.production"
  fi
  ok "$var is set"
done

# --- 5. NEXTAUTH_SECRET is long enough (32+ chars recommended) ---
if [ "${#NEXTAUTH_SECRET}" -lt 32 ]; then
  fail "NEXTAUTH_SECRET must be at least 32 chars (got ${#NEXTAUTH_SECRET}). Generate: openssl rand -base64 32"
fi
ok "NEXTAUTH_SECRET is ${#NEXTAUTH_SECRET} chars"

# --- 6. NEXTAUTH_URL is HTTPS in production ---
if [[ "$NEXTAUTH_URL" == http://* ]] && [[ "$NEXTAUTH_URL" != "http://localhost"* ]]; then
  warn "NEXTAUTH_URL is HTTP, not HTTPS. Acceptable for local testing, but production should use HTTPS."
else
  ok "NEXTAUTH_URL is $NEXTAUTH_URL"
fi

# --- 7. Port not already bound ---
APP_PORT="${APP_PORT:-3000}"
if ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
  fail "Port $APP_PORT is already in use. Stop the existing service or set APP_PORT=... in .env.production"
fi
ok "Port $APP_PORT is free"

# --- 8. Disk space (need ~2GB for image + node_modules) ---
FREE_MB=$(df -m . | tail -1 | awk '{print $4}')
if [ "$FREE_MB" -lt 2048 ]; then
  warn "Less than 2GB free disk space (got ${FREE_MB}MB). Build may fail."
else
  ok "${FREE_MB}MB free disk"
fi

# --- 9. Memory (need ~1GB free for docker build) ---
MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}' || echo "0")
if [ "$MEM_MB" -lt 512 ]; then
  warn "Less than 512MB free memory (got ${MEM_MB}MB). Build may swap."
else
  ok "${MEM_MB}MB free memory"
fi

# --- 10. Dockerfile + docker-compose.yml + .env.production.example present ---
[ -f Dockerfile ]           || fail "Dockerfile missing"
[ -f docker-compose.yml ]   || fail "docker-compose.yml missing"
[ -f .env.production.example ] || fail ".env.production.example missing (users need this to bootstrap)"
ok "All deploy files present"

echo
echo -e "${GREEN}=== Pre-deploy check passed. Ready to run: ===${NC}"
echo "  docker compose --env-file .env.production -f docker-compose.yml build"
echo "  docker compose --env-file .env.production -f docker-compose.yml up -d"
echo "  docker compose logs -f app    # to watch startup"
