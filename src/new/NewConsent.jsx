import React from 'react';
import { Cookie } from 'lucide-react';

export default function NewConsent({ onNecessary }) {
  return <div className="sf-new-consent-backdrop">
    <section className="sf-new-consent" role="dialog" aria-modal="true" aria-labelledby="sf-new-consent-title">
      <h2 id="sf-new-consent-title"><span><Cookie size={25} /></span> Cookies a podmínky</h2>
      <p>Nezbytné cookies potřebujeme, aby aplikace fungovala. Analytické a reklamní cookies jsou nyní vypnuté.</p>
      <p className="sf-new-consent-legal">Přečti si <a href="/TermsAndConditions">Podmínky použití</a> a <a href="/PrivacyPolicy">Zásady ochrany soukromí</a>.</p>
      <button type="button" onClick={onNecessary}>Pouze nezbytné</button>
      <a className="sf-new-consent-details" href="/CookiePolicy">Informace o cookies</a>
    </section>
  </div>;
}
