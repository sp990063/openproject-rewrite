const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, timeout: 10000 });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3333/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const title = await page.title();
  console.log('Title:', title);
  const url = page.url();
  console.log('URL:', url);
  await browser.close();
  process.exit(0);
})().catch(function(e) { console.error(e.message); process.exit(1); });
