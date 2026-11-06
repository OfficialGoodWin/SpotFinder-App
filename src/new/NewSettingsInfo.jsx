import React, { Suspense, lazy, useState } from 'react';
import { Cookie, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getConsent, rejectNonEssential, acknowledgeCurrentPrivacyNotice } from '@/lib/consent';
import NewSupport from './NewSupport';
import NewAbout from './NewAbout';
import NewSkeleton from './NewSkeleton';
import { useLanguage } from '@/lib/LanguageContext';
import { newLegalRoute } from './legalRoutes';
import './new-settings-info.css';

const FAQ = lazy(() => import('@/pages/FAQ'));
const Terms = lazy(() => import('@/pages/TermsAndConditions'));
const Privacy = lazy(() => import('@/pages/PrivacyPolicy'));
const Cookies = lazy(() => import('@/pages/CookiePolicy'));
const Refunds = lazy(() => import('@/pages/RefundPolicy'));
const Updates = lazy(() => import('@/pages/Updates'));

function CookiePreferences() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [choice, setChoice] = useState(getConsent);
  const save = action => setChoice(action());
  return <div className="sf-new-info-preferences">
    <div className="sf-new-info-status"><span><Cookie size={21} /></span><div><strong>{t('newCookiePreferences.necessary')}</strong><small>{t('newCookiePreferences.necessaryDetail')}</small></div></div>
    <div className="sf-new-info-status"><span><ShieldCheck size={21} /></span><div><strong>{t('newCookiePreferences.optional')}</strong><small>{t('newCookiePreferences.optionalDetail')}</small></div></div>
    <p role="status">{t(choice.decided ? 'newCookiePreferences.decided' : 'newCookiePreferences.undecided')}</p>
    <button type="button" className="sf-new-info-primary" onClick={() => save(acknowledgeCurrentPrivacyNotice)}>{t('newCookiePreferences.continue')}</button>
    <button type="button" className="sf-new-info-secondary" onClick={() => save(rejectNonEssential)}>{t('newCookiePreferences.keepOff')}</button>
    <button type="button" className="sf-new-info-policy-link" onClick={() => navigate('/new/settings/legal/cookies', { state: { settingsParent: location.pathname } })}>{t('newCookiePreferences.readPolicy')}</button>
  </div>;
}

export default function NewSettingsInfo({ area, page }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const support = area === 'support';
  const source = area === 'legal' ? ({ terms: <Terms />, privacy: <Privacy />, cookies: <Cookies />, refunds: <Refunds /> })[page]
    : support && page === 'faq' ? <FAQ />
      : area === 'about' && page === 'app' ? <NewAbout />
      : area === 'about' && page === 'updates' ? <Updates /> : null;
  const mode = support ? 'faq' : area === 'about' && page === 'app' ? 'app' : area === 'about' ? 'updates' : 'legal';
  const onClickCapture = event => {
    const button = event.target.closest('button');
    if (area === 'legal' && page === 'cookies' && button?.textContent?.trim() && button.closest('.sf-surface')) {
      event.preventDefault(); event.stopPropagation(); navigate('/new/settings/legal/preferences', { state: { settingsParent: location.pathname } }); return;
    }
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;
    const path = url.pathname;
    const destination = newLegalRoute(path) || (path === '/updates' ? '/new/settings/about/updates' : null);
    if (destination) { event.preventDefault(); event.stopPropagation(); navigate(destination, { state: { settingsParent: location.pathname } }); }
  };

  if (area === 'legal' && page === 'preferences') return <CookiePreferences />;
  if (support && ['feedback', 'report', 'contact'].includes(page)) return <NewSupport key={page} page={page} />;
  if (!source) return <p className="sf-new-info-unavailable">{t('newCookiePreferences.unavailable')}</p>;
  return <div className={`sf-new-info sf-new-info--${mode}`} onClickCapture={onClickCapture}>
    <Suspense fallback={<NewSkeleton kind={mode === 'app' ? 'faq' : mode} />}>{source}</Suspense>
  </div>;
}
