
const { chromium } = require("playwright");
const BASE = "http://localhost:3001";

(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"],
    headless: true
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Check login page directly
  const resp = await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  const url = page.url();
  const html = await page.content();
  console.log("URL:", url);
  console.log("Body:", body);
  console.log("Has email input:", html.includes('type="email"'));
  console.log("HTTP:", resp.status());
  
  await browser.close();
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
