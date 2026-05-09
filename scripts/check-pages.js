#!/usr/bin/env node
/** Quick page structure checker */
const { chromium } = require('playwright');
const BASE = 'http://localhost:3002';
const EMAIL = 'demo@example.com';
const PASS = 'demo123';
const PID = 'cmo4ojw5r000gy8qxbipmo46s';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  try {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/dashboard`, { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('Logged in OK');

    // Wiki page structure
    await page.goto(`${BASE}/projects/${PID}/wiki`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const wikiLinks = await page.$$eval('a[href*="/wiki/"]', els => els.map(e => e.href));
    console.log('Wiki links:', wikiLinks);
    const wikiText = await page.$eval('body', el => el.innerText.slice(0, 200));
    console.log('Wiki text:', wikiText.slice(0, 150));

    // Forum structure
    await page.goto(`${BASE}/projects/${PID}/forums`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const forumLinks = await page.$$eval('a[href*="/forums/"]', els => els.map(e => e.href));
    console.log('Forum links:', forumLinks);
    const threadLinks = await page.$$eval('a[href*="/threads/"]', els => els.map(e => e.href));
    console.log('Thread links:', threadLinks);
    const forumText = await page.$eval('body', el => el.innerText.slice(0, 200));
    console.log('Forum text:', forumText.slice(0, 150));

    // Board structure
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const boardTab = await page.$('button[role="tab"]:has-text("Board")');
    if (boardTab) {
      await boardTab.click({ force: true });
      await page.waitForTimeout(1500);
    }
    const addBtns = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.includes('＋') || t.includes('Add')));
    console.log('Add buttons:', addBtns);
    const boardCards = await page.$$('[class*="card"]');
    console.log('Board cards count:', boardCards.length);

    // WP table row hover
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const rows = await page.$$('tbody tr');
    console.log('WP rows count:', rows.length);

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });