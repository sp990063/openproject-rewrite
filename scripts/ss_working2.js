
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
  await ss(page, "01-dashboard");
  
  await page.goto(BASE + "/my-page", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  await ss(page, "02-my-page");
  
  await page.goto(BASE + "/projects/" + PROJECT_ID, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  await ss(page, "03-project-overview");
  
  // hyphen not underscore!
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/work-packages", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  let body = await page.evaluate(() => document.body.innerText.substring(0, 80));
  console.log("work-packages: " + body.replace(/\n/g," "));
  await ss(page, "05-work-packages");
  
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/members", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  body = await page.evaluate(() => document.body.innerText.substring(0, 80));
  console.log("members: " + body.replace(/\n/g," "));
  await ss(page, "11-members");
  
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/settings", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  await ss(page, "12-project-settings");
  
  await page.goto(BASE + "/admin/dashboard", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  await ss(page, "14-admin");
  
  await page.goto(BASE + "/projects", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2500);
  await ss(page, "15-projects-list");
  
  await browser.close();
  console.log("ALL DONE");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
