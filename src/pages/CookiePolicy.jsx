import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';
import { reopenCookieSettings } from '@/components/CookieConsentBanner';

export default function CookiePolicy() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="[DATE — fill in before publishing]">
      <LegalNote>
        <LegalStrong>Before publishing:</LegalStrong> confirm this list matches what's actually
        deployed (add/remove rows if you change providers), and fill in the contact details below.
      </LegalNote>

      <LegalP>
        This Cookie Policy explains what cookies and similar technologies (like browser local storage)
        SpotFinder uses, and how you can control them.
      </LegalP>

      <button
        onClick={reopenCookieSettings}
        className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
      >
        Manage cookie preferences
      </button>

      <LegalH2>1. Strictly necessary (always on — no consent required)</LegalH2>
      <LegalP>These are required for the Service to function and can't be switched off:</LegalP>
      <LegalUl>
        <li><LegalStrong>Firebase Authentication session</LegalStrong> — keeps you signed in.</li>
        <li><LegalStrong>Language preference cookie</LegalStrong> (<code>spotfinder_language</code>) — remembers your chosen app language.</li>
        <li><LegalStrong>Your cookie consent choice</LegalStrong> (<code>spotfinder_cookie_consent_v1</code>, stored in your browser's local storage) — remembers whether you accepted analytics/ads cookies, so we don't ask every visit.</li>
        <li><LegalStrong>reCAPTCHA</LegalStrong> — used only on public forms (e.g. guest feedback) to block spam/bots.</li>
        <li><LegalStrong>Stripe checkout cookies</LegalStrong> — set only if you go through the subscription checkout flow, needed for secure payment processing and fraud prevention.</li>
      </LegalUl>

      <LegalH2>2. Analytics cookies (only with your consent)</LegalH2>
      <LegalUl>
        <li><LegalStrong>Google Analytics</LegalStrong> — helps us understand how the app is used (pages visited, general device/location info, session duration) so we can improve it. Loaded only after you accept analytics cookies in the banner or Settings.</li>
      </LegalUl>

      <LegalH2>3. Advertising cookies (only with your consent)</LegalH2>
      <LegalUl>
        <li><LegalStrong>Google AdSense</LegalStrong> — used to show ads on the free tier and, if you don't opt out of personalization, to make those ads more relevant. Loaded only after you accept advertising cookies. You can also manage ad personalization directly at{' '}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">
            adssettings.google.com
          </a>.
        </li>
      </LegalUl>

      <LegalH2>4. Third-party map/routing requests</LegalH2>
      <LegalP>
        When you search for places, view the map, or get directions, your request is sent to our
        map/routing providers (Mapy.cz, OpenStreetMap-based tile servers, OpenRouteService, OSRM,
        Geoapify) so they can return results. These aren't cookies, but they do involve sending data
        (like your search query or route coordinates) to those providers — see our{' '}
        <a href="/PrivacyPolicy" className="underline text-blue-600 dark:text-blue-400">Privacy Policy</a> for details.
        This happens regardless of your cookie choice, because it's needed for the core map feature to work.
      </LegalP>

      <LegalH2>5. Changing your choice</LegalH2>
      <LegalP>
        You can change your cookie preferences at any time using the "Manage cookie preferences"
        button above, or from the Cookie settings option in the app's Settings menu. On mobile app
        builds (Capacitor/Android), the same in-app banner applies since it's the same underlying
        web app.
      </LegalP>

      <LegalH2>6. Contact</LegalH2>
      <LegalP>Questions about our use of cookies? Email [CONTACT EMAIL].</LegalP>
    </LegalPageLayout>
  );
}
