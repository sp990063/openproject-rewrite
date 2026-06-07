# OpenProject Rewrite — Deployment Guide

> **Audience:** DevOps engineer doing the first on-prem Docker deploy.
> **Owner:** boss (Vicky)
> **Last updated:** 2026-06-08 (Phase 7 Sprint E)

This document walks through the entire on-prem Docker deployment, from a fresh
host to a running app. If anything is unclear, see `scripts/predeploy-check.sh`
and `scripts/postdeploy-smoke.sh` — the bash comments explain each check.

---

## TL;DR

```bash
# 1. Get the code
git clone https://github.com/sp990063/openproject-rewrite.git
cd openproject-rewrite

# 2. Configure env (one-time)
cp .env.production.example .env.production
# Edit .env.production — set NEXTAUTH_SECRET, NEXTAUTH_URL, passwords

# 3. Pre-flight
bash scripts/predeploy-check.sh

# 4. Build + run
docker compose --env-file .env.production -f docker-compose.yml build
docker compose --env-file .env.production -f docker-compose.yml up -d

# 5. Migrate database (one-time per schema change)
docker compose exec app npx prisma migrate deploy

# 6. Verify
bash scripts/postdeploy-smoke.sh
```

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker Engine | 24.0+ | `docker --version` |
| docker compose v2 | 2.20+ | Bundled with Docker Desktop / `docker-compose-plugin` on Linux |
| Free disk | 5 GB | Image + node_modules + DB volume |
| Free RAM | 1 GB | Build needs ~1 GB peak |
| Outbound HTTPS | yes | For Sentry, npm registry, OAuth callbacks |

**Network ports**:
- 3000 (app) — proxied through your reverse proxy
- 5432 (postgres) — **internal only**, do not expose
- 6379 (redis) — **internal only**, do not expose

---

## 2. Host preparation (one-time per host)

### 2.1 Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # log out + back in
```

### 2.2 Create deploy directory
```bash
sudo mkdir -p /opt/openproject-rewrite
sudo chown $USER:$USER /opt/openproject-rewrite
cd /opt/openproject-rewrite
git clone https://github.com/sp990063/openproject-rewrite.git .
```

### 2.3 Set up reverse proxy (HTTPS termination)
The app expects to be reached over HTTPS. Use your existing reverse proxy (nginx,
Caddy, Traefik, etc.) to forward `https://app.your-domain.com` → `http://localhost:3000`.

**Caddy example** (if you want zero-config HTTPS):
```caddyfile
app.your-domain.com {
    reverse_proxy localhost:3000
}
```

**nginx example**:
```nginx
server {
    listen 443 ssl http2;
    server_name app.your-domain.com;
    ssl_certificate     /etc/letsencrypt/live/app.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Configure environment variables

```bash
cp .env.production.example .env.production
nano .env.production  # or vim, code, etc.
```

**Required (must be filled in)**:

| Variable | How to get it |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://app.your-domain.com` (must match reverse proxy) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` — keep stable across deploys (rotating it logs everyone out) |
| `SMTP_PASSWORD` | From your SMTP provider (Mailgun, SES, etc.) |
| `CRON_SECRET` | `openssl rand -hex 32` — shared with any external cron caller |

**Optional** (leave empty to disable):
- `S3_*` — leave empty to use local filesystem storage
- `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` — leave empty to disable that OAuth provider
- `SENTRY_*` — leave empty to disable Sentry

**After editing**, verify with `bash scripts/predeploy-check.sh` — it catches
missing/empty variables and weak secrets.

---

## 4. Build and start

```bash
# Build the image (5-10 minutes the first time; 30s on rebuild)
docker compose --env-file .env.production -f docker-compose.yml build

# Start the stack in the background
docker compose --env-file .env.production -f docker-compose.yml up -d

# Tail logs to see startup
docker compose logs -f app
```

You should see:
```
app-1  | ▲ Next.js 15.5.15
app-1  | - Local:        http://0.0.0.0:3000
app-1  | ✓ Ready in 4.2s
```

`Ctrl-C` to stop tailing (the app keeps running).

---

## 5. Database migration (first deploy only, and after every schema change)

```bash
# Apply all pending Prisma migrations
docker compose exec app npx prisma migrate deploy
```

**Seed the database** (optional, creates demo data):
```bash
docker compose exec app npx prisma db seed
```

This creates a default admin user. Check the console output for the credentials.

---

## 6. Post-deploy smoke test

```bash
# For local host
APP_URL=http://localhost:3000 bash scripts/postdeploy-smoke.sh

# For public domain
APP_URL=https://app.your-domain.com bash scripts/postdeploy-smoke.sh
```

This runs 5 checks:
1. **Health endpoint** (liveness probe)
2. **Full health** (DB + Redis reachable)
3. **Public reference data** (statuses, types, priorities, roles, announcements)
4. **Login page** renders
5. **Auth-guard test** — 775 route × method probes, the actual security regression check

A green pass on all 5 means the deploy is verified.

---

## 7. Common operations

### View logs
```bash
docker compose logs -f app            # all logs
docker compose logs --tail=100 app    # last 100 lines
docker compose logs app | grep ERROR # just errors
```

### Restart the app (after config change)
```bash
docker compose restart app
```

### Update the code (new release)
```bash
cd /opt/openproject-rewrite
git pull
docker compose --env-file .env.production -f docker-compose.yml build app
docker compose --env-file .env.production -f docker-compose.yml up -d app
docker compose exec app npx prisma migrate deploy  # if schema changed
```

### Backup the database
```bash
docker compose exec -T db pg_dump -U oprw openproject | gzip > backup-$(date +%F).sql.gz
```

### Restore the database
```bash
gunzip -c backup-2026-06-08.sql.gz | docker compose exec -T db psql -U oprw openproject
```

### Rotate `NEXTAUTH_SECRET` (logs everyone out, but doesn't lose data)
1. Generate new secret: `openssl rand -base64 32`
2. Edit `.env.production`, replace the value
3. `docker compose restart app`

### Tear down (keeps data volumes)
```bash
docker compose down
```

### Wipe EVERYTHING (including data — DESTRUCTIVE)
```bash
docker compose down -v
```

---

## 8. Rollback plan

If a deploy goes wrong:

```bash
# Find the previous working image tag
docker images openproject-rewrite

# Edit docker-compose.yml to pin a specific image tag:
#   image: openproject-rewrite:<previous-sha>
# OR rebuild from the previous commit:
cd /opt/openproject-rewrite
git log --oneline -5
git checkout <previous-sha>
docker compose --env-file .env.production -f docker-compose.yml build app
docker compose --env-file .env.production -f docker-compose.yml up -d app
```

**Database rollback**: if a migration broke something, restore from backup
(see §7) BEFORE running the new code.

---

## 9. Security checklist

Before going live to real users:

- [ ] `NEXTAUTH_URL` is HTTPS (not HTTP)
- [ ] `NEXTAUTH_SECRET` is 32+ random chars (not a dictionary word)
- [ ] `POSTGRES_PASSWORD` is 32+ random chars
- [ ] `CRON_SECRET` is 32+ random chars
- [ ] `.env.production` is **not** committed to git (verify with `git status`)
- [ ] Reverse proxy strips incoming `X-Forwarded-Proto` headers
- [ ] Postgres port 5432 is **not** exposed publicly
- [ ] Redis port 6379 is **not** exposed publicly
- [ ] Daily database backup is scheduled (cron + off-host copy)
- [ ] Sentry is configured (or you have a plan for log monitoring)
- [ ] Uptime monitoring on `https://app.your-domain.com/api/health?live=1`

---

## 10. Troubleshooting

### App won't start
```bash
docker compose logs app
# Common causes:
# - "Can't reach database" → check DATABASE_URL matches POSTGRES_USER/POSTGRES_PASSWORD
# - "EADDRINUSE :::3000" → port 3000 already in use, change APP_PORT
# - "Prisma client not generated" → rebuild the image (`docker compose build --no-cache app`)
```

### Auth-guard test fails
This is the security regression test. If it fails, **DO NOT DEPLOY**.

```bash
# Run with verbose output to see the leaked route
TEST_API_URL=https://app.your-domain.com npm run test:auth-guard
```

A failure means a route returns 200 with data to an unauthenticated caller.
This is a P0 security hole. Either:
1. Add the missing auth gate to the route (follow the A1 pattern: `getServerSession` + 401)
2. If the route is genuinely public, add it to `PUBLIC_ROUTES` in `__tests__/api/auth-guard.test.ts` with a justification

### Login fails with "Configuration error"
`NEXTAUTH_URL` doesn't match the URL the user is visiting. Check:
```bash
docker compose exec app printenv NEXTAUTH_URL
# Should match the URL in the browser
```

### Database migration fails
```bash
docker compose logs app | grep -i prisma
# If "migration failed" → check db is healthy first
docker compose ps db
```

---

## 11. Architecture

```
                          ┌─────────────────────┐
                          │   nginx / Caddy     │
                          │  (HTTPS termination │
                          │   on host:443)      │
                          └──────────┬──────────┘
                                     │ http://app:3000
                                     ▼
                          ┌─────────────────────┐
                          │   openproject-      │
                          │   rewrite container │
                          │   (Node 20,         │
                          │   Next.js 15        │
                          │   standalone)       │
                          └────┬────────────┬───┘
                               │            │
                       postgresql://      redis://
                               │            │
                               ▼            ▼
                     ┌──────────────┐  ┌──────────┐
                     │  postgres:16 │  │  redis:7 │
                     │  (data vol)  │  │  (cache) │
                     └──────────────┘  └──────────┘
```

All three services run in a private `oprw-net` Docker network. Only port 3000
is exposed to the host (which your reverse proxy then serves on 443).

---

## 12. Related

- **Security model**: see `__tests__/api/auth-guard.test.ts` (whole-tree regression guard)
- **Env vars template**: `.env.production.example`
- **Sprint E handover**: `~/.hermes/handover-notes/2026-06-08-openproject-rewrite-phase7-e-complete.md`
- **Pre-7 handover notes**: `~/.hermes/handover-notes/2026-06-07-openproject-rewrite-phase{4,5,6,7}-complete.md`
