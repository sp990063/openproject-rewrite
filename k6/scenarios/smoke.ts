// k6/scenarios/smoke.ts
// Phase 6: k6 smoke test — verifies basic functionality under light load
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { test: 'smoke' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    api_duration: ['p(95)<800'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.STAGING_URL || 'https://staging.openproject.example.com';
const USERNAME = __ENV.TEST_USER || 'test@example.com';
const PASSWORD = __ENV.TEST_PASSWORD || 'testpassword';

function apiRequest(method: string, url: string, body?: object, token?: string) {
  const start = Date.now();
  const params: Record<string, unknown> = {
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) {
    params.headers = { ...params.headers, 'Authorization': `Bearer ${token}` };
  }
  if (body) {
    params.body = JSON.stringify(body);
  }
  const res = http.request(method, url, params as any);
  apiDuration.add(Date.now() - start);
  return res;
}

export function setup() {
  const loginRes = apiRequest('POST', `${BASE_URL}/api/auth/callback/credentials`, {
    csrfToken: '',
    email: USERNAME,
    password: PASSWORD,
    json: true,
  });
  // Extract session token from cookies
  const cookies = loginRes.cookies;
  return { cookies };
}

export default function (data: { cookies: Record<string, string> }) {
  const jar = http.cookieJar();
  Object.entries(data.cookies).forEach(([name, value]) => {
    jar.set(BASE_URL, name, value);
  });

  // Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health endpoint ok': (r) => r.status === 200 });
  errorRate.add(health.status !== 200);

  // Projects list
  const projects = apiRequest('GET', `${BASE_URL}/api/projects`, undefined, 'Bearer test');
  check(projects, { 'projects loaded': (r) => r.status === 200 });
  errorRate.add(projects.status !== 200);
  if (projects.status !== 200) return;

  const projectList = projects.json('data') as any[] | undefined;
  if (!projectList?.length) return;
  const projectId = projectList[0].id as string;

  // Work packages
  const wps = apiRequest('GET', `${BASE_URL}/api/projects/${projectId}/work-packages`);
  check(wps, { 'work packages loaded': (r) => r.status === 200 });
  errorRate.add(wps.status !== 200);

  const wpList = wps.json('data') as any[] | undefined;
  if (!wpList?.length) return;
  const wpId = wpList[0].id as string;

  // Single work package
  const wpDetail = apiRequest('GET', `${BASE_URL}/api/work-packages/${wpId}`);
  check(wpDetail, { 'wp detail loaded': (r) => r.status === 200 });
  errorRate.add(wpDetail.status !== 200);

  sleep(1);
}
