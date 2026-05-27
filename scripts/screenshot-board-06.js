#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'docs', 'images-manual');
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo123';
const PROJECT_ID = 'cmo4ojw5r000gy8qxbipmo46s';
const BASE_URL = 'http://localhost:3333';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  await sleep(1000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);
  
  // Go to board view
  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages?view=board`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  
  // Capture 06-board.png (board view, dialog closed)
  await page.screenshot({ path: path.join(OUT_DIR, '06-board.png'), fullPage: false });
  console.log('✓ 06-board.png');
  
  // Click "Configure WIP Limits" button
  const configBtn = await page.$('button:has-text("Configure WIP")');
  if (configBtn) {
    await configBtn.click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    // Capture 06-board-wip-dialog.png (with WIP dialog open)
    await page.screenshot({ path: path.join(OUT_DIR, '06-board-wip-dialog.png'), fullPage: false });
    console.log('✓ 06-board-wip-dialog.png');
    await page.keyboard.press('Escape');
    await sleep(300);
  }
  
  await browser.close();
  console.log('Done.');
})();