#!/usr/bin/env node
/**
 * Screenshot: Thread Detail (09-thread-detail.png)
 * Fixes: NEXTAUTH_URL mismatch + getServerSession(req,res,authOptions) fix
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3333';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'images-manual');
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo123';
const PROJECT_ID = 'cmo4ojw5r000gy8qxbipmo46s';
const FORUM_ID = 'cmp8o27sp000a7xqxlwn3i9ib';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  // Fill using keyboard.type instead of page.fill (more reliable in Node)
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.click();
  await page.keyboard.type(DEMO_EMAIL, { delay: 50 });
  await passwordInput.click();
  await page.keyboard.type(DEMO_PASSWORD, { delay: 50 });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, '09-login-filled-temp.png') });
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
  await sleep(1500);
}

async function main() {
  console.log('Starting thread detail screenshot...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Track responses
  page.on('response', r => {
    if (r.status() >= 400) console.log(`  [${r.status()}] ${r.url().replace(BASE_URL, '')}`);
  });

  try {
    // Login
    await login(page);
    console.log('Logged in successfully');

    // Go to forum
    await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/forums/${FORUM_ID}`, { waitUntil: 'load' });
    await sleep(3000);
    console.log('Forum page loaded');

    // Check if there are threads
    const threadLinks = await page.$$('a[href*="/threads/"]');
    console.log(`Found ${threadLinks.length} thread links`);

    if (threadLinks.length > 0) {
      // Click first thread
      await threadLinks[0].click();
      await page.waitForURL(/threads/, { timeout: 8000 });
      await sleep(3000);
      console.log('Thread detail page loaded');
    } else {
      // Try to create a thread first
      console.log('No threads found, creating one via API...');
      const createBtn = await page.$('button:has-text("New Thread")');
      if (createBtn) {
        await createBtn.click({ force: true });
        await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
        await sleep(500);
        
        // Fill in subject
        const subjInput = page.locator('input[id*="subject"], [data-testid*="subject"], input[placeholder*="subject" i]');
        if (await subjInput.count() > 0) {
          await subjInput.fill('Test Thread for Screenshot');
          await sleep(300);
        }
        
        // Fill in content
        const contentInput = page.locator('textarea, [data-testid*="content"]');
        if (await contentInput.count() > 0) {
          await contentInput.fill('This is a test thread for the user manual screenshot.');
          await sleep(300);
        }
        
        // Click create
        const createSubmit = await page.$('button:has-text("Create"), button:has-text("Submit")');
        if (createSubmit) {
          await createSubmit.click();
          await sleep(3000);
        }
        
        // Try again to find thread links
        const newThreadLinks = await page.$$('a[href*="/threads/"]');
        if (newThreadLinks.length > 0) {
          await newThreadLinks[0].click();
          await page.waitForURL(/threads/, { timeout: 8000 });
          await sleep(3000);
        }
      }
    }

    // Take screenshot
    const screenshotPath = path.join(OUT_DIR, '09-thread-detail.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Verify file size
    const stats = fs.statSync(screenshotPath);
    console.log(`File size: ${stats.size} bytes`);
    if (stats.size < 20000) {
      console.log('WARNING: File size is suspiciously small - page may show error');
    }

  } catch (err) {
    console.error('Error:', err.message);
    // Take screenshot anyway for debugging
    await page.screenshot({ path: path.join(OUT_DIR, '09-thread-detail-error.png'), fullPage: false });
  }

  await browser.close();
  console.log('Done');
}

main();