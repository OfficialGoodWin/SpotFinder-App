import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { reopenCookieSettings } from '@/components/CookieConsentBanner';

export default function CookiePolicy() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="13 October 2026">
      <LegalNote><LegalStrong>Review status:</LegalStrong> This draft is pending legal review and a production browser/tag inventory. Provider behavior can change independently of SpotFinder.</LegalNote>
      <LegalP>This policy covers cookies and similar browser storage. It does not claim that a consent banner alone establishes compliance.</LegalP>
      <button onClick={reopenCookieSettings} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Manage cookie preferences</button>

      <LegalH2>1. Core storage and services</LegalH2>
      <LegalUl>
        <li><LegalStrong>Firebase Authentication</LegalStrong> maintains the signed-in session.</li>
        <li><LegalStrong>Local preferences</LegalStrong> store language, interface preferences, guest drafts, and the consent record <code>spotfinder_cookie_consent_v1</code>.</li>
        <li><LegalStrong>reCAPTCHA</LegalStrong> is requested for protected submission flows and can process network/device signals. It is a security service, but its exact legal classification and disclosures still require review.</li>
        <li><LegalStrong>Stripe</LegalStrong> may set checkout security/fraud-prevention storage only if the user enters an enabled checkout. Checkout is disabled by default.</li>
      </LegalUl>

      <LegalH2>2. Optional analytics</LegalH2>
      <LegalP>Google Analytics is not injected until analytics consent is granted. It can process page/device data and approximate location inferred from IP. Analytics consent is independent of advertising consent.</LegalP>

      <LegalH2>3. Optional advertising</LegalH2>
      <LegalP>Google AdSense is not injected and ad slots do not request ads until advertising consent is granted. Advertising consent is independent of analytics consent.</LegalP>

      <LegalH2>4. Maps, routing, search, and social embeds</LegalH2>
      <LegalP>Core map/search/routing requests can transmit IP address, search text, map context, and route coordinates regardless of optional analytics/advertising choices. Instagram/TikTok iframes are not created until the user explicitly chooses to load an individual post. These network requests are described in the Privacy Policy and need their own legal assessment.</LegalP>

      <LegalH2>5. Changing or withdrawing consent</LegalH2>
      <LegalP>Use the button above or Settings at any time. Saved choices are shown without being overwritten. Revocation sends denied Google consent, stops future app-initiated optional loading, removes the injected loader/ad content, and expires known first-party Google cookies. A browser or provider may retain third-party storage or data collected before withdrawal; clearing site/browser data may also be necessary.</LegalP>

      <LegalH2>6. Verification and contact</LegalH2>
      <LegalP>A production network and storage scan is still required before publication. Questions: spotfinder@icloud.com.</LegalP>
    </LegalPageLayout>
  );
}
