import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { origin, escape, pathFor, headFor } from './document.mjs';

const dist = new URL('../../dist/', import.meta.url);
const shell = await readFile(new URL('news-shell.html', dist), 'utf8');
const articles = JSON.parse(await readFile(new URL('../../src/news/published.generated.json', import.meta.url), 'utf8'));

const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, optimizeDeps: { disabled: true }, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: Journal } = await server.ssrLoadModule('/src/news/Journal.jsx');
  const pages = [{ path: '/news', article: null }, ...(articles.some(article => article.language === 'cs') ? [{ path: '/news/cs', article: null }] : []), ...articles.map(article => ({ path: pathFor(article), article }))];
  for (const { path, article } of pages) {
    const landingLanguage = path === '/news/cs' ? 'cs' : 'en';
    const html = shell.replace(/<title>.*?<\/title>/, headFor(article, articles, landingLanguage))
      .replace('<html lang="en">', `<html lang="${article?.language || landingLanguage}">`)
      .replace('<div id="journal-root"></div>', `<div id="journal-root">${renderToString(createElement(Journal, { path }))}</div>`);
    const output = new URL(`.${path}.html`, dist);
    await mkdir(new URL('.', output), { recursive: true });
    await writeFile(output, html);
  }
  const basePages = ['/', '/FAQ', '/PrivacyPolicy', '/TermsAndConditions', '/CookiePolicy', '/RefundPolicy', '/Status', '/updates'];
  const urls = [...basePages, '/news', ...(articles.some(article => article.language === 'cs') ? ['/news/cs'] : []), ...articles.map(pathFor)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `  <url><loc>${escape(origin + path)}</loc></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(new URL('sitemap.xml', dist), sitemap);
  await unlink(new URL('news-shell.html', dist));
  console.log(`Journal: prerendered ${pages.length} page(s); sitemap contains ${urls.length} URL(s).`);
} finally {
  await server.close();
}
