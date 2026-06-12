const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'automated-screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',
             '--disable-web-security','--disable-features=IsolateOrigins,site-per-process']
    });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to localhost:3333...');
    // Use 'commit' - fires as soon as we get any HTTP response
    const resp = await page.goto('http://localhost:3333', { waitUntil: 'commit', timeout: 15000 });
    console.log('HTTP status:', resp ? resp.status() : 'no response');

    console.log('Waiting 5s for hydration...');
    await page.waitForTimeout(5000);

    const url = page.url();
    console.log('URL:', url);
    const title = await page.title();
    console.log('Title:', title);
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 400));
    console.log('Body text:', bodyText);

    const filePath = path.join(OUT_DIR, '00-landing.png');
    await page.screenshot({ path: filePath, timeout: 10000 });
    console.log('Screenshot saved:', filePath);

    await browser.close();
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message.split('\n')[0]);
    if (browser) await browser.close().catch(()=>{});
    process.exit(1);
  }
})();