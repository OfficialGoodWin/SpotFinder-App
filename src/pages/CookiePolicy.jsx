import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { reopenCookieSettings } from '@/components/CookieConsentBanner';

export default function CookiePolicy() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="13 October 2026">
      <LegalNote><LegalStrong>Review status:</LegalStrong> This privacy hotfix draft is pending legal review and an owner-run production browser/tag inventory after deployment. Provider behavior can change independently of SpotFinder.</LegalNote>
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
      <LegalP>Google Analytics, Firebase Analytics, and Google Tag Manager are not initialized or loaded by the current SpotFinder build. Analytics cannot be enabled through cookie settings while this temporary suspension is active.</LegalP>

      <LegalH2>3. Optional advertising</LegalH2>
      <LegalP>Google AdSense is not loaded by the current SpotFinder build. The app does not create AdSense slots, reserve advertising space, or offer an advertising-consent control while this temporary suspension is active.</LegalP>

      <LegalH2>4. Maps, routing, search, and social embeds</LegalH2>
      <LegalP>Core map/search/routing requests can transmit IP address, search text, map context, and route coordinates regardless of optional analytics/advertising choices. Instagram/TikTok iframes are not created until the user explicitly chooses to load an individual post. These network requests are described in the Privacy Policy and need their own legal assessment.</LegalP>

      <LegalH2>5. Changing or withdrawing consent</LegalH2>
      <LegalP>Use the button above or Settings to review the current necessary-only state. Previously saved choices remain in the existing <code>spotfinder_cookie_consent_v1</code> record for migration history but have no effect; selecting “Keep optional services off” replaces them with an explicit rejection. The app removes legacy tag elements and expires known first-party <code>_ga*</code>, <code>__gads</code>, <code>__gpi</code>, and <code>__eoi</code> cookies without clearing Firebase authentication state. Browser or provider storage and data collected before this hotfix may remain.</LegalP>
      <LegalP>If optional integrations return, they must use a new, explicit opt-in. A historical acceptance will not be treated as consent for a restored service.</LegalP>

      <LegalH2>6. Verification and contact</LegalH2>
      <LegalP>Google network requests can still occur for essential Firebase authentication, Google sign-in, and reCAPTCHA, and for a user-selected Google-backed feature. Those requests are not evidence that Google Analytics or AdSense is active. A production network and storage scan is still required before publication. Questions: spotfinder@icloud.com.</LegalP>
    </LegalPageLayout>
  );
}
