import { chromium } from 'playwright-core';

const base = 'http://localhost:3002';
const out = 'data/lola/shots';
const executablePath = 'C:/Users/Lenovo/AppData/Local/ms-playwright/chromium-1255/chrome-win64/chrome.exe';

const browser = await chromium.launch({ executablePath });
const errors = [];

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
desktop.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
desktop.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

await desktop.goto(base, { waitUntil: 'networkidle' });
await desktop.waitForTimeout(2000);
await desktop.evaluate(() => document.getElementById('method')?.scrollIntoView());
await desktop.waitForTimeout(2600);
await desktop.locator('#method').screenshot({ path: `${out}/sunline-desktop-full.png` });
await desktop.locator('.sunline-stage').screenshot({ path: `${out}/sunline-desktop-stage.png` });
await desktop.locator('.sunline-mission').screenshot({ path: `${out}/sunline-desktop-mission.png` });

// Compare view, scrolled to the ranking table.
await desktop.evaluate(() => window.scrollTo(0, 0));
await desktop.waitForTimeout(500);
await desktop.getByRole('button', { name: /open the observatory/i }).first().click();
await desktop.waitForTimeout(3000);
await desktop.getByRole('button', { name: /compare/i }).first().click();
await desktop.waitForTimeout(1800);
await desktop.locator('#pareto-ranking').screenshot({ path: `${out}/compare-desktop-table.png` });
await desktop.evaluate(() => document.getElementById('pareto-ranking')?.scrollIntoView());
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: `${out}/compare-desktop-viewport.png` });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
mobile.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`MOBILE: ${msg.text()}`);
});
mobile.on('pageerror', (err) => errors.push(`MOBILE PAGEERROR: ${err.message}`));
await mobile.goto(base, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(2000);
await mobile.evaluate(() => document.getElementById('method')?.scrollIntoView());
await mobile.waitForTimeout(2600);
await mobile.screenshot({ path: `${out}/sunline-mobile-viewport.png` });
await mobile.locator('#method').screenshot({ path: `${out}/sunline-mobile-full.png` });
await mobile.locator('.sunline-stage').screenshot({ path: `${out}/sunline-mobile-stage.png` });
await mobile.locator('.sunline-mission').screenshot({ path: `${out}/sunline-mobile-mission.png` });

await mobile.evaluate(() => window.scrollTo(0, 0));
await mobile.waitForTimeout(500);
await mobile.getByRole('button', { name: /open the observatory/i }).first().click();
await mobile.waitForTimeout(3000);
await mobile.getByRole('button', { name: /compare/i }).first().click();
await mobile.waitForTimeout(1800);
await mobile.evaluate(() => document.getElementById('pareto-ranking')?.scrollIntoView());
await mobile.waitForTimeout(800);
await mobile.locator('#pareto-ranking').screenshot({ path: `${out}/compare-mobile-table.png` });

console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();
