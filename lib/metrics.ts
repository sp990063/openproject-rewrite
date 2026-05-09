// lib/metrics.ts
// Phase 6: Prometheus-compatible metrics
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
// import { collectDefaultMetrics } from 'prom-client';
// collectDefaultMetrics({ register });

// HTTP metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [register],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

// Business metrics
export const activeUsersGauge = new Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
  registers: [register],
});

export const emailQueueSizeGauge = new Gauge({
  name: 'email_queue_size',
  help: 'Number of emails in the queue',
  registers: [register],
});

export const workPackagesCreatedTotal = new Counter({
  name: 'work_packages_created_total',
  help: 'Total number of work packages created',
  registers: [register],
});
