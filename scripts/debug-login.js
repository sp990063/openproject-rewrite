const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3333', { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForTimeout(3000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('BODY TEXT:', bodyText.substring(0, 800));
  const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).slice(0,10).map(a => a.href));
  console.log('LINKS:', JSON.stringify(urls));
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({type: i.type, placeholder: i.placeholder, name: i.name})));
  console.log('INPUTS:', JSON.stringify(inputs));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });