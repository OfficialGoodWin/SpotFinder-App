export const origin = 'https://www.spotfinder.live';
export const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const pathFor = article => `/news/${article.language === 'cs' ? 'cs/' : ''}${article.slug}`;
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const imageFor = article => article?.cover ? origin + article.cover.src : origin + '/og-image.png';

export function headFor(article, articles = [], landingLanguage = 'en') {
  const landing = !article;
  const title = landing ? (landingLanguage === 'cs' ? 'Žurnál | SpotFinder' : 'Journal | SpotFinder') : `${article.title} | SpotFinder Journal`;
  const description = landing ? (landingLanguage === 'cs' ? 'Tipy na výlety, praktičtí průvodci a ověřené novinky ze SpotFinderu.' : 'Destination ideas, practical guides and verified updates from the SpotFinder community map.') : article.summary;
  const canonical = landing ? origin + (landingLanguage === 'cs' ? '/news/cs' : '/news') : article.canonicalUrl;
  const image = imageFor(article);
  const preload = article?.cover?.src || '/news-images/prague-street.webp';
  const variants = article ? articles.filter(item => item.slug === article.slug) : [];
  const alternates = article ? (variants.length > 1 ? variants.map(item => `<link rel="alternate" hreflang="${item.language}" href="${escape(origin + pathFor(item))}" />`).join('') : '') : (articles.some(item => item.language === 'cs') ? `<link rel="alternate" hreflang="en" href="${origin}/news" /><link rel="alternate" hreflang="cs" href="${origin}/news/cs" />` : '');
  const structured = article ? {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: article.title, description: article.summary, inLanguage: article.language,
    mainEntityOfPage: article.canonicalUrl, image: { '@type': 'ImageObject', url: image, width: article.cover.width, height: article.cover.height },
    datePublished: article.publishedAt, dateModified: article.updatedAt || article.publishedAt,
    author: { '@type': article.author.type, name: article.author.name },
    publisher: { '@type': 'Organization', name: 'SpotFinder', url: origin },
    articleSection: article.category,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SpotFinder', item: origin + '/' },
      { '@type': 'ListItem', position: 2, name: article.language === 'cs' ? 'Žurnál' : 'Journal', item: origin + (article.language === 'cs' ? '/news/cs' : '/news') },
      { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
    ] },
  } : { '@context': 'https://schema.org', '@type': 'CollectionPage', name: landingLanguage === 'cs' ? 'SpotFinder Žurnál' : 'SpotFinder Journal', inLanguage: landingLanguage, url: canonical, description };
  return `<title>${escape(title)}</title><meta name="description" content="${escape(description)}" /><meta name="robots" content="index,follow" /><link rel="canonical" href="${escape(canonical)}" /><link rel="preload" as="image" href="${escape(preload)}" fetchpriority="high" />${alternates}<meta property="og:type" content="${landing ? 'website' : 'article'}" /><meta property="og:title" content="${escape(title)}" /><meta property="og:description" content="${escape(description)}" /><meta property="og:url" content="${escape(canonical)}" /><meta property="og:image" content="${escape(image)}" />${article?.cover ? `<meta property="og:image:width" content="${article.cover.width}" /><meta property="og:image:height" content="${article.cover.height}" /><meta property="article:published_time" content="${article.publishedAt}" /><meta property="article:modified_time" content="${article.updatedAt || article.publishedAt}" />` : ''}<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escape(title)}" /><meta name="twitter:description" content="${escape(description)}" /><meta name="twitter:image" content="${escape(image)}" /><script type="application/ld+json">${json(structured)}</script>`;
}
