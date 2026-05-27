const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Login
  await page.goto('http://localhost:3333/login');
  await page.fill('input[type="email"]', 'demo@example.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  // Go to board
  await page.goto('http://localhost:3333/projects/cmo4ojw5r000gy8qxbipmo46s/work-packages?view=board');
  await page.waitForSelector('text=Board', { timeout: 10000 });
  
  // Wait for board to load
  await page.waitForTimeout(3000);

  // Click "Configure WIP Limits" button
  const wipBtn = await page.locator('button:has-text("Configure WIP Limits")');
  await wipBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of the dialog
  await page.screenshot({ path: 'docs/images-manual/06-board-wip-dialog.png', fullPage: false });
  console.log('Screenshot saved to docs/images-manual/06-board-wip-dialog.png');

  await browser.close();
})().catch(console.error);
