import { readFile, writeFile } from 'node:fs/promises';
import { origin, pathFor } from './document.mjs';

const [slug, option] = process.argv.slice(2);
const language = option === '--lang=cs' ? 'cs' : 'en';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '') || (option && option !== '--lang=cs') || process.argv.length > 4) {
  console.error('Usage: npm run news:new -- your-article-slug [--lang=cs]');
  process.exitCode = 1;
} else {
  const article = JSON.parse(await readFile(new URL('../../docs/article-template.json', import.meta.url), 'utf8'));
  article.slug = slug;
  article.language = language;
  article.canonicalUrl = origin + pathFor(article);
  const filename = `${language === 'cs' ? 'cs-' : ''}${slug}.json`;
  const destination = new URL(`../../content/news/${filename}`, import.meta.url);
  try {
    await writeFile(destination, `${JSON.stringify(article, null, 2)}\n`, { flag: 'wx' });
    console.log(`Created draft: content/news/${filename}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.error(`Draft already exists: content/news/${filename}`);
    process.exitCode = 1;
  }
}
