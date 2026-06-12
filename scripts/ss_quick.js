
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3001";
const OUT = path.join(__dirname, "docs", "images-manual");
const EMAIL = "demo@example.com";
const PASS = "demo123";
const PROJECT_ID = "cmo4ojw5r000gy8qxbipmo46s";

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function ss(page, name) {
  const p = path.join(OUT, name + ".png");
  await page.screenshot({ path: p });
  const sz = fs.statSync(p).size;
  console.log("OK " + name + " (" + (sz/1024).toFixed(0) + "KB)");
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
  await ss(page, "01-dashboard");
  
  await page.goto(BASE + "/my-page", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await ss(page, "02-my-page");
  
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/board", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await ss(page, "03-board");
  
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/gantt", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await ss(page, "04-gantt");
  
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/work_packages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await ss(page, "05-work-packages");
  
  await browser.close();
  console.log("ALL DONE");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
