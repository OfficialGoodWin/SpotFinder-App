import React from 'react';
import { Cookie } from 'lucide-react';
import { NewLegalLink } from './legalRoutes';

export default function NewConsent({ onNecessary }) {
  return <div className="sf-new-consent-backdrop">
    <section className="sf-new-consent" role="dialog" aria-modal="true" aria-labelledby="sf-new-consent-title">
      <h2 id="sf-new-consent-title"><span><Cookie size={25} /></span> Cookies a podmínky</h2>
      <p>Nezbytné cookies potřebujeme, aby aplikace fungovala. Analytické a reklamní cookies jsou nyní vypnuté.</p>
      <p className="sf-new-consent-legal">Přečti si <NewLegalLink document="/TermsAndConditions">Podmínky použití</NewLegalLink> a <NewLegalLink document="/PrivacyPolicy">Zásady ochrany soukromí</NewLegalLink>.</p>
      <button type="button" onClick={onNecessary}>Pouze nezbytné</button>
      <NewLegalLink className="sf-new-consent-details" document="/CookiePolicy">Informace o cookies</NewLegalLink>
    </section>
  </div>;
}
