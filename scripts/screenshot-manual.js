#!/usr/bin/env node
/**
 * Screenshot automation for User Manual
 * Usage: node scripts/screenshot-manual.js [section]
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3002';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'images-manual');
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo123';
const PROJECT_ID = 'cmo4ojw5r000gy8qxbipmo46s';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

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

async function ss(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}`);
}

// ─── UG-01: Login / Landing ──────────────────────────────────────────────────
async function captureLogin() {
  console.log('\n[UG-01] Login & Landing...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '01-landing-hero');
  await page.evaluate(() => window.scrollTo(0, 400));
  await sleep(500);
  await ss(page, '01-landing-features');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(500);
  await ss(page, '01-landing-login-card');

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await ss(page, '01-login-filled');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  await sleep(1000);
  await ss(page, '01-dashboard');

  await browser.close();
  console.log('  Done.');
}

// ─── UG-02: Projects ─────────────────────────────────────────────────────────
async function captureProjects() {
  console.log('\n[UG-02] Projects...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);

  await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '02-projects-list');

  const newBtn = await page.$('button:has-text("New Project")');
  if (newBtn) {
    await newBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '02-new-project-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  const allLinks = await page.$$('a[href*="/projects/"]');
  let overviewLink = null;
  for (const link of allLinks) {
    const href = await link.getAttribute('href');
    if (href && !href.includes('work-packages') && !href.includes('settings') && !href.includes('wiki') && !href.includes('forums')) {
      overviewLink = link;
      break;
    }
  }
  if (overviewLink) {
    await overviewLink.click();
    await page.waitForURL(/\/projects\/[^/]+$/, { timeout: 8000 });
    await sleep(1500);
    await ss(page, '02-project-overview');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(500);
    await ss(page, '02-project-overview-stats');
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-03: Settings ──────────────────────────────────────────────────────────
async function captureSettings() {
  console.log('\n[UG-03] Settings...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);

  const settingsUrl = `${BASE_URL}/projects/${PROJECT_ID}/settings`;

  await page.goto(settingsUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '03-settings-general');

  const nameInput = await page.$('input[id*="name"], input[placeholder*="name" i]');
  if (nameInput) {
    await nameInput.fill('Demo Project Updated');
    await sleep(300);
    await ss(page, '03-settings-general-edit');
    await nameInput.fill('Demo Project');
    await sleep(200);
  }

  const saveBtn = await page.$('button:has-text("Save Changes")');
  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, '03-settings-general-saved');
  }

  await page.click('button:has-text("Modules")');
  await sleep(800);
  await ss(page, '03-settings-modules');

  const toggles = await page.$$('button[role="switch"]');
  if (toggles.length > 0) {
    await toggles[0].click();
    await sleep(300);
    await ss(page, '03-settings-modules-toggle');
    await toggles[0].click();
    await sleep(200);
  }

  await page.click('button:has-text("Members")');
  await sleep(800);
  await ss(page, '03-settings-members');

  const addBtn = await page.$('button:has-text("Add Member")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '03-settings-add-member-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  const editRoleBtns = await page.$$('button:has-text("Edit Role")');
  if (editRoleBtns.length > 0) {
    await editRoleBtns[0].click();
    await sleep(500);
    await ss(page, '03-settings-edit-role');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-04: Work Packages Table ──────────────────────────────────────────────
async function captureWPTable() {
  console.log('\n[UG-04] Work Packages Table...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  const wpUrl = `${BASE_URL}/projects/${PROJECT_ID}/work-packages`;

  await page.goto(wpUrl, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await ss(page, '04-wp-table');

  const rows = await page.$$('tbody tr');
  if (rows.length > 0) {
    await rows[0].hover();
    await sleep(300);
    await ss(page, '04-wp-table-row-hover');

    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length > 1) {
      await checkboxes[1].click();
      await sleep(300);
      await ss(page, '04-wp-table-selected');
      await checkboxes[2].click();
      await sleep(300);
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  const newBtn = await page.$('button:has-text("New Work Package"), button:has-text("＋")');
  if (newBtn) {
    await newBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '04-wp-new-dialog');
    const subjInput = await page.$('input[id*="subject" i], [data-testid*="subject"]');
    if (subjInput) {
      await subjInput.fill('Test task for screenshot');
      await sleep(300);
      await ss(page, '04-wp-new-dialog-filled');
    }
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  if (rows.length > 0) {
    await rows[0].dblclick();
    await page.waitForTimeout(1000);
    const dialog = await page.$('[role="dialog"], [data-testid*="inline"]');
    if (dialog) await ss(page, '04-wp-inline-edit');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-05: Gantt ─────────────────────────────────────────────────────────────
async function captureGantt() {
  console.log('\n[UG-05] Gantt...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  const ganttTab = await page.$('button[role="tab"]:has-text("Gantt"), button:has-text("Gantt")');
  if (ganttTab) { await ganttTab.click(); await sleep(1500); }
  await ss(page, '05-gantt');

  const zoomIn = await page.$('button:has-text("Zoom In")');
  if (zoomIn) {
    await zoomIn.click();
    await sleep(400);
    await ss(page, '05-gantt-zoom-in');
    await zoomIn.click();
    await sleep(400);
    await ss(page, '05-gantt-zoom-out');
  }

  await page.evaluate(() => window.scrollTo(300, 0));
  await sleep(500);
  await ss(page, '05-gantt-scrolled');

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await ss(page, '05-gantt-empty');

  await browser.close();
  console.log('  Done.');
}

// ─── UG-06: Board ─────────────────────────────────────────────────────────────
async function captureBoard() {
  console.log('\n[UG-06] Board...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  const boardTab = await page.$('button[role="tab"]:has-text("Board")');
  if (boardTab) { await boardTab.click(); await sleep(1500); }
  await ss(page, '06-board');

  const configBtn = await page.$('button:has-text("Configure WIP")');
  if (configBtn) {
    await configBtn.click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '06-board-wip-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  const addBtns = await page.$$('button:has-text("＋")');
  if (addBtns.length > 0) {
    await addBtns[0].click({ force: true });
    await sleep(500);
    await ss(page, '06-board-add-card');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(400);
  await ss(page, '06-board-wip');

  await browser.close();
  console.log('  Done.');
}

// ─── UG-07: Calendar ──────────────────────────────────────────────────────────
async function captureCalendar() {
  console.log('\n[UG-07] Calendar...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  const calTab = await page.$('button[role="tab"]:has-text("Calendar")');
  if (calTab) { await calTab.click(); await sleep(1500); }
  await ss(page, '07-calendar');

  const nextMonth = await page.$('button[aria-label*="next" i], button[aria-label*="right" i]');
  if (nextMonth) {
    await nextMonth.click({ force: true });
    await sleep(500);
    await ss(page, '07-calendar-next-month');
    await nextMonth.click({ force: true });
    await sleep(300);
  }

  const todayBtn = await page.$('button:has-text("Today")');
  if (todayBtn) {
    await todayBtn.click({ force: true });
    await sleep(500);
    await ss(page, '07-calendar-today');
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-08: WP Detail ─────────────────────────────────────────────────────────
async function captureWPDetail() {
  console.log('\n[UG-08] Work Package Detail...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  const wpLinks = await page.$$('a[href*="/work-packages/"]');
  if (wpLinks.length > 0) {
    await wpLinks[0].click();
    await page.waitForURL(/\/work-packages\/[^/]+/, { timeout: 8000 });
    await sleep(1500);
  } else {
    await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages/1`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);
  }

  await ss(page, '08-wp-detail');

  const activityTab = await page.$('button:has-text("Activity")');
  if (activityTab) {
    await activityTab.click({ force: true });
    await sleep(800);
    await ss(page, '08-wp-detail-activity');
  }

  const relationsTab = await page.$('button:has-text("Relations")');
  if (relationsTab) {
    await relationsTab.click({ force: true });
    await sleep(800);
    await ss(page, '08-wp-detail-relations');

    const addRelBtn = await page.$('button:has-text("Add Relation")');
    if (addRelBtn) {
      await addRelBtn.click({ force: true });
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
      await sleep(500);
      await ss(page, '08-wp-detail-add-relation');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-09: Forums ────────────────────────────────────────────────────────────
async function captureForums() {
  console.log('\n[UG-09] Forums...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/forums`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '09-forums-list');

  const newForumBtn = await page.$('button:has-text("New Forum")');
  if (newForumBtn) {
    await newForumBtn.click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '09-new-forum-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  const forumLinks = await page.$$('a[href*="/forums/"]');
  if (forumLinks.length > 0) {
    await forumLinks[0].click();
    await page.waitForURL(/\/forums\/\d+/, { timeout: 5000 });
    await sleep(1500);
    await ss(page, '09-thread-list');

    const newThreadBtn = await page.$('button:has-text("New Thread")');
    if (newThreadBtn) {
      await newThreadBtn.click({ force: true });
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
      await sleep(500);
      await ss(page, '09-new-thread-dialog');
      await page.keyboard.press('Escape');
      await sleep(300);
    }

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
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-10: Wiki ──────────────────────────────────────────────────────────────
async function captureWiki() {
  console.log('\n[UG-10] Wiki...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/wiki`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '10-wiki-list');

  const newPageBtn = await page.$('button:has-text("New Page")');
  if (newPageBtn) {
    await newPageBtn.click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '10-new-page-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  const pageLinks = await page.$$('a[href*="/wiki/"]');
  if (pageLinks.length > 0) {
    await pageLinks[0].click();
    await page.waitForURL(/\/wiki\//, { timeout: 5000 });
    await sleep(1500);
    await ss(page, '10-wiki-page');

    const editBtn = await page.$('button:has-text("Edit")');
    if (editBtn) {
      await editBtn.click();
      await sleep(800);
      await ss(page, '10-wiki-edit');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-11: Notifications ─────────────────────────────────────────────────────
async function captureNotifications() {
  console.log('\n[UG-11] Notifications...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/notifications`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '11-notifications');

  const markAllBtn = await page.$('button:has-text("Mark all read")');
  if (markAllBtn) {
    await markAllBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, '11-notifications-marked');
  }

  const nextBtn = await page.$('button:has-text("Next")');
  if (nextBtn) {
    await nextBtn.click();
    await sleep(800);
    await ss(page, '11-notifications-page2');
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-12: My Page ──────────────────────────────────────────────────────────
async function captureMyPage() {
  console.log('\n[UG-12] My Page...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/my-page`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '12-my-page');

  const editBtn = await page.$('button:has-text("Edit Layout")');
  if (editBtn) {
    await editBtn.click();
    await sleep(800);
    await ss(page, '12-my-page-edit-mode');

    const doneBtn = await page.$('button:has-text("Done Editing")');
    if (doneBtn) {
      await doneBtn.click();
      await sleep(500);
    }
  }

  await browser.close();
  console.log('  Done.');
}

// ─── UG-13: Search ────────────────────────────────────────────────────────────
async function captureSearch() {
  console.log('\n[UG-13] Search...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/search`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '13-search');

  const searchInput = await page.$('input[type="search"], input[type="text"]');
  if (searchInput) {
    await searchInput.fill('work');
    await sleep(1500);
    await ss(page, '13-search-results');

    const filterBtns = await page.$$('button[role="tab"]');
    if (filterBtns.length > 0) {
      await filterBtns[0].click();
      await sleep(500);
      await ss(page, '13-search-filter');
    }
  }

  await browser.close();
  console.log('  Done.');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const section = process.argv[2];
  console.log(`\n=== Screenshot Manual ===`);
  console.log(`Output: ${OUT_DIR}`);
  console.log(`Section: ${section || 'ALL'}\n`);

  try {
    if (!section || section === '01-login') await captureLogin();
    if (!section || section === '02-projects') await captureProjects();
    if (!section || section === '03-settings') await captureSettings();
    if (!section || section === '04-wp-table') await captureWPTable();
    if (!section || section === '05-gantt') await captureGantt();
    if (!section || section === '06-board') await captureBoard();
    if (!section || section === '07-calendar') await captureCalendar();
    if (!section || section === '08-wp-detail') await captureWPDetail();
    if (!section || section === '09-forums') await captureForums();
    if (!section || section === '10-wiki') await captureWiki();
    if (!section || section === '11-notifications') await captureNotifications();
    if (!section || section === '12-mypage') await captureMyPage();
    if (!section || section === '13-search') await captureSearch();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }

  console.log('\n=== Done ===');
  const files = fs.readdirSync(OUT_DIR);
  console.log(`Total screenshots: ${files.length}`);
}

main();
