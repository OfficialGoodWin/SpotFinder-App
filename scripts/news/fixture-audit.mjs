// Temporary publication rehearsal. Requires `npm run preview` on port 4173.
// The fixture is deleted in finally and never enters a deployment artifact.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { headFor, origin } from './document.mjs';
import { resolve } from 'node:path';

const fixture = {
  slug: 'publication-fixture', title: 'Publication fixture', summary: 'A temporary test of the article template.',
  language: 'en', category: 'Guides', author: { name: 'SpotFinder', type: 'Organization' },
  publishedAt: '2026-10-20', updatedAt: '2026-10-21',
  canonicalUrl: `${origin}/news/publication-fixture`,
  cover: { src: '/og-image.png', alt: 'SpotFinder graphic used for a local test only', width: 1200, height: 630 },
  body: [{ type: 'paragraph', text: 'Temporary article content used only to verify direct HTML delivery.' }, { type: 'heading', text: 'Verification section' }],
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
  console.log('Temporary published article: direct visit, refresh, source content, metadata and JSON-LD OK');
} finally {
  await server.close();
  await unlink(output).catch(() => {});
}
