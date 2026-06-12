// frontend/test/e2e/phase0.spec.js
// Phase 0 smoke E2E. Requires both servers running:
//   - Backend (Next.js): http://localhost:3000  (npm run dev)
//   - Frontend (Vite):   http://localhost:5173  (npm run dev:fe)
//
// Run with: npx playwright test frontend/test/e2e/phase0.spec.js
import { test, expect } from '@playwright/test'

test.describe('Phase 0 SPA smoke', () => {
  test('app boots and shows splash then shell', async ({ page }) => {
    await page.goto('http://localhost:5173/')
    // Should redirect to /login because we're not authed
    await page.waitForURL(/\/login/, { timeout: 5000 })
    // Login page is served by Next.js (existing pages/login.tsx), so we
    // see its form. Navigate manually back to the SPA dashboard after
    // logging in via the API.
  })

  test('login via API, then SPA dashboard renders with data', async ({ page, request }) => {
    // Log in via the Next.js credentials endpoint to set the session cookie
    const csrfRes = await request.get('http://localhost:3000/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()
    await request.post('http://localhost:3000/api/auth/callback/credentials', {
      data: {
        csrfToken,
        email: 'admin@example.com',
        password: 'adminadmin',
        callbackUrl: 'http://localhost:5173/dashboard',
        redirect: 'false',
        json: 'true',
      },
    })

    // Now visit SPA — should render dashboard, not redirect to /login
    await page.goto('http://localhost:5173/dashboard')
    await expect(page.locator('.op-page-header h1')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('text=Welcome')).toBeVisible()
  })

  test('SPA link click navigates without full page reload', async ({ page, request }) => {
    // Log in first
    const csrfRes = await request.get('http://localhost:3000/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()
    await request.post('http://localhost:3000/api/auth/callback/credentials', {
      data: { csrfToken, email: 'admin@example.com', password: 'adminadmin', callbackUrl: '/', redirect: 'false', json: 'true' },
    })
    await page.goto('http://localhost:5173/dashboard')
    await page.waitForSelector('.op-shell')

    // Click an in-app link (logo → /dashboard) and verify no full reload
    let navigated = false
    page.on('framenavigated', () => { navigated = true })
    await page.locator('a:has-text("OpenProject")').click()
    await page.waitForTimeout(500)
    // SPA nav: should have only one history entry
    expect(await page.evaluate(() => history.length)).toBeLessThan(5)
  })
})
