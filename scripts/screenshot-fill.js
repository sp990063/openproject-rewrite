#!/usr/bin/env node
/** Fill in remaining screenshots — resilient version */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3002';
const OUT = path.join(__dirname, '..', 'docs', 'images-manual');
const EMAIL = 'demo@example.com';
const PASS = 'demo123';
const PID = 'cmo4ojw5r000gy8qxbipmo46s';

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ss(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false, timeout: 5000 });
    console.log(`  ✓ ${name}`);
  } catch(e) {
    console.log(`  ✗ ${name} (${e.message.slice(0,40)})`);
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
    console.log('  ! browser error:', e.message.slice(0, 60));
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });
  await sleep(1000);
}

// ── Wiki page + edit ────────────────────────────────────────────────────────
async function wikiPageEdit() {
  console.log('\n[Wiki Page + Edit]');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/wiki`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    const links = await page.$$('a[href*="/wiki/"]');
    if (links.length > 0) {
      await links[0].click();
      await page.waitForURL(/\/wiki\//, { timeout: 5000 });
      await sleep(1500);
      await ss(page, '10-wiki-page');

      const editBtn = await page.$('button:has-text("Edit")');
      if (editBtn) {
        await editBtn.click({ force: true });
        await sleep(800);
        await ss(page, '10-wiki-edit');
        await page.keyboard.press('Escape');
        await sleep(300);
      }
    } else {
      await page.goto(`${BASE}/projects/${PID}/wiki`, { waitUntil: 'domcontentloaded' });
      await sleep(1500);
      await ss(page, '10-wiki-list');
    }
    console.log('  Done.');
  });
}

// ── Forum thread list + detail ──────────────────────────────────────────────
async function forumThread() {
  console.log('\n[Forum Thread + Reply]');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/forums`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    const forumLinks = await page.$$('a[href*="/forums/"]');
    if (forumLinks.length > 0) {
      await forumLinks[0].click();
      await page.waitForURL(/\/forums\/\d+/, { timeout: 5000 });
      await sleep(1500);
      await ss(page, '09-thread-list');

      const threadLinks = await page.$$('a[href*="/threads/"]');
      if (threadLinks.length > 0) {
        await threadLinks[0].click();
        await page.waitForURL(/\/threads\/\d+/, { timeout: 5000 });
        await sleep(1500);
        await ss(page, '09-thread-detail');

        const replyBtn = await page.$('button:has-text("Reply")');
        if (replyBtn) {
          await replyBtn.click({ force: true });
          await sleep(500);
          await ss(page, '09-reply-dialog');
          await page.keyboard.press('Escape');
          await sleep(300);
        }
      }
    } else {
      await ss(page, '09-forums-list');
    }
    console.log('  Done.');
  });
}

// ── WP Detail: direct URL ────────────────────────────────────────────────────
async function wpDetailDirect() {
  console.log('\n[WP Detail Direct URL]');
  await withBrowser(async (page) => {
    await login(page);
    // Try to find a WP ID from the list page first
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const links = await page.$$('a[href*="/work-packages/"]');
    if (links.length > 0) {
      const href = await links[0].getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
      await sleep(2000);
      await ss(page, '08-wp-detail');

      // Try Activity tab via direct URL
      await page.goto(`${BASE}${href}#activity`, { waitUntil: 'domcontentloaded' });
      await sleep(2000);
      await ss(page, '08-wp-detail-activity');
    }
    console.log('  Done.');
  });
}

// ── Notifications page 2 ────────────────────────────────────────────────────
async function notificationsPage2() {
  console.log('\n[Notifications Page 2]');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await ss(page, '11-notifications');

    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      const disabled = await nextBtn.getAttribute('disabled');
      if (!disabled) {
        await nextBtn.click({ force: true });
        await page.waitForTimeout(1500);
        await ss(page, '11-notifications-page2');
      }
    }

    const markAllBtn = await page.$('button:has-text("Mark all read")');
    if (markAllBtn) {
      await markAllBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await ss(page, '11-notifications-marked');
    }
    console.log('  Done.');
  });
}

// ── Board extra ─────────────────────────────────────────────────────────────
async function boardExtra() {
  console.log('\n[Board Extra]');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const boardTab = await page.$('button[role="tab"]:has-text("Board")');
    if (boardTab) { await boardTab.click({ force: true }); await sleep(1500); }
    await ss(page, '06-board');

    const addBtns = await page.$$('button:has-text("＋")');
    if (addBtns.length > 0) {
      await addBtns[0].click({ force: true });
      await sleep(500);
      await ss(page, '06-board-add-card');
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    const cards = await page.$$('[data-testid*="board-card"], [draggable="true"]');
    if (cards.length > 0) {
      const box = await cards[0].boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
        await sleep(400);
        await ss(page, '06-board-card-hover');
      }
    }
    console.log('  Done.');
  });
}

// ── Gantt zoom ─────────────────────────────────────────────────────────────
async function ganttZoom() {
  console.log('\n[Gantt Zoom]');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const ganttTab = await page.$('button[role="tab"]:has-text("Gantt")');
    if (ganttTab) { await ganttTab.click({ force: true }); await sleep(1500); }
    await ss(page, '05-gantt');

    const zoomIn = await page.$('button:has-text("Zoom In")');
    if (zoomIn) {
      await zoomIn.click({ force: true });
      await sleep(400);
      await ss(page, '05-gantt-zoom-in');
      await zoomIn.click({ force: true });
      await sleep(400);
      await ss(page, '05-gantt-zoom-out');
    }
    console.log('  Done.');
  });
}

// ── WP Table extras ─────────────────────────────────────────────────────────
async function wpTableExtras() {
  console.log('\n[WP Table Extras]');
  await withBrowser(async (page) => {
    await login(page);
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    const headers = await page.$$('th');
    if (headers.length > 1) {
      await headers[1].click({ force: true });
      await sleep(500);
      await ss(page, '04-wp-table-sort');
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);

    const filterBtn = await page.$('button:has-text("Filter"), button:has-text("Filters")');
    if (filterBtn) {
      await filterBtn.click({ force: true });
      await sleep(500);
      await ss(page, '04-wp-table-filter-open');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    console.log('  Done.');
  });
}

async function main() {
  console.log('\n=== Fill Missing Screenshots ===\n');
  await wikiPageEdit();
  await forumThread();
  await wpDetailDirect();
  await notificationsPage2();
  await boardExtra();
  await ganttZoom();
  await wpTableExtras();

  const files = fs.readdirSync(OUT);
  console.log(`\n=== Total: ${files.length} screenshots ===`);
  files.sort().forEach(f => console.log(' ', f));
}

main();
