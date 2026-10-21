// Temporary publication rehearsal. Requires `npm run preview` on port 4173.
// The fixture is deleted in finally and never enters a deployment artifact.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';
import { headFor, origin } from './document.mjs';
import { resolve } from 'node:path';

const fixture = {
  slug: 'publication-fixture', title: 'Publication fixture', summary: 'A temporary test of the article template.',
  language: 'en', category: 'Guides', author: { name: 'SpotFinder', type: 'Organization' },
  publishedAt: '2026-10-20', updatedAt: '2026-10-21',
  canonicalUrl: `${origin}/news/publication-fixture`,
  cover: { src: '/news-images/prague-street.webp', alt: 'Prague street in winter', width: 960, height: 1440, caption: 'A Prague street in winter.', credit: 'Tegan Conway / Unsplash', creditUrl: 'https://unsplash.com/photos/cobblestone-street-with-old-buildings-and-lamppost-CtFdquCYqE8' },
  body: [{ type: 'paragraph', text: 'Temporary article content used only to verify direct HTML delivery.' }, { type: 'quote', text: 'A local verification quotation.' }, { type: 'heading', text: 'Verification section' }],
  spotIds: [], relatedSlugs: [],
};
const output = new URL('../../dist/news/publication-fixture.html', import.meta.url);
const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, optimizeDeps: { disabled: true }, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { publishedArticles } = await server.ssrLoadModule('/src/news/articles.js');
  const { default: Journal } = await server.ssrLoadModule('/src/news/Journal.jsx');
  publishedArticles.push(fixture);
  const shell = await readFile(new URL('../../dist/news.html', import.meta.url), 'utf8');
  const headStart = shell.indexOf('<title>');
  const headEnd = shell.indexOf('</script>', headStart) + '</script>'.length;
  const bodyStart = shell.indexOf('<div id="journal-root">');
  const bodyEnd = shell.lastIndexOf('</div>', shell.indexOf('</body>')) + '</div>'.length;
  assert.ok(headStart > 0 && headEnd > headStart && bodyStart > 0 && bodyEnd > bodyStart);
  const body = `<div id="journal-root">${renderToString(createElement(Journal, { path: '/news/publication-fixture' }))}</div>`;
  const html = shell.slice(0, headStart) + headFor(fixture, [fixture]) + shell.slice(headEnd, bodyStart) + body + shell.slice(bodyEnd);
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, html);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('http://127.0.0.1:4173/news/publication-fixture');
    assert.equal(response.status, 200);
    const source = await response.text();
    assert.match(source, /Temporary article content used only to verify direct HTML delivery/);
    assert.match(source, /<title>Publication fixture \| SpotFinder Journal<\/title>/);
    const data = JSON.parse(source.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.equal(data['@type'], 'BlogPosting');
  }
  const browser = await chromium.launch({ executablePath: process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, javaScriptEnabled: false });
      await page.goto('http://127.0.0.1:4173/news/publication-fixture', { waitUntil: 'networkidle' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      assert.equal(await page.evaluate(() => { const image = document.querySelector('.journal-hero img'); return Boolean(image?.complete && image.naturalWidth > 0); }), true);
      assert.equal(await page.evaluate(() => document.querySelectorAll('.journal-body blockquote').length), 1);
      if (process.env.SPOTFINDER_JOURNAL_SCREENSHOT) await page.screenshot({ path: `.tmp-journal-article-${width}.png`, fullPage: true });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('Temporary published article: direct visit, refresh, source content, metadata and JSON-LD OK');
} finally {
  await server.close();
  await unlink(output).catch(() => {});
}
