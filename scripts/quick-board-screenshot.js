
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  try {
    // Login
    await page.goto('http://localhost:3333/login', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(10000);
    console.log('URL after login:', page.url());
    
    // Board page - no networkidle
    await page.goto('http://localhost:3333/projects/cmo4ojw5r000gy8qxbipmo46s/work-packages?view=board', {
      timeout: 15000
    });
    await page.waitForTimeout(8000);
    console.log('Board URL:', page.url());
    
    // Screenshot board
    await page.screenshot({ path: 'docs/images-manual/06-board.png', fullPage: false });
    console.log('Board screenshot taken');
    
    // Check for Configure WIP Limits button
    const btn = await page.$('button:has-text("Configure WIP Limits")');
    console.log('WIP button found:', !!btn);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'docs/images-manual/06-board-wip-dialog.png', fullPage: false });
      console.log('WIP Dialog screenshot taken');
    }
  } catch(e) {
    console.error('ERROR:', e.message);
    // Try to take whatever screenshot we can
    try {
      await page.screenshot({ path: 'docs/images-manual/error-screenshot.png', fullPage: false });
      console.log('Error screenshot saved');
    } catch(e2) {}
  }
  
  await browser.close();
})();
