/**
 * OpenProject Rewrite — Feature Flow Report
 * Tests actual API endpoints and page availability
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3333';
const PROJECT_ID = 'cmo4ojw5r000gy8qxbipmo46s';
const OUT_DIR = '/home/cwlai/openproject-rewrite/docs/automated-screenshots';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'FeatureFlow/1.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const isJson = res.headers['content-type'] && res.headers['content-type'].includes('application/json');
        let body = data;
        if (isJson) {
          try { body = JSON.parse(data); } catch {}
        }
        resolve({ status: res.statusCode, body, isJson });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('TIMEOUT')); });
  });
}

async function testEndpoint(name, url) {
  try {
    const result = await httpGet(url);
    const pass = result.status >= 200 && result.status < 400;
    const icon = pass ? '✅' : '❌';
    const shortBody = result.isJson ? JSON.stringify(result.body).substring(0, 80) : (String(result.body).substring(0, 80));
    console.log(`  ${icon} HTTP ${result.status}  ${name}\n    → ${shortBody}`);
    return { name, status: pass ? 'PASS' : 'FAIL', httpStatus: result.status, note: shortBody };
  } catch(e) {
    console.log(`  ⏱️  TIMEOUT  ${name}`);
    return { name, status: 'TIMEOUT', httpStatus: null, note: e.message };
  }
}

async function run() {
  const results = [];
  const start = Date.now();

  console.log('════════════════════════════════════════════════════════');
  console.log('  OpenProject Rewrite — Feature Flow Report');
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════');

  // ── 1. PUBLIC PAGES ────────────────────────────────────────────────────────
  console.log('\n🌐  1. PUBLIC PAGES');
  results.push(await testEndpoint('Landing page', BASE + '/'));
  results.push(await testEndpoint('Login page', BASE + '/login'));
  results.push(await testEndpoint('Dashboard', BASE + '/dashboard'));
  results.push(await testEndpoint('Admin page', BASE + '/admin/dashboard'));

  // ── 2. AUTH ─────────────────────────────────────────────────────────────────
  console.log('\n🔐  2. AUTH');
  results.push(await testEndpoint('OAuth providers', BASE + '/api/auth/providers'));
  results.push(await testEndpoint('Signin (Google)', BASE + '/api/auth/signin/google'));

  // ── 3. WORK PACKAGES ─────────────────────────────────────────────────────────
  console.log('\n📦  3. WORK PACKAGES');
  results.push(await testEndpoint('Work packages (all)', BASE + '/api/work-packages'));
  results.push(await testEndpoint('Work package by ID', BASE + `/api/projects/${PROJECT_ID}/work-packages`));
  results.push(await testEndpoint('Work package types', BASE + '/api/types'));
  results.push(await testEndpoint('Statuses', BASE + '/api/statuses'));
  results.push(await testEndpoint('Priorities', BASE + '/api/priorities'));
  results.push(await testEndpoint('Relations', BASE + `/api/projects/${PROJECT_ID}/work-packages/relations`));

  // ── 4. PROJECTS ─────────────────────────────────────────────────────────────
  console.log('\n📁  4. PROJECTS');
  results.push(await testEndpoint('Project detail', BASE + `/api/projects/${PROJECT_ID}`));
  results.push(await testEndpoint('Project members', BASE + `/api/projects/${PROJECT_ID}/members`));

  // ── 5. BOARD ────────────────────────────────────────────────────────────────
  console.log('\n📋  5. BOARD');
  results.push(await testEndpoint('Board list', BASE + `/api/work-packages?projectId=${PROJECT_ID}`));
  results.push(await testEndpoint('Board columns', BASE + '/api/statuses'));
  results.push(await testEndpoint('WIP limits', BASE + `/api/projects/${PROJECT_ID}/wip-limits`));

  // ── 6. GANTT ────────────────────────────────────────────────────────────────
  console.log('\n📊  6. GANTT');
  results.push(await testEndpoint('Gantt (same as WP)', BASE + '/api/work-packages'));

  // ── 7. CALENDAR ─────────────────────────────────────────────────────────────
  console.log('\n🗓️  7. CALENDAR');
  results.push(await testEndpoint('Calendar (same WP API)', BASE + '/api/work-packages'));

  // ── 8. WIKI ─────────────────────────────────────────────────────────────────
  console.log('\n📝  8. WIKI');
  results.push(await testEndpoint('Wiki pages', BASE + '/api/wiki?projectId=' + PROJECT_ID));
  results.push(await testEndpoint('Wiki page detail', BASE + '/api/wiki/cmp9e64df0003cgqxtjcvyw0t'));
  results.push(await testEndpoint('Wiki by-slug', BASE + '/api/wiki/by-slug?slug=getting-started'));

  // ── 9. FORUMS ───────────────────────────────────────────────────────────────
  console.log('\n💬  9. FORUMS');
  results.push(await testEndpoint('Forums list', BASE + '/api/forums'));
  results.push(await testEndpoint('Forum detail', BASE + '/api/forums/cmp8o27sp000a7xqxlwn3i9ib'));
  results.push(await testEndpoint('Forum threads', BASE + '/api/forums/cmp8o27sp000a7xqxlwn3i9ib/threads'));

  // ── 10. NEWS ─────────────────────────────────────────────────────────────────
  console.log('\n📰  10. NEWS');
  results.push(await testEndpoint('News', BASE + `/api/projects/${PROJECT_ID}/news`));

  // ── 11. DOCUMENTS ──────────────────────────────────────────────────────────
  console.log('\n📎  11. DOCUMENTS');
  results.push(await testEndpoint('Documents', BASE + '/api/documents'));

  // ── 12. MEETINGS ────────────────────────────────────────────────────────────
  console.log('\n📅  12. MEETINGS');
  results.push(await testEndpoint('Meetings', BASE + `/api/projects/${PROJECT_ID}/meetings`));

  // ── 13. ACTIVITY ────────────────────────────────────────────────────────────
  console.log('\n🔥  13. ACTIVITY');
  results.push(await testEndpoint('Activities', BASE + `/api/projects/${PROJECT_ID}/activity`));

  // ── 14. MEMBERS ─────────────────────────────────────────────────────────────
  console.log('\n👥  14. MEMBERS');
  results.push(await testEndpoint('Members (global)', BASE + '/api/users'));
  results.push(await testEndpoint('Project members', BASE + `/api/projects/${PROJECT_ID}/members`));

  // ── 15. PROJECT SETTINGS ────────────────────────────────────────────────────
  console.log('\n⚙️  15. PROJECT SETTINGS');
  results.push(await testEndpoint('Roles', BASE + '/api/roles'));

  // ── 16. NOTIFICATIONS ───────────────────────────────────────────────────────
  console.log('\n🔔  16. NOTIFICATIONS');
  results.push(await testEndpoint('Notifications', BASE + '/api/notifications'));

  // ── 17. SEARCH ───────────────────────────────────────────────────────────────
  console.log('\n🔍  17. SEARCH');
  results.push(await testEndpoint('Search', BASE + '/api/search?q=demo'));

  // ── 18. QUERIES ─────────────────────────────────────────────────────────────
  console.log('\n🔲  18. QUERIES (Saved views)');
  results.push(await testEndpoint('Queries', BASE + '/api/queries'));

  // ── 19. TIME TRACKING ───────────────────────────────────────────────────────
  console.log('\n⏱️  19. TIME TRACKING');
  results.push(await testEndpoint('Time entries', BASE + `/api/projects/${PROJECT_ID}/time-entries`));

  // ── 20. HEALTH & METRICS ────────────────────────────────────────────────────
  console.log('\n💚  20. HEALTH & METRICS');
  results.push(await testEndpoint('Health check', BASE + '/api/health'));
  results.push(await testEndpoint('Metrics', BASE + '/api/metrics'));

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const timeoutCount = results.filter(r => r.status === 'TIMEOUT').length;
  const total = results.length;

  console.log('\n' + '═'.repeat(62));
  console.log('  SUMMARY');
  console.log('═'.repeat(62));
  console.log(`  🕐  Time: ${elapsed}s`);
  console.log(`  📊  Total endpoints tested: ${total}`);
  console.log(`  ✅  PASS: ${passCount}  ❌  FAIL: ${failCount}  ⏱️  TIMEOUT: ${timeoutCount}`);
  if (total > 0) {
    console.log(`  📈  Pass rate: ${((passCount / total) * 100).toFixed(1)}%`);
  }
  console.log('═'.repeat(62));

  const failed = results.filter(r => r.status === 'FAIL' || r.status === 'TIMEOUT');
  if (failed.length) {
    console.log('\n  📋  FAILED / TIMEOUT endpoints:');
    failed.forEach(f => {
      console.log(`     ${f.status === 'TIMEOUT' ? '⏱️' : '❌'} ${f.name}`);
      console.log(`        Note: ${f.note}`);
    });
  } else {
    console.log('\n  🎉  ALL ENDPOINTS PASSED!');
  }

  // Breakdown by module
  console.log('\n  📦  MODULE COVERAGE:');
  const modules = {
    'Public Pages': ['Landing page','Login page','Dashboard','Admin page'],
    'Auth': ['OAuth providers','Signin (Google)'],
    'Work Packages': ['Work packages (all)','Work package by ID','Work package types','Statuses','Priorities','Relations'],
    'Projects': ['Project detail','Project members'],
    'Board': ['Board list','Board columns','WIP limits'],
    'Gantt': ['Gantt (same as WP)'],
    'Calendar': ['Calendar (same WP API)'],
    'Wiki': ['Wiki pages','Wiki page detail','Wiki by-slug'],
    'Forums': ['Forums list','Forum detail','Forum threads'],
    'News': ['News'],
    'Documents': ['Documents'],
    'Meetings': ['Meetings'],
    'Activity': ['Activities'],
    'Members': ['Members (global)','Project members'],
    'Settings': ['Roles'],
    'Notifications': ['Notifications'],
    'Search': ['Search'],
    'Queries': ['Queries'],
    'Time Tracking': ['Time entries'],
    'Health': ['Health check','Metrics'],
  };

  for (const [module, endpoints] of Object.entries(modules)) {
    const moduleResults = results.filter(r => endpoints.includes(r.name));
    const modulePass = moduleResults.filter(r => r.status === 'PASS').length;
    const moduleTotal = moduleResults.length;
    const icon = moduleTotal === 0 ? '  ' : modulePass === moduleTotal ? '✅' : modulePass === 0 ? '❌' : '🟡';
    console.log(`  ${icon}  ${module}: ${modulePass}/${moduleTotal}`);
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    projectId: PROJECT_ID,
    elapsed_s: parseFloat(elapsed),
    total, passCount, failCount, timeoutCount,
    results,
  };
  const reportPath = path.join(OUT_DIR, 'feature-flow-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  📄  Report: ${reportPath}`);

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });