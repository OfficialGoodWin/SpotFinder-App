import React, { Suspense, lazy, useState } from 'react';
import { Cookie, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getConsent, rejectNonEssential, acknowledgeCurrentPrivacyNotice } from '@/lib/consent';
import { APP_VERSION } from '@/config/appVersion';
import './new-settings-info.css';

const FAQ = lazy(() => import('@/pages/FAQ'));
const Terms = lazy(() => import('@/pages/TermsAndConditions'));
const Privacy = lazy(() => import('@/pages/PrivacyPolicy'));
const Cookies = lazy(() => import('@/pages/CookiePolicy'));
const Refunds = lazy(() => import('@/pages/RefundPolicy'));
const Updates = lazy(() => import('@/pages/Updates'));

const POLICY_PATHS = {
  '/TermsAndConditions': '/new/settings/legal/terms',
  '/PrivacyPolicy': '/new/settings/legal/privacy',
  '/CookiePolicy': '/new/settings/legal/cookies',
  '/RefundPolicy': '/new/settings/legal/refunds',
  '/updates': '/new/settings/about/updates',
};

function CookiePreferences() {
  const navigate = useNavigate();
  const [choice, setChoice] = useState(getConsent);
  const save = action => setChoice(action());
  return <div className="sf-new-info-preferences">
    <div className="sf-new-info-status"><span><Cookie size={21} /></span><div><strong>Nezbytné úložiště</strong><small>Aktivní pro přihlášení, nastavení a rozpracovaná místa.</small></div></div>
    <div className="sf-new-info-status"><span><ShieldCheck size={21} /></span><div><strong>Analytika a reklama</strong><small>Nedostupné v této verzi. Dřívější volby je nemohou zapnout.</small></div></div>
    <p role="status">{choice.decided ? 'Volba soukromí je zaznamenaná.' : 'Volba soukromí zatím není zaznamenaná.'}</p>
    <button type="button" className="sf-new-info-primary" onClick={() => save(acknowledgeCurrentPrivacyNotice)}>Pokračovat s nezbytnými službami</button>
    <button type="button" className="sf-new-info-secondary" onClick={() => save(rejectNonEssential)}>Ponechat volitelné služby vypnuté</button>
    <button type="button" className="sf-new-info-policy-link" onClick={() => navigate('/new/settings/legal/cookies')}>Přečíst zásady cookies</button>
  </div>;
}

export default function NewSettingsInfo({ area, page }) {
  const navigate = useNavigate();
  const support = area === 'support';
  const source = area === 'legal' ? ({ terms: <Terms />, privacy: <Privacy />, cookies: <Cookies />, refunds: <Refunds /> })[page]
    : support || area === 'about' && page === 'app' ? <FAQ />
      : area === 'about' && page === 'updates' ? <Updates /> : null;
  const mode = support ? page === 'faq' ? 'faq' : 'support' : area === 'about' && page === 'app' ? 'app' : area === 'about' ? 'updates' : 'legal';
  const onClickCapture = event => {
    const button = event.target.closest('button');
    if (area === 'legal' && page === 'cookies' && button?.textContent?.trim() && button.closest('.sf-surface')) {
      event.preventDefault(); event.stopPropagation(); navigate('/new/settings/legal/preferences'); return;
    }
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    const destination = POLICY_PATHS[new URL(anchor.href).pathname];
    if (destination) { event.preventDefault(); event.stopPropagation(); navigate(destination); }
  };

  if (area === 'legal' && page === 'preferences') return <CookiePreferences />;
  if (!source) return <p className="sf-new-info-unavailable">Tato stránka není dostupná.</p>;
  return <div className={`sf-new-info sf-new-info--${mode}`} onClickCapture={onClickCapture}>
    {support && page !== 'faq' && <p className="sf-new-info-intro">{page === 'report' ? 'Popiš problém, který se ti v aplikaci stal. Zpráva se odešle přes stávající formulář zpětné vazby.' : page === 'contact' ? 'Napiš týmu SpotFinder. Zpráva se odešle přes stávající formulář zpětné vazby.' : 'Poděl se o svůj názor na SpotFinder.'}</p>}
    {area === 'about' && page === 'app' && <p className="sf-new-info-version">SpotFinder · verze {APP_VERSION}</p>}
    <Suspense fallback={<p className="sf-new-info-unavailable" role="status">Načítám obsah…</p>}>{source}</Suspense>
  </div>;
}
