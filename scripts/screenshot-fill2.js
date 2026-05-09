#!/usr/bin/env node
/**
 * Screenshot Fill v2 — create content then capture missing screenshots.
 * Missing: wiki-page, wiki-edit, thread-list, thread-detail, reply-dialog,
 *          board-add-card, board-card-hover, gantt-zoom-in, gantt-zoom-out,
 *          wp-inline-edit, wp-detail-relations, wp-detail-attributes,
 *          wp-table-filter-open, notifications-page2, notifications-marked
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3002';
const OUT  = path.join(__dirname, '..', 'docs', 'images-manual');
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
    console.log(`  ✗ ${name}.png (${e.message.slice(0,50)})`);
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

// ── 1. Wiki page + edit ────────────────────────────────────────────────────────
async function captureWiki() {
  console.log('\n[1/7] Wiki page + edit');
  await withBrowser(async (page) => {
    await login(page);

    // Go to wiki, click "New Page"
    await page.goto(`${BASE}/projects/${PID}/wiki`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);
    await ss(page, '10-wiki-list');

    const newPageBtn = await page.$('button:has-text("New Page"), a:has-text("New Page")');
    if (newPageBtn) {
      await newPageBtn.click({ force: true });
      await sleep(800);
      await ss(page, '10-new-page-dialog');
      // Fill in title
      const titleInput = await page.$('input[placeholder*="Title"], input[name="title"]');
      if (titleInput) {
        await titleInput.fill('Project Guide');
        await sleep(300);
      }
      // Submit
      const createBtn = await page.$('button:has-text("Create")');
      if (createBtn) {
        await createBtn.click({ force: true });
        await sleep(2000);
      }
    }

    // Now should be on wiki page — capture it
    await page.waitForTimeout(1500);
    await ss(page, '10-wiki-page');

    // Click Edit
    const editBtn = await page.$('button:has-text("Edit"), a:has-text("Edit")');
    if (editBtn) {
      await editBtn.click({ force: true });
      await sleep(800);
      await ss(page, '10-wiki-edit');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    console.log('  Done.');
  });
}

// ── 2. Forum thread list + detail + reply ─────────────────────────────────────
async function captureForum() {
  console.log('\n[2/7] Forum thread + reply');
  await withBrowser(async (page) => {
    await login(page);

    await page.goto(`${BASE}/projects/${PID}/forums`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);

    const newForumBtn = await page.$('button:has-text("New Forum"), a:has-text("New Forum")');
    if (newForumBtn) {
      await newForumBtn.click({ force: true });
      await sleep(800);
      await ss(page, '09-new-forum-dialog');
      const nameInput = await page.$('input[name="name"], input[placeholder*="Name"]');
      if (nameInput) await nameInput.fill('General Discussion');
      const createBtn = await page.$('button:has-text("Create")');
      if (createBtn) {
        await createBtn.click({ force: true });
        await sleep(2000);
      }
    }

    // Now on forum list or detail — capture thread-list
    await sleep(1000);
    await ss(page, '09-thread-list');

    // Click "New Thread"
    const newThreadBtn = await page.$('button:has-text("New Thread"), a:has-text("New Thread")');
    if (newThreadBtn) {
      await newThreadBtn.click({ force: true });
      await sleep(800);
      await ss(page, '09-new-thread-dialog');
      const subjectInput = await page.$('input[name="subject"], input[placeholder*="Subject"]');
      if (subjectInput) await subjectInput.fill('Welcome to the project');
      const createBtn = await page.$('button:has-text("Create")');
      if (createBtn) {
        await createBtn.click({ force: true });
        await sleep(2000);
      }
    }

    // Capture thread detail
    await sleep(1000);
    await ss(page, '09-thread-detail');

    // Click Reply
    const replyBtn = await page.$('button:has-text("Reply"), a:has-text("Reply")');
    if (replyBtn) {
      await replyBtn.click({ force: true });
      await sleep(600);
      await ss(page, '09-reply-dialog');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    console.log('  Done.');
  });
}

// ── 3. Board add card + card hover ────────────────────────────────────────────
async function captureBoard() {
  console.log('\n[3/7] Board add card + card hover');
  await withBrowser(async (page) => {
    await login(page);

    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    // Switch to Board tab
    const boardTab = await page.$('button[role="tab"]:has-text("Board")');
    if (boardTab) {
      await boardTab.click({ force: true });
      await sleep(1500);
    }
    await ss(page, '06-board');

    // Click +Add button (first one)
    const addBtns = await page.$$('button');
    let addClicked = false;
    for (const btn of addBtns) {
      const txt = await btn.textContent();
      if (txt.includes('＋') || txt.includes('+')) {
        await btn.click({ force: true });
        await sleep(600);
        await ss(page, '06-board-add-card');
        await page.keyboard.press('Escape');
        await sleep(300);
        addClicked = true;
        break;
      }
    }
    if (!addClicked) console.log('  ! +Add button not found');

    // Hover over a board card (if any exist)
    const cards = await page.$$('[class*="card"], [class*="Card"], [draggable="true"]');
    if (cards.length > 0) {
      const box = await cards[0].boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(400);
        await ss(page, '06-board-card-hover');
      }
    } else {
      // Try to capture board with column headers visible
      const cols = await page.$$('[class*="column"], [class*="Column"], [class*="lane"], [class*="Lane"]');
      console.log(`  ! No cards, but ${cols.length} board columns found`);
    }
    console.log('  Done.');
  });
}

// ── 4. Gantt zoom in/out ───────────────────────────────────────────────────────
async function captureGanttZoom() {
  console.log('\n[4/7] Gantt zoom in/out');
  await withBrowser(async (page) => {
    await login(page);

    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const ganttTab = await page.$('button[role="tab"]:has-text("Gantt")');
    if (ganttTab) {
      await ganttTab.click({ force: true });
      await sleep(1500);
    }
    await ss(page, '05-gantt');

    const zoomIn = await page.$('button:has-text("Zoom In")');
    if (zoomIn) {
      await zoomIn.click({ force: true });
      await sleep(400);
      await ss(page, '05-gantt-zoom-in');
      await zoomIn.click({ force: true });
      await sleep(400);
      await ss(page, '05-gantt-zoom-out');
    } else {
      console.log('  ! Zoom In button not found');
    }
    console.log('  Done.');
  });
}

// ── 5. WP table inline edit ────────────────────────────────────────────────────
async function captureInlineEdit() {
  console.log('\n[5/7] WP table inline edit');
  await withBrowser(async (page) => {
    await login(page);

    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    // Double-click on a cell to enter inline edit
    const cells = await page.$$('tbody td');
    if (cells.length > 1) {
      const box = await cells[1].boundingBox();
      if (box) {
        await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(600);
        await ss(page, '04-wp-inline-edit');
        await page.keyboard.press('Escape');
        await sleep(300);
      }
    } else {
      console.log('  ! No table cells found');
    }

    // Also try filter panel
    const filterBtn = await page.$('button:has-text("Filter"), button:has-text("Filters")');
    if (filterBtn) {
      await filterBtn.click({ force: true });
      await sleep(600);
      await ss(page, '04-wp-table-filter-open');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    console.log('  Done.');
  });
}

// ── 6. WP detail relations + attributes ──────────────────────────────────────
async function captureWpDetail() {
  console.log('\n[6/7] WP detail relations + attributes');
  await withBrowser(async (page) => {
    await login(page);

    // Get first WP link from table
    await page.goto(`${BASE}/projects/${PID}/work-packages`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const wpLinks = await page.$$('a[href*="/work-packages/"]');
    if (wpLinks.length === 0) { console.log('  ! No WP links found'); return; }

    const href = await wpLinks[0].getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    await ss(page, '08-wp-detail');

    // Try to access attributes sidebar
    const attrSection = await page.$('[class*="sidebar"], [class*="attribute"], section');
    if (attrSection) await ss(page, '08-wp-detail-attributes');

    // Click Relations tab (direct URL approach to avoid crash)
    await page.goto(`${BASE}${href}#relations`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    await ss(page, '08-wp-detail-relations');

    console.log('  Done.');
  });
}

// ── 7. Notifications page 2 + mark all read ───────────────────────────────────
async function captureNotifications() {
  console.log('\n[7/7] Notifications page 2 + mark all read');
  await withBrowser(async (page) => {
    await login(page);

    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1500);
    await ss(page, '11-notifications');

    // Next page
    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      const disabled = await nextBtn.getAttribute('disabled');
      const isDisabled = disabled !== null || (await nextBtn.isDisabled());
      if (!isDisabled) {
        await nextBtn.click({ force: true });
        await sleep(1000);
        await ss(page, '11-notifications-page2');
      }
    }

    // Mark all read
    const markAllBtn = await page.$('button:has-text("Mark all read")');
    if (markAllBtn) {
      await markAllBtn.click({ force: true });
      await sleep(1500);
      await ss(page, '11-notifications-marked');
    } else {
      // Try going back and mark all
      await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1000);
      const mBtn = await page.$('button:has-text("Mark all read")');
      if (mBtn) {
        await mBtn.click({ force: true });
        await sleep(1500);
        await ss(page, '11-notifications-marked');
      }
    }
    console.log('  Done.');
  });
}

async function main() {
  console.log('\n=== Screenshot Fill v2 — 7 sections ===\n');
  await captureWiki();
  await captureForum();
  await captureBoard();
  await captureGanttZoom();
  await captureInlineEdit();
  await captureWpDetail();
  await captureNotifications();

  const files = fs.readdirSync(OUT);
  console.log(`\n=== Total: ${files.length} screenshots ===`);
  files.sort().forEach(f => console.log(' ', f));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });