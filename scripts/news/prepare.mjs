import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { origin } from './document.mjs';

const directory = new URL('../../content/news/', import.meta.url);
const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
const published = [];
const seen = new Set();
const publishedTitles = new Set();
const publishedDescriptions = new Set();
const categories = new Set(['Discover Places', 'Guides', 'SpotFinder Updates', 'Community Stories']);
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const validImagePath = src => typeof src === 'string' && /^\/news-images\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|avif)$/.test(src);
async function checkResponsiveImages(srcSet, name) {
  if (!srcSet) return;
  for (const candidate of srcSet.split(',')) {
    const [src, descriptor] = candidate.trim().split(/\s+/);
    if (!validImagePath(src) || !/^\d+(?:w|x)$/.test(descriptor || '')) throw new Error(`Published ${name} has invalid responsive image`);
    await stat(join('public', src.slice(1)));
  }
}

for (const name of names) {
  const article = JSON.parse(await readFile(new URL(name, directory), 'utf8'));
  const key = `${article.language}:${article.slug}`;
  if (seen.has(key)) throw new Error(`Duplicate article variant: ${key}`);
  seen.add(key);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error(`Invalid slug in ${name}`);
  if (!['en', 'cs'].includes(article.language)) throw new Error(`Unsupported language in ${name}`);
  if (!categories.has(article.category)) throw new Error(`Invalid category in ${name}`);
  if (!['draft', 'published'].includes(article.status)) throw new Error(`Invalid status in ${name}`);
  if (article.status !== 'published') continue;
  const path = `/news/${article.language === 'cs' ? 'cs/' : ''}${article.slug}`;
  const required = ['title', 'summary', 'author', 'body', 'cover'];
  for (const field of required) if (!article[field]) throw new Error(`Published ${name} needs ${field}`);
  for (const [label, value, values] of [['title', article.title, publishedTitles], ['description', article.summary, publishedDescriptions]]) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Published ${name} needs ${label}`);
    const normalized = `${article.language}:${value.trim().toLocaleLowerCase()}`;
    if (values.has(normalized)) throw new Error(`Published ${name} duplicates a ${label}`);
    values.add(normalized);
  }
  if (!article.author.name || !['Person', 'Organization'].includes(article.author.type)) throw new Error(`Published ${name} needs a real author identity`);
  if (!validDate(article.publishedAt) || (article.updatedAt && (!validDate(article.updatedAt) || article.updatedAt < article.publishedAt))) throw new Error(`Published ${name} has invalid dates`);
  if (article.publishedAt > new Date().toISOString().slice(0, 10) || (article.updatedAt && article.updatedAt > new Date().toISOString().slice(0, 10))) throw new Error(`Published ${name} has future dates`);
  if (article.canonicalUrl !== origin + path) throw new Error(`Published ${name} has wrong canonical URL`);
  if (!Array.isArray(article.body) || article.body.length < 2 || !article.body.some(block => block?.type === 'paragraph' && typeof block.text === 'string' && block.text.trim())) throw new Error(`Published ${name} needs substantive body`);
  for (const block of article.body) {
    if (!block || !['paragraph', 'heading', 'list', 'quote', 'image'].includes(block.type)) throw new Error(`Published ${name} has unsupported body block`);
    if (['paragraph', 'heading', 'quote'].includes(block.type) && (typeof block.text !== 'string' || !block.text.trim())) throw new Error(`Published ${name} has empty body text`);
    if (block.type === 'list' && (!Array.isArray(block.items) || !block.items.length || block.items.some(item => typeof item !== 'string' || !item.trim()))) throw new Error(`Published ${name} has an empty list`);
  }
  if (article.body.some(block => /editorial outline|before publication|what to verify before publication/i.test(JSON.stringify(block)))) throw new Error(`Published ${name} still contains draft instructions`);
  if (!validImagePath(article.cover.src) || !article.cover.alt || !article.cover.credit || !article.cover.caption || !Number.isInteger(article.cover.width) || !Number.isInteger(article.cover.height) || article.cover.width < 1 || article.cover.height < 1) throw new Error(`Published ${name} needs a local cover, dimensions, caption, and photo credit`);
  if (article.cover.creditUrl && !/^https:\/\/[^\s]+$/.test(article.cover.creditUrl)) throw new Error(`Published ${name} has invalid photo credit URL`);
  await stat(join('public', article.cover.src.slice(1)));
  await checkResponsiveImages(article.cover.srcSet, name);
  for (const block of article.body.filter(item => item.type === 'image')) {
    if (!validImagePath(block.src) || !block.alt || !block.caption || !block.credit || !Number.isInteger(block.width) || !Number.isInteger(block.height) || block.width < 1 || block.height < 1) throw new Error(`Published ${name} has incomplete body image or photo credit`);
    if (block.creditUrl && !/^https:\/\/[^\s]+$/.test(block.creditUrl)) throw new Error(`Published ${name} has invalid body photo credit URL`);
    await stat(join('public', block.src.slice(1)));
    await checkResponsiveImages(block.srcSet, name);
  }
  for (const spot of article.spotIds || []) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(spot.id) || !spot.name) throw new Error(`Published ${name} has invalid spot link`);
    if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lon) || Math.abs(spot.lat) > 90 || Math.abs(spot.lon) > 180) throw new Error(`Published ${name} needs verified spot coordinates for its map embed`);
  }
  published.push(article);
}

await writeFile(new URL('../../src/news/published.generated.json', import.meta.url), `${JSON.stringify(published, null, 2)}\n`);
console.log(`Journal: ${published.length} published article(s), ${names.length - published.length} draft(s).`);
