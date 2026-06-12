const { chromium } = require('playwright');
(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
    });
    const page = await browser.newPage();
    console.log('browser launched');
    await page.goto('http://localhost:3333', { waitUntil: 'load', timeout: 15000 });
    console.log('loaded, url:', page.url());
    console.log('title:', await page.title());
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('body text (first 500):', bodyText.substring(0, 500));
    await browser.close();
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message);
    if (browser) await browser.close().catch(()=>{});
    process.exit(1);
  }
})();