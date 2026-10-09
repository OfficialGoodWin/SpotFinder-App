// Navigation tracking placeholder — analytics can be wired here if needed
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_METADATA = {
  '/': ['SpotFinder | Discover community-rated outdoor spots', 'Discover, rate, save, and navigate to scenic outdoor spots shared by the SpotFinder community.'],
  '/faq': ['FAQ | SpotFinder', 'Answers to common questions about using SpotFinder.'],
  '/status': ['Service status | SpotFinder', 'Current availability and incident updates for SpotFinder services.'],
  '/privacypolicy': ['Privacy policy | SpotFinder', 'How SpotFinder collects, uses, and protects personal information.'],
  '/termsandconditions': ['Terms and conditions | SpotFinder', 'Terms governing use of the SpotFinder service.'],
  '/cookiepolicy': ['Cookie policy | SpotFinder', 'How SpotFinder uses cookies and manages consent.'],
  '/refundpolicy': ['Refund policy | SpotFinder', 'SpotFinder subscription cancellation and refund information.'],
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
  const { pathname } = useLocation();

  useEffect(() => {
    const key = pathname.toLowerCase().replace(/\/$/, '') || '/';
    const metadata = PAGE_METADATA[key];
    const [title, description] = metadata || ['Page not found | SpotFinder', 'The requested SpotFinder page could not be found.'];
    document.title = title;
    setMeta('description', description);
    setMeta('robots', metadata ? 'index,follow' : 'noindex,follow');

    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `https://spotfinder.cz${metadata ? pathname : '/'}`);
  }, [pathname]);

  return null;
}
