// Route metadata updater only. It does not record navigation or send page
// views; optional analytics is suspended.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalSpotUrl, spotIdFromLocation, validSpotId } from './spotLinks';
import { PUBLIC_ORIGIN } from './spotLinks';
import { publishedArticles } from '@/news/articles';

const PAGE_METADATA = {
  '/': ['SpotFinder | Discover community-rated outdoor spots', 'Discover, rate, save, and navigate to scenic outdoor spots shared by the SpotFinder community.'],
  '/faq': ['FAQ | SpotFinder', 'Answers to common questions about using SpotFinder.'],
  '/status': ['Service status | SpotFinder', 'Published availability history and incident updates for SpotFinder services.'],
  '/privacypolicy': ['Privacy policy | SpotFinder', 'How SpotFinder collects, uses, and protects personal information.'],
  '/termsandconditions': ['Terms and conditions | SpotFinder', 'Terms governing use of the SpotFinder service.'],
  '/cookiepolicy': ['Cookie policy | SpotFinder', 'How SpotFinder uses cookies and manages consent.'],
  '/refundpolicy': ['Refund policy | SpotFinder', 'SpotFinder subscription cancellation and refund information.'],
  '/updates': ["What's new | SpotFinder", 'Verified release notes and product updates for SpotFinder.'],
  '/news': ['Journal | SpotFinder', 'Destination ideas, practical guides and verified updates from the SpotFinder community map.'],
};

function setMeta(name, content) {
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function NavigationTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const key = pathname.toLowerCase().replace(/\/$/, '') || '/';
    const linkedSpot = spotIdFromLocation(pathname, search);
    const validLink = linkedSpot.isSpotLink && validSpotId(linkedSpot.id);
    const articleMatch = /^\/news\/(?:cs\/)?([a-z0-9-]+)$/.exec(key);
    const article = articleMatch && publishedArticles.find(item => item.slug === articleMatch[1] && `/news/${item.language === 'cs' ? 'cs/' : ''}${item.slug}` === key);
    const articlePath = article && `/news/${article.language === 'cs' ? 'cs/' : ''}${article.slug}`;
    const validArticle = articlePath === key;
    const czechLanding = key === '/news/cs' && publishedArticles.some(item => item.language === 'cs');
    const metadata = validArticle
      ? [`${article.title} | SpotFinder Journal`, article.summary]
      : czechLanding ? ['Žurnál | SpotFinder', 'Tipy na výlety, praktičtí průvodci a ověřené novinky ze SpotFinderu.']
      : validLink
      ? ['SpotFinder | Community place', 'Explore a real community place on the SpotFinder map.']
      : PAGE_METADATA[key];
    const [title, description] = metadata || ['Page not found | SpotFinder', 'The requested SpotFinder page could not be found.'];
    document.title = title;
    setMeta('description', description);
    setMeta('robots', metadata ? 'index,follow' : 'noindex,follow');

    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', validArticle ? article.canonicalUrl : validLink ? canonicalSpotUrl(linkedSpot.id) : `${PUBLIC_ORIGIN}${metadata ? pathname : '/'}`);
  }, [pathname, search]);

  return null;
}
