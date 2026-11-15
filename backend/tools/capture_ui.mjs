import { chromium } from 'playwright-core';

const base = 'http://localhost:3002';
const out = 'data/lola/shots';
const executablePath = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1255/chrome-win64/chrome.exe';

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(4200);
await page.screenshot({ path: `${out}/landing-desktop.png` });

await page.evaluate(() => document.getElementById('method')?.scrollIntoView());
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/landing-method.png` });

await page.evaluate(() => document.getElementById('evidence')?.scrollIntoView());
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/landing-evidence.png` });

// Enter the workspace via the primary CTA.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);
await page.getByRole('button', { name: /open the observatory/i }).first().click();
await page.waitForTimeout(3600);
await page.screenshot({ path: `${out}/workspace-terrain.png` });

// Scroll down to the viewport + panels.
await page.evaluate(() => window.scrollTo(0, 720));
await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/workspace-terrain-lower.png` });

// Time view
await page.getByRole('button', { name: /time & place/i }).first().click();
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/workspace-time.png` });

// Compare view
await page.getByRole('button', { name: /compare/i }).first().click();
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/workspace-compare.png` });
await page.evaluate(() => window.scrollTo(0, 720));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/workspace-compare-lower.png` });

// Mobile landing
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
mobile.on('pageerror', (err) => errors.push(`MOBILE PAGEERROR: ${err.message}`));
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(4200);
await mobile.screenshot({ path: `${out}/landing-mobile.png` });
await mobile.evaluate(() => document.getElementById('method')?.scrollIntoView());
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: `${out}/landing-mobile-method.png` });

// Mobile workspace
await mobile.evaluate(() => window.scrollTo(0, 0));
await mobile.waitForTimeout(500);
await mobile.getByRole('button', { name: /open the observatory/i }).first().click();
await mobile.waitForTimeout(3800);
await mobile.screenshot({ path: `${out}/workspace-mobile.png` });

console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();
