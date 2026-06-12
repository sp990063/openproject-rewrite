// scripts/debug-network.js
// Dump all network requests during a single page load.
import { chromium } from 'playwright'

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const c = await b.newContext()
const p = await c.newPage()
p.on('request', (r) => console.log('REQ', r.method(), r.url()))
p.on('response', (r) => console.log('RES', r.status(), r.url()))
p.on('requestfailed', (r) => console.log('FAIL', r.url(), r.failure()?.errorText))
p.on('console', (m) => console.log('CON', m.type(), m.text()))
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 15000 })
await p.waitForTimeout(2000)
await b.close()
