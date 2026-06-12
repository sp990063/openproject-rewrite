
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
  
  const routes = [
    ["/projects/" + PROJECT_ID + "/work_packages", "05-work-packages"],
    ["/projects/" + PROJECT_ID + "/members", "11-members"],
    [BASE + "/my-page", "02-my-page"],
    [BASE + "/projects/" + PROJECT_ID, "03-project-overview"],
    [BASE + "/admin/dashboard", "14-admin"],
    [BASE + "/projects", "15-projects-list"],
  ];
  
  for (const [url, name] of routes) {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2500);
    const body = await page.evaluate(() => document.body.innerText.substring(0, 80));
    console.log("[" + resp.status() + "] " + name + ": " + body.replace(/\n/g," "));
    await ss(page, name);
  }
  
  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
