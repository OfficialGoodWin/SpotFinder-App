import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { categories, publishedArticles } from './articles';
import './journal.css';

const photo = {
  src: '/news-images/prague-street.webp',
  placeholder: '/news-images/prague-street-tiny.webp',
  alt: 'A quiet cobblestone street and pastel buildings in Prague on a winter morning',
  credit: 'Tegan Conway / Unsplash',
  creditUrl: 'https://unsplash.com/photos/cobblestone-street-with-old-buildings-and-lamppost-CtFdquCYqE8',
};
const copy = {
  en: { journal: 'Journal', map: 'Open the map', empty: 'First stories land in November.', email: 'Your email address', request: 'Request a note', emailHint: 'Opens your email app to request a launch note.', related: 'More stories', place: 'On the map', viewPlace: 'View this place on SpotFinder', back: 'Back to Journal', missing: 'This story isn’t on the map.', missingDetail: 'The address may have changed, or the story has not been published.', updated: 'Updated', minutes: 'min read', photograph: 'Photograph' },
  cs: { journal: 'Žurnál', map: 'Otevřít mapu', empty: 'První články vyjdou v listopadu.', email: 'Vaše e-mailová adresa', request: 'Požádat o zprávu', emailHint: 'Otevře e-mailovou aplikaci se žádostí o zprávu.', related: 'Další články', place: 'Na mapě', viewPlace: 'Zobrazit místo ve SpotFinderu', back: 'Zpět na Žurnál', missing: 'Tento článek na mapě není.', missingDetail: 'Adresa se mohla změnit nebo článek ještě nevyšel.', updated: 'Aktualizováno', minutes: 'min čtení', photograph: 'Fotografie' },
};
const categoryCopy = { cs: { 'Discover Places': 'Objevování míst', Guides: 'Průvodci', 'SpotFinder Updates': 'Novinky SpotFinderu', 'Community Stories': 'Příběhy komunity' } };
const categoryLabel = (category, lang) => categoryCopy[lang]?.[category] || category;
const landingPath = lang => lang === 'cs' ? '/news/cs' : '/news';
const dateLabel = (date, lang) => new Date(`${date}T00:00:00Z`).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const readTime = article => Math.max(1, Math.ceil((article.body || []).flatMap(block => [block.text || '', ...(block.items || [])]).join(' ').trim().split(/\s+/).length / 220));
function languageFor(path) { return path === '/news/cs' || path.startsWith('/news/cs/') ? 'cs' : 'en'; }
function articlePath(article) { return `/news/${article.language === 'cs' ? 'cs/' : ''}${article.slug}`; }
export { articlePath };

function BrandHeader({ lang, active = false }) {
  const t = copy[lang];
  return <header className="journal-header"><div className="journal-wrap journal-nav">
    <a className="journal-brand" href="/" aria-label="SpotFinder map"><img className="journal-brand-mark" src="/icon-192.png" width="34" height="34" alt="" /><span>SpotFinder</span></a>
    <nav aria-label="Journal navigation"><a className={active ? 'journal-nav-current' : undefined} aria-current={active ? 'page' : undefined} href={landingPath(lang)}>{t.journal}</a><a className="journal-map-link" href="/">{t.map}</a></nav>
  </div></header>;
}
function Photo({ article, eager = false }) {
  const cover = article?.cover || photo;
  return <span className="journal-photo" style={cover.placeholder ? { '--photo-preview': `url("${cover.placeholder}")` } : undefined}><img src={cover.src} srcSet={cover.srcSet || undefined} sizes={cover.sizes || undefined} alt={cover.alt} width={cover.width || 960} height={cover.height || 1440} loading={eager ? 'eager' : 'lazy'} fetchpriority={eager ? 'high' : undefined}/></span>;
}
function PhotoCredit({ cover = photo, lang = 'en' }) {
  return <span className="journal-photo-credit">{copy[lang].photograph}: {cover.creditUrl ? <a href={cover.creditUrl} rel="noopener noreferrer">{cover.credit}</a> : cover.credit}</span>;
}
function StoryMeta({ article }) {
  return <div className="journal-story-meta"><span className="journal-category">{categoryLabel(article.category, article.language)}</span><time dateTime={article.publishedAt}>{dateLabel(article.publishedAt, article.language)}</time><span>{readTime(article)} {copy[article.language].minutes}</span></div>;
}
function StoryCard({ article, variant = 'standard' }) {
  return <article className={`journal-story journal-story-${variant}`}><a href={articlePath(article)} className="journal-story-link"><div className="journal-story-image"><Photo article={article} eager={variant === 'lead'}/></div><div className="journal-story-copy"><StoryMeta article={article}/><h2>{article.title}</h2><p>{article.summary}</p><div className="journal-story-author">By {article.author.name}</div></div></a><PhotoCredit cover={article.cover} lang={article.language}/></article>;
}
function EmailRequest({ lang }) {
  const [email, setEmail] = useState('');
  const t = copy[lang];
  function request(event) {
    event.preventDefault();
    const subject = encodeURIComponent('SpotFinder Journal launch note');
    const body = encodeURIComponent(`Please email ${email.trim()} when the first Journal stories are published.`);
    window.location.href = `mailto:spotfinder@icloud.com?subject=${subject}&body=${body}`;
  }
  return <form className="journal-email" onSubmit={request}><label htmlFor="journal-email">{t.email}</label><div className="journal-email-row"><Input id="journal-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/><button type="submit">{t.request}</button></div><p>{t.emailHint}</p></form>;
}
function Landing({ lang }) {
  const t = copy[lang];
  const items = publishedArticles.filter(article => article.language === lang).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const [lead, ...rest] = items;
  return <div className="journal-app"><BrandHeader lang={lang} active/><main id="main-content" className="journal-wrap journal-main">
    <div className="journal-masthead"><p>SpotFinder / {lang === 'cs' ? 'Praha a okolí' : 'Prague and beyond'}</p><h1>{t.journal}</h1></div>
    {lead ? <><section className="journal-lead" aria-label="Lead story"><StoryCard article={lead} variant="lead"/></section>{rest.length > 0 && <section className="journal-archive" aria-label="More stories"><div className="journal-archive-heading"><h2>{t.related}</h2><span>{String(rest.length).padStart(2, '0')}</span></div><div className="journal-archive-grid">{rest.map((article, index) => <StoryCard key={article.slug} article={article} variant={index % 3 === 2 ? 'horizontal' : 'standard'}/>)}</div></section>}<div className="journal-category-line" aria-label="Article categories">{categories.map(category => <span key={category}>{categoryLabel(category, lang)}</span>)}</div></> :
      <section className="journal-first-edition" aria-labelledby="first-edition-title"><div className="journal-first-image"><Photo eager/><PhotoCredit lang={lang}/></div><div className="journal-first-copy"><p className="journal-edition-number">01 / Field notes</p><h2 id="first-edition-title">{t.empty}</h2><p>{lang === 'cs' ? 'Začneme místy kolem Prahy a tím, jak je najít na mapě.' : 'We’re starting with places near Prague and how to find them on the map.'}</p><EmailRequest lang={lang}/></div></section>}
  </main><Footer lang={lang}/></div>;
}
function Block({ block, index }) {
  if (block.type === 'heading') return <h2 id={`section-${index}`}>{block.text}</h2>;
  if (block.type === 'paragraph') return <p>{block.text}</p>;
  if (block.type === 'list') return <ul>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  if (block.type === 'quote') return <blockquote><p>{block.text}</p>{block.attribution && <cite>{block.attribution}</cite>}</blockquote>;
  if (block.type === 'image') return <figure><img src={block.src} srcSet={block.srcSet || undefined} sizes={block.sizes || undefined} alt={block.alt} width={block.width} height={block.height} loading="lazy"/><figcaption>{block.caption} {block.credit && <PhotoCredit cover={block}/>}</figcaption></figure>;
  return null;
}
function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 100); };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  return <div className="journal-progress" aria-hidden="true" style={{ width: `${progress}%` }}/>;
}
function SpotBlock({ spot, lang }) {
  const lat = Number(spot.lat); const lon = Number(spot.lon);
  const hasCoordinates = spot.lat != null && spot.lon != null && Number.isFinite(lat) && Number.isFinite(lon);
  const bbox = hasCoordinates ? [lon - .006, lat - .004, lon + .006, lat + .004].join(',') : null;
  const mapUrl = hasCoordinates ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}` : null;
  return <aside className="journal-on-map"><div><span className="journal-category">{copy[lang].place}</span><h2>{spot.name}</h2><a href={`/spot/${encodeURIComponent(spot.id)}`}>{copy[lang].viewPlace}</a></div>{mapUrl && <iframe title={`Map of ${spot.name}`} src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>}</aside>;
}
function Article({ article }) {
  const t = copy[article.language];
  const related = publishedArticles.filter(item => item.language === article.language && item.slug !== article.slug && (article.relatedSlugs || []).includes(item.slug));
  return <div className="journal-app"><ReadingProgress/><BrandHeader lang={article.language}/><main id="main-content" className="journal-wrap"><nav className="journal-breadcrumb" aria-label="Breadcrumb"><a href={landingPath(article.language)}>{t.journal}</a><span aria-hidden="true">/</span><span aria-current="page">{article.title}</span></nav>
    <article className="journal-article"><header className="journal-article-heading"><div className="journal-article-meta"><span className="journal-category">{categoryLabel(article.category, article.language)}</span>{article.publishedAt && <time dateTime={article.publishedAt}>{dateLabel(article.publishedAt, article.language)}</time>}<span>{readTime(article)} {t.minutes}</span></div><h1>{article.title}</h1><p className="journal-deck">{article.summary}</p>{article.author?.name && <div className="journal-author">By {article.author.name}{article.updatedAt && <span> · {t.updated} <time dateTime={article.updatedAt}>{dateLabel(article.updatedAt, article.language)}</time></span>}</div>}</header>
      {article.cover && <figure className="journal-hero"><Photo article={article} eager/><figcaption><span>{article.cover.caption}</span><PhotoCredit cover={article.cover} lang={article.language}/></figcaption></figure>}
      <div className="journal-body">{article.body.map((block, index) => <Block key={index} block={block} index={index}/>)}</div>
      {article.spotIds?.map(spot => <SpotBlock key={spot.id} spot={spot} lang={article.language}/>)}
    </article>
    {related.length > 0 && <section className="journal-archive" aria-labelledby="related-title"><div className="journal-archive-heading"><h2 id="related-title">{t.related}</h2></div><div className="journal-archive-grid">{related.map(item => <StoryCard key={item.slug} article={item} variant="horizontal"/>)}</div></section>}
    <a className="journal-back" href={landingPath(article.language)}>{t.back}</a>
  </main><Footer lang={article.language}/></div>;
}
function Footer({ lang }) { return <footer className="journal-footer"><div className="journal-wrap"><span>© SpotFinder</span><nav aria-label="Footer"><a href={landingPath(lang)}>{copy[lang].journal}</a><a href="/FAQ">Help</a><a href="mailto:spotfinder@icloud.com">Contact</a></nav></div></footer>; }
export default function Journal({ path = '/news' }) {
  const clean = path.replace(/\/$/, '') || '/news';
  const match = /^\/news\/(?:cs\/)?([a-z0-9-]+)$/.exec(clean);
  const article = match && publishedArticles.find(item => item.slug === match[1] && articlePath(item) === clean);
  if (article) return <Article article={article}/>;
  if (clean === '/news') return <Landing lang="en"/>;
  if (clean === '/news/cs' && publishedArticles.some(item => item.language === 'cs')) return <Landing lang="cs"/>;
  const lang = languageFor(clean);
  return <div className="journal-app"><BrandHeader lang={lang}/><main id="main-content" className="journal-wrap journal-not-found"><span>404 / Journal</span><h1>{copy[lang].missing}</h1><p>{copy[lang].missingDetail}</p><a href="/news">{copy[lang].back}</a></main><Footer lang={lang}/></div>;
}
export { publishedArticles };
