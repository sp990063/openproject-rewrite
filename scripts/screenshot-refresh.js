#!/usr/bin/env node
/**
 * Screenshot re-capture for mismatched screenshots
 * Fixes: Gantt, Board, Calendar, Settings, WP Detail, Forum, Wiki views
 * 
 * Usage: node scripts/screenshot-refresh.js [section]
 * Sections: gantt, board, calendar, settings, wpdetail, forums, wiki, search, mypage
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3333';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'images-manual');
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo123';
const PROJECT_ID = 'cmo4ojw5r000gy8qxbipmo46s';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ss(page, name) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  const size = fs.statSync(filePath).size;
  console.log(`  ✓ ${name} (${(size/1024).toFixed(0)}KB)`);
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  await sleep(1000);
}

// ── GANTT ────────────────────────────────────────────────────────────────────
async function captureGantt() {
  console.log('\n[Gantt]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);
  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Click Gantt tab
  const tabs = await page.$$('button[role="tab"]');
  let ganttTab = null;
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text && text.trim() === 'Gantt') { ganttTab = tab; break; }
  }
  if (!ganttTab) {
    // Try by aria-selected or data
    ganttTab = await page.$('[data-view="gantt"], button:has-text("Gantt")');
  }
  if (ganttTab) {
    await ganttTab.click();
    await sleep(2000);
  }
  await ss(page, '05-gantt');

  // Scrolled view
  await page.evaluate(() => window.scrollTo(400, 0));
  await sleep(500);
  await ss(page, '05-gantt-scrolled');

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);

  // Empty: navigate to a project with no work packages
  // For now just save the current state as gantt-empty
  // Actually the script navigated to work-packages page which has demo data
  // Let's check if there's an empty state by navigating to a new project
  await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  
  // Try to find a way to show empty gantt - create a new project
  const newBtn = await page.$('button:has-text("New Project")');
  if (newBtn) {
    await newBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await page.fill('input[id*="name"], input[placeholder*="name" i]', 'Empty Project');
    const createBtn = await page.$('button:has-text("Create")');
    if (createBtn) await createBtn.click();
    await page.waitForURL(/projects\/[^/]+$/, { timeout: 5000 });
    await sleep(1500);
    
    // Go to work packages and view Gantt
    await page.goto(`${BASE_URL}${page.url()}/work-packages`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    
    // Click Gantt tab
    const gTabs = await page.$$('button[role="tab"]');
    for (const tab of gTabs) {
      const text = await tab.textContent();
      if (text && text.trim() === 'Gantt') { await tab.click(); await sleep(2000); break; }
    }
    await ss(page, '05-gantt-empty');
  } else {
    // Just save current as-is
    await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const gTabs = await page.$$('button[role="tab"]');
    for (const tab of gTabs) {
      const text = await tab.textContent();
      if (text && text.trim() === 'Gantt') { await tab.click(); await sleep(2000); break; }
    }
    await ss(page, '05-gantt-empty');
  }

  await browser.close();
  console.log('  Done.');
}

// ── BOARD ─────────────────────────────────────────────────────────────────────
async function captureBoard() {
  console.log('\n[Board]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);
  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Click Board tab
  const tabs = await page.$$('button[role="tab"]');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text && text.trim() === 'Board') { await tab.click(); await sleep(2000); break; }
  }
  await ss(page, '06-board');

  // WIP dialog
  const configBtn = await page.$('button:has-text("Configure WIP"), button:has-text("WIP")');
  if (configBtn) {
    await configBtn.click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '06-board-wip-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // Add card
  const addBtns = await page.$$('button:has-text("＋"), button:has-text("Add")');
  if (addBtns.length > 0) {
    await addBtns[0].click({ force: true });
    await sleep(500);
    await ss(page, '06-board-add-card');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // WIP exceeded — scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(400);
  await ss(page, '06-board-wip');

  await browser.close();
  console.log('  Done.');
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
async function captureCalendar() {
  console.log('\n[Calendar]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);
  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Click Calendar tab
  const tabs = await page.$$('button[role="tab"]');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text && text.trim() === 'Calendar') { await tab.click(); await sleep(2000); break; }
  }
  await ss(page, '07-calendar');

  // Navigate to next month
  const nextBtn = await page.$('button[aria-label*="next" i], button[aria-label*="right" i], button:has-text("›")');
  if (nextBtn) {
    await nextBtn.click({ force: true });
    await sleep(500);
    await ss(page, '07-calendar-next-month');
  }

  // Today button
  const todayBtn = await page.$('button:has-text("Today")');
  if (todayBtn) {
    await todayBtn.click({ force: true });
    await sleep(500);
    await ss(page, '07-calendar-today');
  }

  await browser.close();
  console.log('  Done.');
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
async function captureSettings() {
  console.log('\n[Settings]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);

  const settingsUrl = `${BASE_URL}/projects/${PROJECT_ID}/settings`;

  // General
  await page.goto(settingsUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '03-settings-general');

  // Edit name
  const nameInput = await page.$('input[id*="name" i], input[placeholder*="name" i]');
  if (nameInput) {
    await nameInput.fill('Demo Project Updated');
    await sleep(300);
    await ss(page, '03-settings-general-edit');
    await nameInput.fill('Demo Project');
    await sleep(200);
  }

  // Save
  const saveBtn = await page.$('button:has-text("Save")');
  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, '03-settings-general-saved');
  }

  // Modules tab
  const modulesTab = await page.$('button:has-text("Modules")');
  if (modulesTab) { await modulesTab.click(); await sleep(1000); }
  await ss(page, '03-settings-modules');

  // Members tab
  const membersTab = await page.$('button:has-text("Members")');
  if (membersTab) { await membersTab.click(); await sleep(1000); }
  await ss(page, '03-settings-members');

  // Add member dialog
  const addBtn = await page.$('button:has-text("Add Member")');
  if (addBtn) {
    await addBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '03-settings-add-member-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // Edit role
  const editBtns = await page.$$('button:has-text("Edit Role")');
  if (editBtns.length > 0) {
    await editBtns[0].click();
    await sleep(500);
    await ss(page, '03-settings-edit-role');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  await browser.close();
  console.log('  Done.');
}

// ── WP DETAIL ─────────────────────────────────────────────────────────────────
async function captureWPDetail() {
  console.log('\n[WP Detail]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);
  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Click first work package link
  const wpLinks = await page.$$('a[href*="/work-packages/"]');
  if (wpLinks.length > 0) {
    await wpLinks[0].click();
    await page.waitForURL(/work-packages\/[^/]+$/, { timeout: 8000 });
  } else {
    await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/work-packages/1`, { waitUntil: 'domcontentloaded' });
  }
  await sleep(2000);
  await ss(page, '08-wp-detail');

  // Activity tab
  const actTab = await page.$('button:has-text("Activity")');
  if (actTab) { await actTab.click(); await sleep(800); }
  await ss(page, '08-wp-detail-activity');

  // Relations tab
  const relTab = await page.$('button:has-text("Relations")');
  if (relTab) { await relTab.click(); await sleep(800); }
  await ss(page, '08-wp-detail-relations');

  // Full detail
  await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '08-wp-detail-full');

  await browser.close();
  console.log('  Done.');
}

// ── FORUMS ───────────────────────────────────────────────────────────────────
async function captureForums() {
  console.log('\n[Forums]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/forums`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '09-forums-list');

  const newForumBtn = await page.$('button:has-text("New Forum")');
  if (newForumBtn) {
    await newForumBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '09-new-forum-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // Thread list
  const forumLinks = await page.$$('a[href*="/forums/"]');
  if (forumLinks.length > 0) {
    await forumLinks[0].click();
    await page.waitForURL(/forums\/\d+/, { timeout: 5000 });
    await sleep(1500);
    await ss(page, '09-thread-list');

    // Thread detail
    const threadLinks = await page.$$('a[href*="/threads/"]');
    if (threadLinks.length > 0) {
      await threadLinks[0].click();
      await page.waitForURL(/threads\/\d+/, { timeout: 5000 });
      await sleep(1500);
      await ss(page, '09-thread-detail');
    }
  }

  await browser.close();
  console.log('  Done.');
}

// ── WIKI ─────────────────────────────────────────────────────────────────────
async function captureWiki() {
  console.log('\n[Wiki]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/wiki`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '10-wiki-list');

  const newPageBtn = await page.$('button:has-text("New Page")');
  if (newPageBtn) {
    await newPageBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
    await sleep(500);
    await ss(page, '10-new-page-dialog');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // Wiki page
  const pageLinks = await page.$$('a[href*="/wiki/"]');
  if (pageLinks.length > 0) {
    await pageLinks[0].click();
    await page.waitForURL(/wiki\//, { timeout: 5000 });
    await sleep(1500);
    await ss(page, '10-wiki-page');

    // Edit mode
    const editBtn = await page.$('button:has-text("Edit")');
    if (editBtn) {
      await editBtn.click();
      await sleep(800);
      await ss(page, '10-wiki-edit-attempt');
      await page.keyboard.press('Escape');
      await sleep(300);
    }
  }

  await browser.close();
  console.log('  Done.');
}

// ── SEARCH ───────────────────────────────────────────────────────────────────
async function captureSearch() {
  console.log('\n[Search]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);

  await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/search`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '13-search');

  // Type a search term
  const searchInput = await page.$('input[type="search"], input[placeholder*="search" i]');
  if (searchInput) {
    await searchInput.fill('demo');
    await page.waitForTimeout(1500);
    await ss(page, '13-search-results');
  }

  await browser.close();
  console.log('  Done.');
}

// ── MY PAGE ──────────────────────────────────────────────────────────────────
async function captureMyPage() {
  console.log('\n[My Page]');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  await login(page);

  await page.goto(`${BASE_URL}/my-page`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await ss(page, '12-my-page');

  const editBtn = await page.$('button:has-text("Edit Layout"), button:has-text("Edit")');
  if (editBtn) {
    await editBtn.click();
    await sleep(800);
    await ss(page, '12-my-page-edit-mode');
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  await browser.close();
  console.log('  Done.');
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const section = process.argv[2] || 'all';

const sections = {
  gantt: captureGantt,
  board: captureBoard,
  calendar: captureCalendar,
  settings: captureSettings,
  wpdetail: captureWPDetail,
  forums: captureForums,
  wiki: captureWiki,
  search: captureSearch,
  mypage: captureMyPage,
};

async function main() {
  if (section === 'all') {
    for (const [name, fn] of Object.entries(sections)) {
      try { await fn(); } catch(e) { console.error(`  ✗ ${name}: ${e.message}`); }
    }
  } else if (sections[section]) {
    try { await sections[section](); } catch(e) { console.error(`  ✗ ${section}: ${e.message}`); }
  } else {
    console.log(`Unknown section: ${section}`);
    console.log('Available:', Object.keys(sections).join(', '));
  }
}

main();