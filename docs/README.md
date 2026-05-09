# OpenProject Rewrite — Developer Documentation

## Quick Start

```bash
npm install
npm run dev
```

## Architecture

The application uses:
- **Next.js 14** (Pages Router) with TypeScript
- **Prisma 7** with PostgreSQL
- **TanStack Query v5** for data fetching
- **NextAuth.js v5** for authentication
- **Zod** for validation

## Project Structure

```
pages/
  api/           # API routes
  projects/      # Project pages
  work-packages/ # Work package pages
  notifications/ # Notification pages
  my-page/       # Personal dashboard

components/
  projects/      # Project-related components
  forums/        # Forum components
  notifications/ # Notification components
  time-tracking/ # Time tracking components
  work-packages/ # Work package components

hooks/           # Custom React hooks
lib/             # Core libraries
types/           # TypeScript types
prisma/          # Database schema
```

## Environment Variables

See `.env.example` for all required environment variables.

## Testing

```bash
npm test -- --run     # Run all tests
npm run analyze      # Analyze bundle size
```

## Deployment

See `.env.example` for production environment variables.

## Phase 6 Features

- **Real-time SSE**: `/api/sse` endpoint for live updates
- **File Storage**: S3-compatible storage for project files
- **Email**: Resend integration with queue-based delivery
- **Performance**: Redis caching, database indexes, query optimization
- **Monitoring**: Sentry, Prometheus metrics, health endpoint
