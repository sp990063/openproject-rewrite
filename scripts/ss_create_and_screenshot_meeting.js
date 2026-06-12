
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
  
  // Create meeting via fetch
  const resp = await page.evaluate(async (projId) => {
    const res = await fetch('/api/projects/' + projId + '/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Weekly Standup',
        startTime: '2026-05-28T10:00:00Z',
        endTime: '2026-05-28T11:00:00Z',
        location: 'Google Meet',
        description: 'Regular weekly team standup meeting'
      })
    });
    return { status: res.status, data: await res.json() };
  }, PROJECT_ID);
  console.log("Create:", JSON.stringify(resp));
  
  if (resp.status === 201 || resp.status === 200) {
    const meetingId = resp.data.id || resp.data.data?.id;
    console.log("Meeting ID:", meetingId);
    
    // Now screenshot the meeting detail page
    await page.goto(BASE + "/projects/" + PROJECT_ID + "/meetings/" + meetingId, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);
    const body = await page.evaluate(() => document.body.innerText.substring(0, 100));
    console.log("Meeting detail:", body.replace(/\n/g, " "));
    await page.screenshot({ path: "/home/cwlai/openproject-rewrite/docs/images-manual/13-meeting-detail-fixed.png", fullPage: true });
    console.log("Screenshot taken");
  }
  
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
