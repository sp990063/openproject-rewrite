
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
  
  // Navigate to new meeting form
  await page.goto(BASE + "/projects/" + PROJECT_ID + "/meetings/new", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000);
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  console.log("New meeting form:", body.replace(/\n/g, " "));
  
  // Get the form fields and fill them
  const fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    return inputs.map(i => ({ name: i.name || i.id || i.className, type: i.type, placeholder: i.placeholder }));
  });
  console.log("Fields:", JSON.stringify(fields.slice(0, 10)));
  
  await browser.close();
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
