import React from 'react';
import { categories, publishedArticles } from './articles';
import './journal.css';

const copy = {
  en: { journal: 'Journal', eyebrow: 'Notes from the map', intro: 'Ideas for finding your next place, practical guides, and verified updates from SpotFinder.', explore: 'Explore the map', latest: 'Latest stories', empty: 'Our first stories are being checked for accuracy, image rights, and useful details. Please check back soon.', all: 'All stories', related: 'Keep exploring', place: 'View this place on SpotFinder', home: 'Back to Journal', updated: 'Updated', missing: 'This story is unavailable.' },
  cs: { journal: 'Žurnál', eyebrow: 'Poznámky z mapy', intro: 'Tipy na další místa, praktické průvodce a ověřené novinky ze SpotFinderu.', explore: 'Prozkoumat mapu', latest: 'Nejnovější články', empty: 'První články ověřujeme z hlediska přesnosti, práv k fotografiím a užitečných informací. Brzy se sem vraťte.', all: 'Všechny články', related: 'Další čtení', place: 'Zobrazit místo ve SpotFinderu', home: 'Zpět do Žurnálu', updated: 'Aktualizováno', missing: 'Tento článek není dostupný.' },
};
const categoryCopy = { cs: { 'Discover Places': 'Objevujte místa', 'Guides': 'Průvodci', 'SpotFinder Updates': 'Novinky SpotFinderu', 'Community Stories': 'Příběhy komunity' } };
const categoryLabel = (category, lang) => categoryCopy[lang]?.[category] || category;
const landingPath = lang => lang === 'cs' ? '/news/cs' : '/news';

function languageFor(path) { return path === '/news/cs' || path.startsWith('/news/cs/') ? 'cs' : 'en'; }
function articlePath(article) { return `/news/${article.language === 'cs' ? 'cs/' : ''}${article.slug}`; }
export { articlePath };

function BrandHeader({ lang }) {
  const t = copy[lang];
  return <header className="journal-header"><div className="journal-wrap journal-nav"><a className="journal-brand" href="/" aria-label="SpotFinder map"><span className="journal-brand-mark">S</span><span>SpotFinder</span></a><nav aria-label="Journal navigation"><a className="journal-nav-current" href={landingPath(lang)}>{t.journal}</a><a href="/">{t.explore}</a></nav></div></header>;
}

function Cover({ article, eager = false }) {
  if (!article.cover) return <div className="journal-card-placeholder" aria-hidden="true"><span>SpotFinder Journal</span></div>;
  return <img src={article.cover.src} srcSet={article.cover.srcSet || undefined} sizes={article.cover.sizes || undefined} alt={article.cover.alt} width={article.cover.width} height={article.cover.height} loading={eager ? 'eager' : 'lazy'} fetchpriority={eager ? 'high' : undefined} />;
}

function Card({ article, featured = false }) {
  return <article className={`journal-card ${featured ? 'journal-featured' : ''}`}><a href={articlePath(article)} className="journal-card-link"><div className="journal-card-image"><Cover article={article} eager={featured} /></div><div className="journal-card-copy"><span className="journal-kicker">{categoryLabel(article.category, article.language)}</span><h3>{article.title}</h3><p>{article.summary}</p><div className="journal-byline"><span>{article.author.name}</span><span aria-hidden="true">·</span><time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString(article.language, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></div></div></a></article>;
}

function Landing({ lang }) {
  const t = copy[lang];
  const items = publishedArticles.filter(article => article.language === lang).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const [featured, ...rest] = items;
  return <><BrandHeader lang={lang} /><main id="main-content" className="journal-wrap"><section className="journal-intro"><span className="journal-kicker">{t.eyebrow}</span><h1>{t.journal}<span className="journal-dot">.</span></h1><p>{t.intro}</p><div className="journal-intro-rule" /></section>{featured ? <><section aria-label="Featured article"><Card article={featured} featured /></section><section className="journal-list" aria-labelledby="latest-title"><div className="journal-section-heading"><div><span className="journal-kicker">{t.all}</span><h2 id="latest-title">{t.latest}</h2></div></div><div className="journal-category-list" aria-label="Article categories">{categories.map(category => <span key={category}>{categoryLabel(category, lang)}</span>)}</div><div className="journal-grid">{rest.map(article => <Card key={article.slug} article={article} />)}</div></section></> : <section className="journal-empty" aria-labelledby="latest-title"><span className="journal-kicker">{t.latest}</span><h2 id="latest-title">Stories worth the journey</h2><p>{t.empty}</p><a href="/" className="journal-action">{t.explore} <span aria-hidden="true">↗</span></a><div className="journal-category-list" aria-label="Article categories">{categories.map(category => <span key={category}>{categoryLabel(category, lang)}</span>)}</div></section>}</main><Footer lang={lang} /></>;
}

function Block({ block, index }) {
  if (block.type === 'heading') return <h2 id={`section-${index}`}>{block.text}</h2>;
  if (block.type === 'paragraph') return <p>{block.text}</p>;
  if (block.type === 'list') return <ul>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  if (block.type === 'image') return <figure><img src={block.src} srcSet={block.srcSet || undefined} sizes={block.sizes || undefined} alt={block.alt} width={block.width} height={block.height} loading="lazy" /><figcaption>{block.caption}</figcaption></figure>;
  return null;
}

function Article({ article }) {
  const t = copy[article.language];
  const related = publishedArticles.filter(item => item.language === article.language && item.slug !== article.slug && (article.relatedSlugs || []).includes(item.slug));
  return <><BrandHeader lang={article.language} /><main id="main-content" className="journal-wrap"><nav className="journal-breadcrumb" aria-label="Breadcrumb"><a href="/">SpotFinder</a><span aria-hidden="true">/</span><a href={landingPath(article.language)}>{t.journal}</a><span aria-hidden="true">/</span><span aria-current="page">{article.title}</span></nav><article className="journal-article"><header className="journal-article-heading"><span className="journal-kicker">{categoryLabel(article.category, article.language)}</span><h1>{article.title}</h1><p className="journal-deck">{article.summary}</p><div className="journal-byline"><span>{article.author.name}</span><span aria-hidden="true">·</span><time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString(article.language, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time>{article.updatedAt && <><span aria-hidden="true">·</span><span>{t.updated} <time dateTime={article.updatedAt}>{new Date(article.updatedAt).toLocaleDateString(article.language, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></span></>}</div></header>{article.cover && <figure className="journal-hero"><Cover article={article} eager /><figcaption>{article.cover.caption}</figcaption></figure>}<div className="journal-body">{article.body.map((block, index) => <Block key={index} block={block} index={index} />)}</div>{article.spotIds?.length > 0 && <aside className="journal-spots"><h2>{t.explore}</h2>{article.spotIds.map(spot => <a key={spot.id} href={`/spot/${encodeURIComponent(spot.id)}`}>{spot.name} — {t.place} <span aria-hidden="true">↗</span></a>)}</aside>}</article>{related.length > 0 && <section className="journal-list" aria-labelledby="related-title"><div className="journal-section-heading"><h2 id="related-title">{t.related}</h2></div><div className="journal-grid">{related.map(item => <Card key={item.slug} article={item} />)}</div></section>}<a className="journal-return" href={landingPath(article.language)}>← {t.home}</a></main><Footer lang={article.language} /></>;
}

function Footer({ lang }) { return <footer className="journal-footer"><div className="journal-wrap"><span>© SpotFinder</span><nav aria-label="Footer"><a href={landingPath(lang)}>{copy[lang].journal}</a><a href="/FAQ">Help</a><a href="/">{copy[lang].explore}</a></nav></div></footer>; }

export default function Journal({ path = '/news' }) {
  const clean = path.replace(/\/$/, '') || '/news';
  const match = /^\/news\/(?:cs\/)?([a-z0-9-]+)$/.exec(clean);
  const article = match && publishedArticles.find(item => item.slug === match[1] && articlePath(item) === clean);
  if (article && clean === articlePath(article)) return <Article article={article} />;
  if (clean === '/news') return <Landing lang="en" />;
  if (clean === '/news/cs' && publishedArticles.some(item => item.language === 'cs')) return <Landing lang="cs" />;
  return <><BrandHeader lang={languageFor(clean)} /><main className="journal-wrap journal-empty"><h1>404</h1><p>{copy[languageFor(clean)].missing}</p><a className="journal-action" href="/news">{copy[languageFor(clean)].home}</a></main><Footer lang={languageFor(clean)} /></>;
}

export { publishedArticles };
