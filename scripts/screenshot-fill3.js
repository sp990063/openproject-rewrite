#!/usr/bin/env node
/**
 * Screenshot Fill v3 — fixes from v2 diagnostic.
 * Goals:
 *   - Wiki edit: use page URL navigation after create
 *   - Forum reply: create forum+thread then navigate to thread
 *   - Gantt: capture Month/Week time scale buttons instead of Zoom
 *   - Board: skip card-hover (no cards), capture +Add dialog
 *   - WP detail attributes: check sidebar after load
 *   - Notifications: try mark-all-read state
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE  = 'http://localhost:3002';
const OUT   = path.join(__dirname, '..', 'docs', 'images-manual');
const EMAIL = 'demo@example.com';
const PASS  = 'demo123';
const PID   = 'cmo4ojw5r000gy8qxbipmo46s';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ss(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false, timeout: 8000 });
    console.log(`  ✓ ${name}.png`);
    return true;
  } catch(e) {
    console.log(`  ✗ ${name}.png (${e.message.slice(0,60)})`);
    return false;
  }
}

async function withBrowser(fn) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await fn(page);
  } catch(e) {
    console.log('  ! browser error:', e.message.slice(0, 80));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/dashboard`, { timeout: 10000 });
  await sleep(800);
}

// ── Wiki: create page + navigate to it + capture edit ─────────────────────────
async function captureWikiEdit() {
  console.log('\n[Wiki] page + edit mode');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/wiki`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);

    // Click "New Page" → create dialog
    const newPageBtn = await page.$('button:has-text("New Page")');
    if (newPageBtn) {
      await newPageBtn.click({ force: true });
      await sleep(800);
      await ss(page, '10-new-page-dialog');

      const titleInput = await page.$('input[name="title"], input[placeholder*="Title" i]');
      if (titleInput) await titleInput.fill('Project Guide');
      const contentInput = await page.$('textarea[name="content"], textarea[placeholder*="Content" i]');
      if (contentInput) await contentInput.fill('This is the project guide wiki page.');
      const createBtn = await page.$('button:has-text("Create")');
      if (createBtn) {
        await createBtn.click({ force: true });
        await sleep(2500);
      }
    }

    // After creation, we're on the wiki page — capture page
    await sleep(1000);
    await ss(page, '10-wiki-page');

    // Look for Edit button — try multiple selectors
    const editSelectors = [
      'button:has-text("Edit")',
      'a:has-text("Edit")',
      '[aria-label*="Edit"]',
      'button[aria-label*="edit"]',
      '[class*="edit"]'
    ];
    let editClicked = false;
    for (const sel of editSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        const txt = await btn.textContent();
        console.log(`  Found edit btn: "${txt.trim()}" via ${sel}`);
        await btn.click({ force: true });
        await sleep(800);
        await ss(page, '10-wiki-edit');
        editClicked = true;
        break;
      }
    }
    if (!editClicked) {
      // Try keyboard shortcut or look at page HTML
      console.log('  ! Edit button not found, trying Escape to close any open dialog');
      await page.keyboard.press('Escape');
      await sleep(300);
      // Try clicking on page content area to see if edit appears
      const pageContent = await page.$('main, .prose, [class*="content"]');
      if (pageContent) {
        await pageContent.click({ force: true });
        await sleep(500);
        await ss(page, '10-wiki-edit-attempt');
      }
    }
    console.log('  Done.');
  });
}

// ── Forum: create forum → thread → reply dialog ────────────────────────────────
async function captureForumReply() {
  console.log('\n[Forum] thread + reply dialog');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/forums`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);
    await ss(page, '09-forums-list');

    // Create forum
    const nfBtn = await page.$('button:has-text("New Forum")');
    if (nfBtn) {
      await nfBtn.click({ force: true });
      await sleep(800);
      await ss(page, '09-new-forum-dialog');
      const inp = await page.$('input[name="name"]');
      if (inp) await inp.fill('General Discussion');
      const create = await page.$('button:has-text("Create")');
      if (create) { await create.click({ force: true }); await sleep(2500); }
    }

    // Should now be on forum detail → capture thread list
    await sleep(1000);
    await ss(page, '09-thread-list');

    // Create thread
    const ntBtn = await page.$('button:has-text("New Thread")');
    if (ntBtn) {
      await ntBtn.click({ force: true });
      await sleep(800);
      await ss(page, '09-new-thread-dialog');
      const inp = await page.$('input[name="subject"]');
      if (inp) await inp.fill('Welcome to the project');
      const create = await page.$('button:has-text("Create")');
      if (create) { await create.click({ force: true }); await sleep(2500); }
    }

    // Should now be on thread detail
    await sleep(1000);
    await ss(page, '09-thread-detail');

    // Look for Reply button
    const replySelectors = ['button:has-text("Reply")', 'a:has-text("Reply")', '[aria-label*="Reply"]'];
    let replyClicked = false;
    for (const sel of replySelectors) {
      const btn = await page.$(sel);
      if (btn) {
        const txt = await btn.textContent();
        console.log(`  Found reply btn: "${txt.trim()}" via ${sel}`);
        await btn.click({ force: true });
        await sleep(600);
        await ss(page, '09-reply-dialog');
        replyClicked = true;
        break;
      }
    }
    if (!replyClicked) {
      console.log('  ! Reply button not found');
      // List all buttons for debugging
      const allBtns = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t.length < 30));
      console.log('  Available buttons:', JSON.stringify(allBtns));
    }
    console.log('  Done.');
  });
}

// ── Gantt: Month/Week time scale toggle ───────────────────────────────────────
async function captureGanttTimeScale() {
  console.log('\n[Gantt] Month/Week time scale');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const ganttTab = await page.$('button[role="tab"]:has-text("Gantt")');
    if (ganttTab) { await ganttTab.click({ force: true }); await sleep(1500); }
    await ss(page, '05-gantt');

    // Click Week
    const weekBtn = await page.$('button:has-text("Week")');
    if (weekBtn) {
      await weekBtn.click({ force: true });
      await sleep(500);
      await ss(page, '05-gantt-week-view');
    }

    // Click Month
    const monthBtn = await page.$('button:has-text("Month")');
    if (monthBtn) {
      await monthBtn.click({ force: true });
      await sleep(500);
      await ss(page, '05-gantt-month-view');
    }

    // Today button
    const todayBtn = await page.$('button:has-text("Today")');
    if (todayBtn) {
      await todayBtn.click({ force: true });
      await sleep(500);
      await ss(page, '05-gantt-today');
    }
    console.log('  Done.');
  });
}

// ── Board: +Add card dialog ────────────────────────────────────────────────────
async function captureBoardAdd() {
  console.log('\n[Board] +Add card dialog');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const boardTab = await page.$('button[role="tab"]:has-text("Board")');
    if (boardTab) { await boardTab.click({ force: true }); await sleep(1500); }
    await ss(page, '06-board');

    // Click first +Add
    const addBtns = await page.$$('button');
    let clicked = false;
    for (const btn of addBtns) {
      const txt = await btn.textContent();
      if (txt.includes('＋') || txt.trim() === '+') {
        await btn.click({ force: true });
        await sleep(600);
        await ss(page, '06-board-add-card');
        await page.keyboard.press('Escape');
        await sleep(300);
        clicked = true;
        break;
      }
    }
    if (!clicked) console.log('  ! +Add button not found');
    console.log('  Done.');
  });
}

// ── WP detail: attributes sidebar ─────────────────────────────────────────────
async function captureWpAttributes() {
  console.log('\n[WP Detail] attributes sidebar');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const wpLinks = await page.$$('a[href*="/work-packages/"]');
    if (wpLinks.length === 0) { console.log('  ! No WP links'); return; }
    const href = await wpLinks[0].getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    await ss(page, '08-wp-detail');

    // Try to scroll to right or find sidebar
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);

    // Check if there's a sidebar section
    const sidebar = await page.$('aside, [class*="sidebar"], [class*="attribute"]');
    if (sidebar) {
      const box = await sidebar.boundingBox();
      if (box) await ss(page, '08-wp-detail-attributes');
    } else {
      // Take full screenshot to see layout
      await ss(page, '08-wp-detail-full');
      const bodyHtml = await page.$eval('body', el => el.innerHTML.slice(0, 1000));
      console.log('  ! No sidebar found. Body snippet:', bodyHtml.slice(0, 200));
    }
    console.log('  Done.');
  });
}

// ── Notifications: mark all read + empty state ──────────────────────────────────
async function captureNotifications() {
  console.log('\n[Notifications] mark all read');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);
    await ss(page, '11-notifications');

    // Mark all read
    const markAllBtn = await page.$('button:has-text("Mark all read")');
    if (markAllBtn) {
      await markAllBtn.click({ force: true });
      await sleep(1500);
      await ss(page, '11-notifications-marked');
    }

    // Try Next page
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000);
    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      const disabled = await nextBtn.getAttribute('disabled');
      if (!disabled) {
        await nextBtn.click({ force: true });
        await sleep(1000);
        await ss(page, '11-notifications-page2');
      }
    }
    console.log('  Done.');
  });
}

async function main() {
  console.log('\n=== Screenshot Fill v3 ===\n');
  await captureWikiEdit();
  await captureForumReply();
  await captureGanttTimeScale();
  await captureBoardAdd();
  await captureWpAttributes();
  await captureNotifications();

  const files = fs.readdirSync(OUT);
  console.log(`\n=== Total: ${files.length} screenshots ===`);
  files.sort().forEach(f => console.log(' ', f));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });