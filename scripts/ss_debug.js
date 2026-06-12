
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
  
  // Login once
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 12000 });
  await page.waitForTimeout(2000);
  
  // Try board with fullPage
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/board", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  const boardErrors = await page.evaluate(() => {
    const body = document.body.innerText.substring(0, 300);
    const hasContent = document.querySelector('[data-testid]') || document.querySelector('.board') || document.querySelector('[class*="board"]');
    return { body, hasContent: !!hasContent, url: window.location.href };
  });
  console.log("Board page:", JSON.stringify(boardErrors));
  await ss(page, "03-board-retry");
  
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
