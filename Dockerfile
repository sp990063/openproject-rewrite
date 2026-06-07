# =====================================================================
# OpenProject Rewrite — production Dockerfile
# =====================================================================
# Uses Next.js 15 `output: 'standalone'` (next.config.ts) to produce a
# self-contained Node server. The standalone output excludes node_modules
# not used at runtime, giving a smaller final image.
#
# Build:    docker build -t openproject-rewrite:$(git rev-parse --short HEAD) .
# Run:      docker run -d --name openproject-rewrite -p 3000:3000 \
#             --env-file .env.production openproject-rewrite:latest
# Inspect:  docker exec openproject-rewrite node -e "console.log(process.env.DATABASE_URL ? 'db ok' : 'no db')"
#
# Why multi-stage:
#   - deps:    full devDeps for `prisma generate` (needs the engine binary)
#   - builder: produces .next/standalone + static + public
#   - runner:  minimal alpine + non-root user + only runtime artifacts
#
# Why non-root: best-practice; Next.js standalone image runs as root by default.
# Why node:20-alpine: LTS, 3-year support, small (45MB base).
# Why standalone vs full .next: image size ~150MB vs ~600MB.

# --- Stage 1: deps (install ALL deps incl. devDeps for prisma generate) ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy lockfile first for layer caching
COPY package.json package-lock.json* ./
# Prisma needs openssl at install time (postinstall hook)
RUN npm ci --include=dev

# --- Stage 2: builder (compile, generate prisma client, build next) ---
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client — generate from schema
RUN npx prisma generate

# Build Next.js (output: 'standalone' is in next.config.ts)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# --- Stage 3: runner (minimal runtime image) ---
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl dumb-init wget
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user (Next.js standalone image ships as root by default)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server + static assets + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma client + schema (needed at runtime for `prisma migrate` and queries)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# Health check: GET /api/health?live=1 (defined in pages/api/health.ts)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:3000/api/health?live=1" || exit 1

# dumb-init = proper PID 1 (handles SIGTERM, no zombie processes)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
