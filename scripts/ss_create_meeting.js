
const { chromium } = require("playwright");
const BASE = "http://localhost:3001";
const PROJECT_ID = "cmo4ojw5r000gy8qxbipmo46s";

(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"],
    headless: true
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', 'demo@example.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 12000 });
  await page.waitForTimeout(2000);
  
  // Get session cookies
  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find(c => c.name === 'next-auth.session-token' || c.name === '__Secure-next-auth.session-token');
  console.log("Session cookie found:", !!sessionCookie);
  
  // Try to create a meeting via fetch
  const resp = await page.evaluate(async (projId) => {
    const res = await fetch('/api/projects/' + projId + '/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Meeting for Screenshot',
        startDate: '2026-05-28T10:00:00Z',
        endDate: '2026-05-28T11:00:00Z',
        location: 'Zoom',
        description: 'Test'
      })
    });
    return { status: res.status, data: await res.json() };
  }, PROJECT_ID);
  console.log("Create meeting:", JSON.stringify(resp));
  
  await browser.close();
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
