// k6/scenarios/load.ts
// Phase 6: k6 load test — tests performance under increasing load
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { test: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      tags: { test: 'stress' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    api_duration: ['p(95)<800'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.STAGING_URL || 'https://staging.openproject.example.com';

function apiRequest(method: string, url: string, body?: object) {
  const start = Date.now();
  const params = { headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) };
  const res = http.request(method, url, params as any);
  apiDuration.add(Date.now() - start);
  return res;
}

export default function () {
  // Hit projects endpoint
  const projects = apiRequest('GET', `${BASE_URL}/api/projects`);
  check(projects, { 'projects loaded': (r) => r.status === 200 });
  errorRate.add(projects.status !== 200);

  // Hit notifications
  const notifications = apiRequest('GET', `${BASE_URL}/api/notifications`);
  check(notifications, { 'notifications loaded': (r) => r.status === 200 || r.status === 401 });
  errorRate.add(notifications.status !== 200 && notifications.status !== 401);

  sleep(1);
}
