#!/usr/bin/env node
/** Check actual button texts in the UI */
const { chromium } = require('playwright');
const BASE = 'http://localhost:3002';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/dashboard`, { timeout: 10000 });
    await page.waitForTimeout(1000);
    console.log('Logged in');

    const PID = 'cmo4ojw5r000gy8qxbipmo46s';

    // Gantt: check all buttons
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const ganttTab = await page.$('button[role="tab"]:has-text("Gantt")');
    if (ganttTab) { await ganttTab.click({ force: true }); await page.waitForTimeout(1500); }
    const allBtns1 = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.length < 40));
    console.log('Gantt buttons:', JSON.stringify(allBtns1));

    // Board: check all buttons
    const boardTab = await page.$('button[role="tab"]:has-text("Board")');
    if (boardTab) { await boardTab.click({ force: true }); await page.waitForTimeout(1500); }
    const allBtns2 = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.length < 40));
    console.log('Board buttons:', JSON.stringify(allBtns2));

    // Wiki page: check edit button
    await page.goto(`${BASE}/projects/${PID}/wiki`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Click New Page then Create a wiki page
    const newPgBtn = await page.$('button:has-text("New Page")');
    if (newPgBtn) {
      await newPgBtn.click({ force: true });
      await page.waitForTimeout(800);
      const inp = await page.$('input[name="title"], input[placeholder*="Title"]');
      if (inp) { await inp.fill('Test Page'); }
      const createBtn = await page.$('button:has-text("Create")');
      if (createBtn) { await createBtn.click({ force: true }); await page.waitForTimeout(2000); }
    }
    await page.waitForTimeout(1000);
    const wikiBtns = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.length < 40));
    console.log('Wiki page buttons:', JSON.stringify(wikiBtns));

    // Thread detail: check reply button
    await page.goto(`${BASE}/projects/${PID}/forums`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Create forum + thread first
    const nfBtn = await page.$('button:has-text("New Forum")');
    if (nfBtn) {
      await nfBtn.click({ force: true });
      await page.waitForTimeout(800);
      const inp = await page.$('input[name="name"]');
      if (inp) { await inp.fill('Test Forum'); }
      const create = await page.$('button:has-text("Create")');
      if (create) { await create.click({ force: true }); await page.waitForTimeout(2000); }
    }
    await page.waitForTimeout(1000);
    const ntBtn = await page.$('button:has-text("New Thread")');
    if (ntBtn) {
      await ntBtn.click({ force: true });
      await page.waitForTimeout(800);
      const inp = await page.$('input[name="subject"]');
      if (inp) { await inp.fill('Test Thread'); }
      const create = await page.$('button:has-text("Create")');
      if (create) { await create.click({ force: true }); await page.waitForTimeout(2000); }
    }
    await page.waitForTimeout(1000);
    const threadBtns = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.length < 40));
    console.log('Thread detail buttons:', JSON.stringify(threadBtns));

    // WP detail: check sidebar
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const wpLink = await page.$('a[href*="/work-packages/"]');
    if (wpLink) {
      const href = await wpLink.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const sidebarInfo = await page.$$eval('[class*="sidebar"], section, aside, [class*="attribute"]',
        els => els.map(e => e.className + ': ' + e.textContent.trim().slice(0,80)));
      console.log('WP detail sidebar:', JSON.stringify(sidebarInfo));
      const allSections = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.length < 40));
      console.log('WP detail buttons:', JSON.stringify(allSections));
    }

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error('ERROR:', e.message); });