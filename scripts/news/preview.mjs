// Local-only draft preview. Draft content stays in memory and never enters dist.
import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { headFor, pathFor } from './document.mjs';

const [slug, option] = process.argv.slice(2);
const language = option === '--lang=cs' ? 'cs' : 'en';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '') || (option && option !== '--lang=cs') || process.argv.length > 4) {
  console.error('Usage: npm run news:preview -- your-article-slug [--lang=cs]');
  process.exit(1);
}

const filename = `${language === 'cs' ? 'cs-' : ''}${slug}.json`;
const articleUrl = new URL(`../../content/news/${filename}`, import.meta.url);
const dist = resolve('dist');
const publicDirectory = resolve('public');
let shell;
try {
  shell = await readFile(resolve(dist, 'news.html'), 'utf8');
} catch {
  console.error('Run npm run build once before previewing a draft. Drafts stay out of that build.');
  process.exit(1);
}

const vite = await createViteServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, optimizeDeps: { disabled: true }, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
const { default: Journal, publishedArticles } = await vite.ssrLoadModule('/src/news/Journal.jsx');
const articlePath = `/news/${language === 'cs' ? 'cs/' : ''}${slug}`;
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2' };

async function renderDraft() {
  const article = JSON.parse(await readFile(articleUrl, 'utf8'));
  if (article.slug !== slug || article.language !== language || article.status !== 'draft') throw new Error(`Expected a draft in content/news/${filename}`);
  const variants = publishedArticles.filter(item => !(item.slug === slug && item.language === language));
  publishedArticles.unshift(article);
  let body;
  try { body = renderToString(createElement(Journal, { path: pathFor(article) })); }
  finally { publishedArticles.shift(); }
  const head = headFor(article, [...variants, article]).replace('content="index,follow"', 'content="noindex,nofollow"');
  const page = shell.replace(/<title>[\s\S]*?<script type="application\/ld\+json">[\s\S]*?<\/script>/, head)
    .replace(/<script type="module"[^>]*><\/script>/g, '')
    .replace(/<link rel="modulepreload"[^>]*>/g, '')
    .replace(/<html lang="[^"]+">/, `<html lang="${language}">`);
  const start = page.indexOf('<div id="journal-root">');
  const end = page.lastIndexOf('</div>', page.indexOf('</body>')) + '</div>'.length;
  if (start < 0 || end <= start) throw new Error('Built Journal shell is missing its root element');
  return page.slice(0, start) + `<div id="journal-root">${body}</div>` + page.slice(end);
}

const server = createHttpServer(async (request, response) => {
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  try {
    if (pathname === articlePath || pathname === `${articlePath}/`) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(await renderDraft());
      return;
    }
    const asset = /^\/assets\/[A-Za-z0-9._-]+$/.test(pathname);
    const image = /^\/news-images\/[A-Za-z0-9._-]+$/.test(pathname);
    if (asset || image || pathname === '/favicon.svg') {
      const file = resolve(asset ? dist : publicDirectory, `.${pathname}`);
      const extension = file.slice(file.lastIndexOf('.'));
      response.setHeader('Content-Type', types[extension] || 'application/octet-stream');
      response.end(await readFile(file));
      return;
    }
    response.statusCode = 404;
    response.end('Not found');
  } catch (error) {
    response.statusCode = error.code === 'ENOENT' ? 404 : 500;
    response.end(error.message);
  }
});

server.listen(4174, '127.0.0.1', () => console.log(`Local draft preview: http://127.0.0.1:4174${articlePath}\nPress Ctrl+C to stop.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); vite.close().then(() => process.exit()); });
