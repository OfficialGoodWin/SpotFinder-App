import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { headFor, origin, pathFor } from '../scripts/news/document.mjs';

const fixture = {
  slug: 'verified-viewpoint', title: 'A verified viewpoint', summary: 'A real editorial description would go here.',
  language: 'en', category: 'Discover Places', author: { name: 'SpotFinder', type: 'Organization' },
  publishedAt: '2026-10-20', updatedAt: '2026-10-21', status: 'published',
  canonicalUrl: `${origin}/news/verified-viewpoint`,
  cover: { src: '/news-images/example.webp', alt: 'Verified viewpoint', width: 1200, height: 800 },
  body: [{ type: 'paragraph', text: 'Useful article body <script>alert(1)</script>' }, { type: 'heading', text: 'Getting there' }],
  spotIds: [{ id: 'real_approved_id', name: 'Verified place' }], relatedSlugs: [],
};

test('published article metadata is specific, escaped, and valid JSON-LD', () => {
  const head = headFor(fixture, [fixture]);
  assert.match(head, /<title>A verified viewpoint \| SpotFinder Journal<\/title>/);
  assert.ok(head.includes(`rel="canonical" href="${origin}/news/verified-viewpoint"`));
  assert.match(head, /article:published_time" content="2026-10-20"/);
  assert.match(head, /og:image:width" content="1200"/);
  assert.doesNotMatch(head, /hreflang=/);
  const data = JSON.parse(head.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(data['@type'], 'BlogPosting');
  assert.equal(data.dateModified, '2026-10-21');
  assert.equal(data.author.name, 'SpotFinder');
  assert.equal(data.image.width, 1200);
  assert.equal(data.breadcrumb.itemListElement.length, 3);
  const czech = { ...fixture, language: 'cs', canonicalUrl: `${origin}/news/cs/verified-viewpoint` };
  assert.match(headFor(fixture, [fixture, czech]), /hreflang="cs"/);
  assert.equal(pathFor(czech), '/news/cs/verified-viewpoint');
});

test('article body renders without executable HTML and includes ordinary place link', async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, optimizeDeps: { disabled: true }, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { publishedArticles } = await server.ssrLoadModule('/src/news/articles.js');
    const { default: Journal } = await server.ssrLoadModule('/src/news/Journal.jsx');
    publishedArticles.push(fixture);
    try {
      const html = renderToStaticMarkup(createElement(Journal, { path: '/news/verified-viewpoint' }));
      assert.match(html, /Useful article body &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
      assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
      assert.match(html, /href="\/spot\/real_approved_id"/);
      assert.match(html, /<h1>A verified viewpoint<\/h1>/);
      assert.match(html, /href="\/news"/);
      assert.match(renderToStaticMarkup(createElement(Journal, { path: '/news/unknown' })), /<h1>404<\/h1>/);
    } finally { publishedArticles.pop(); }
  } finally { await server.close(); }
});

test('current build has crawlable landing and excludes all drafts', async () => {
  const html = await readFile(new URL('../dist/news.html', import.meta.url), 'utf8');
  const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  const drafts = (await readdir(new URL('../content/news/', import.meta.url))).filter(name => name.endsWith('.json'));
  assert.match(html, /<h1>Journal/);
  assert.ok(html.includes(`rel="canonical" href="${origin}/news"`));
  assert.match(html, /<main id="main-content"/);
  assert.ok(sitemap.includes(`<loc>${origin}/news</loc>`));
  for (const name of drafts) {
    const draft = JSON.parse(await readFile(new URL(`../content/news/${name}`, import.meta.url), 'utf8'));
    if (draft.status === 'draft') {
      assert.doesNotMatch(html, new RegExp(draft.slug));
      assert.doesNotMatch(sitemap, new RegExp(draft.slug));
      const path = `../dist/news/${draft.language === 'cs' ? 'cs/' : ''}${draft.slug}.html`;
      await assert.rejects(readFile(new URL(path, import.meta.url)));
    }
  }
});
