const { chromium } = require('playwright');
(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
    });
    const page = await browser.newPage();
    console.log('browser launched, testing google.com...');
    await page.goto('http://www.google.com', { waitUntil: 'load', timeout: 15000 });
    console.log('google loaded, title:', await page.title());
    await page.waitForTimeout(2000);
    console.log('testing localhost:3333...');
    await page.goto('http://localhost:3333', { waitUntil: 'commit', timeout: 10000 });
    console.log('localhost reached, url:', page.url());
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('body text:', bodyText.substring(0, 300));
    await browser.close();
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message.split('\n')[0]);
    if (browser) await browser.close().catch(()=>{});
    process.exit(1);
  }
})();