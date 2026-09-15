#!/usr/bin/env node
/**
 * Render a junk-run flyer headlessly: drives the real page (Print Flyer -> area ->
 * Generate Flyer) and captures either PNGs of each .flyer-page or a print-accurate PDF.
 *
 * This exists because the 2026-07 Gazette was built by a throwaway script in a session
 * scratchpad that was later purged, leaving the printed PDFs unreproducible. Keep this
 * file in the repo.
 *
 * Requires puppeteer-core and a local Chrome (not a repo dependency — install ad hoc):
 *   npm i puppeteer-core
 *
 * Usage:
 *   node tools/render-flyer.mjs <url> <out-prefix> [--pdf] [--area "All Areas"]
 *
 * Examples:
 *   node tools/render-flyer.mjs https://yfevents.yakimafinds.com/junk-run/volksfest gz
 *   node tools/render-flyer.mjs https://yfevents.yakimafinds.com/junk-run/volksfest \
 *     volksfest-junkrun-gazette-r1.pdf --pdf
 *
 * Note: the gazette template prints landscape (11x8.5). The page boxes are already
 * landscape, so pass width/height rather than `landscape: true`, or Chrome rotates twice.
 */
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const wantPdf = args.includes('--pdf');
const areaIdx = args.indexOf('--area');
const area = areaIdx > -1 ? args[areaIdx + 1] : 'All Areas';

if (!url || !out) {
  console.error('usage: render-flyer.mjs <url> <out-prefix|out.pdf> [--pdf] [--area NAME]');
  process.exit(1);
}

const CHROME =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try { return require('fs').existsSync(p); } catch { return false; }
  });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1500,1200'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1200, deviceScaleFactor: wantPdf ? 2 : 1 });

const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));

const clickByText = (pattern) =>
  page.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const btn = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  }, pattern);

console.log('open flyer panel:', await clickByText('print flyer'));
await new Promise((r) => setTimeout(r, 2500));
console.log('select area:', await clickByText(area));
await new Promise((r) => setTimeout(r, 1500));
console.log('generate:', await clickByText('generate flyer'));

// The offscreen Leaflet capture runs on an internal ~2.5s timer, then tiles settle.
await page.waitForFunction(() => document.querySelectorAll('.flyer-page').length > 0, {
  timeout: 90000,
});
await new Promise((r) => setTimeout(r, 6000));

if (wantPdf) {
  await page.pdf({
    path: out,
    width: '11in',
    height: '8.5in',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log('wrote', out);
} else {
  const pages = await page.$$('.flyer-page');
  console.log('flyer pages:', pages.length);
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: `${out}-p${i + 1}.png` });
    console.log('wrote', `${out}-p${i + 1}.png`);
  }
}

if (problems.length) {
  console.log('--- page problems ---\n' + problems.slice(0, 10).join('\n'));
}

await browser.close();
