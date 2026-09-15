import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="[DATE — fill in before publishing]">
      <LegalNote>
        <LegalStrong>Before publishing:</LegalStrong> replace the bracketed placeholders below (business
        name, address, registration number, contact email) with your real details, and have this
        page reviewed by a qualified lawyer for your jurisdiction. This draft was prepared from an
        automated review of the app's code and is not legal advice.
      </LegalNote>

      <LegalP>
        This Privacy Policy explains what personal data SpotFinder ("<LegalStrong>we</LegalStrong>",
        "<LegalStrong>us</LegalStrong>") collects when you use the SpotFinder app or website
        (the "<LegalStrong>Service</LegalStrong>"), why we collect it, and what rights you have over it.
      </LegalP>

      <LegalH2>1. Who we are (data controller)</LegalH2>
      <LegalP>
        [YOUR LEGAL ENTITY OR SOLE-TRADER NAME], registered at [REGISTERED ADDRESS], [ICO/company
        registration number if applicable], is the data controller responsible for your personal
        data. Contact: [CONTACT EMAIL]. If you are in the EU/EEA and have concerns we haven't
        resolved, you may lodge a complaint with your local data protection authority (in Czechia:
        the Office for Personal Data Protection, uoou.gov.cz).
      </LegalP>

      <LegalH2>2. Data we collect</LegalH2>
      <LegalUl>
        <li><LegalStrong>Account data:</LegalStrong> email address and password (stored securely by Firebase Authentication — we never see your plaintext password), or your Google account's name/email/profile photo if you sign in with Google. An optional display name you provide.</li>
        <li><LegalStrong>Two-factor authentication:</LegalStrong> if you enable it, your phone number, used only to send a verification code.</li>
        <li><LegalStrong>Location data:</LegalStrong> with your device's permission, your precise GPS location, used to center the map, show nearby spots, and provide turn-by-turn navigation. This is processed on your device and is not permanently stored on our servers tied to your identity beyond what's needed to show your position on the map in real time.</li>
        <li><LegalStrong>User-generated content:</LegalStrong> spots, ratings, descriptions, photos, and point-of-interest reviews you submit. These are public by design — anyone using the app can see them.</li>
        <li><LegalStrong>Payment data:</LegalStrong> if you subscribe to SpotFinder Elite/Ultra, payment is processed entirely by Stripe. We never receive or store your card number — only your subscription plan and status.</li>
        <li><LegalStrong>Feedback:</LegalStrong> anything you submit through the feedback form, plus anti-spam signals (a reCAPTCHA score and your IP address, used only to prevent abuse).</li>
        <li><LegalStrong>Usage/analytics data:</LegalStrong> if you consent to analytics cookies, Google Analytics collects device type, approximate location (from IP), pages viewed, and general usage patterns. See our <a href="/CookiePolicy" className="underline text-blue-600 dark:text-blue-400">Cookie Policy</a>.</li>
        <li><LegalStrong>Advertising data:</LegalStrong> if you consent to advertising cookies, Google AdSense may use cookies/identifiers to show ads. See our Cookie Policy.</li>
      </LegalUl>

      <LegalH2>3. Why we process your data (legal basis)</LegalH2>
      <LegalUl>
        <li>To create and secure your account, and provide the core map/spot-finding features — <LegalStrong>performance of a contract</LegalStrong> with you.</li>
        <li>To keep the Service secure and prevent spam/abuse — <LegalStrong>legitimate interest</LegalStrong>.</li>
        <li>To process subscription payments — <LegalStrong>performance of a contract</LegalStrong> and legal obligations (invoicing, tax).</li>
        <li>Analytics and advertising cookies — <LegalStrong>your consent</LegalStrong>, which you give or refuse via the cookie banner and can withdraw at any time in Settings.</li>
      </LegalUl>

      <LegalH2>4. Who we share data with</LegalH2>
      <LegalP>We use the following processors/third parties, each bound by their own privacy terms:</LegalP>
      <LegalUl>
        <li><LegalStrong>Google Firebase</LegalStrong> (Authentication, Firestore database, Cloud Storage, Cloud Functions) — hosts your account and app data.</li>
        <li><LegalStrong>Stripe</LegalStrong> — processes subscription payments.</li>
        <li><LegalStrong>Google Analytics</LegalStrong> — usage analytics (only with consent).</li>
        <li><LegalStrong>Google AdSense</LegalStrong> — advertising (only with consent).</li>
        <li><LegalStrong>Google reCAPTCHA</LegalStrong> — distinguishes humans from bots on public forms.</li>
        <li><LegalStrong>Mapy.cz / Seznam.cz, OpenStreetMap contributors, OpenFreeMap/Protomaps, OpenRouteService, OSRM, Geoapify</LegalStrong> — map tiles, place search, and route calculation. Your search queries and route requests may be sent to these providers.</li>
        <li><LegalStrong>Wikimedia Commons</LegalStrong> — some point-of-interest photos are pulled from Wikimedia Commons' public API.</li>
        <li><LegalStrong>Vercel</LegalStrong> — hosts our website and backend functions.</li>
      </LegalUl>
      <LegalP>
        We do not sell your personal data. We only share what's necessary for the above services to work,
        or where required by law.
      </LegalP>

      <LegalH2>5. International transfers</LegalH2>
      <LegalP>
        Several of the providers above (Google, Stripe) may process data outside the EU/EEA, including in
        the United States. Where this happens, they do so under recognized safeguards such as the
        EU-U.S. Data Privacy Framework or Standard Contractual Clauses.
      </LegalP>

      <LegalH2>6. How long we keep your data</LegalH2>
      <LegalP>
        Account and content data is kept for as long as your account is active. If you delete your
        account, we delete your personal account data within a reasonable period, except where we
        must keep records for legal/tax reasons (e.g. payment records) or where content you posted
        has already been publicly shared and separated from your identity (see Section 8).
      </LegalP>

      <LegalH2>7. Your rights</LegalH2>
      <LegalP>If you're in the EU/EEA/UK (GDPR) or another jurisdiction with similar protections, you have the right to:</LegalP>
      <LegalUl>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your data ("right to be forgotten")</li>
        <li>Object to or restrict certain processing</li>
        <li>Data portability</li>
        <li>Withdraw consent at any time (this won't affect processing done before withdrawal)</li>
      </LegalUl>
      <LegalP>To exercise any of these rights, contact us at [CONTACT EMAIL]. You can also delete your account and most associated data directly from Settings.</LegalP>

      <LegalH2>8. Public content and spot locations</LegalH2>
      <LegalP>
        Spots, ratings, photos, and reviews you submit are shown publicly to other users of the app.
        Please don't include personal information about yourself or others in this content unless you
        intend it to be public. We store a reference to the account that created each spot for
        moderation purposes, but do not display your email address publicly.
      </LegalP>

      <LegalH2>9. Children</LegalH2>
      <LegalP>
        SpotFinder is not directed at children under 16, and we do not knowingly collect personal data
        from them. If you believe a child has provided us with personal data, contact us at [CONTACT EMAIL]
        and we will delete it.
      </LegalP>

      <LegalH2>10. Security</LegalH2>
      <LegalP>
        We use industry-standard measures (encryption in transit, access-controlled databases, audited
        admin actions) to protect your data. No system is 100% secure, and we can't guarantee absolute
        security.
      </LegalP>

      <LegalH2>11. Changes to this policy</LegalH2>
      <LegalP>
        We may update this policy from time to time. Material changes will be highlighted in the app.
        The "Last updated" date at the top of this page reflects the latest revision.
      </LegalP>

      <LegalH2>12. Contact</LegalH2>
      <LegalP>Questions about this policy or your data? Email [CONTACT EMAIL].</LegalP>
    </LegalPageLayout>
  );
}
