
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3001";
const OUT = "/home/cwlai/openproject-rewrite/docs/images-manual";
const EMAIL = "demo@example.com";
const PASS = "demo123";
const PROJECT_ID = "cmo4ojw5r000gy8qxbipmo46s";

async function ss(page, name) {
  const p = path.join(OUT, name + ".png");
  await page.screenshot({ path: p, fullPage: true });
  const sz = fs.statSync(p).size;
  console.log("OK " + name + " (" + sz + " bytes)");
}

(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"],
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 12000 });
  await page.waitForTimeout(2000);
  
  // Test the 4 new routes + 1 meeting detail
  const routes = [
    [BASE + "/projects/" + PROJECT_ID + "/gantt", "04-gantt-fixed"],
    [BASE + "/projects/" + PROJECT_ID + "/calendar", "06-calendar-fixed"],
    [BASE + "/projects/" + PROJECT_ID + "/board", "03-board-fixed"],
    [BASE + "/projects/" + PROJECT_ID + "/members", "11-members-fixed"],
  ];
  
  for (const [url, name] of routes) {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);
    const body = await page.evaluate(() => document.body.innerText.substring(0, 80));
    const status = resp.status();
    console.log("[" + status + "] " + name + ": " + body.replace(/\n/g, " "));
    await ss(page, name);
  }
  
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
