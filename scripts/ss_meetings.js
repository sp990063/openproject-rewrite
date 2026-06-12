
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
  
  // Go to meetings list to find a meeting ID
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/meetings", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000);
  const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log("Meetings list:", body.replace(/\n/g, " "));
  
  // Find any link with a meeting ID
  const meetingLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/meetings/"]'));
    return anchors.slice(0, 5).map(a => a.href);
  });
  console.log("Meeting links:", JSON.stringify(meetingLinks));
  
  await browser.close();
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
