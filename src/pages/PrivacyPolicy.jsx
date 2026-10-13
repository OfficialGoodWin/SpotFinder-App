import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="13 October 2026">
      <LegalNote><LegalStrong>Review status:</LegalStrong> This engineering draft is pending qualified legal and operator review. It is not legal advice or a claim of compliance.</LegalNote>

      <LegalH2>1. Controller and contact</LegalH2>
      <LegalP>Michael Neděle is currently identified as the individual operating SpotFinder. Contact: spotfinder@icloud.com. The operator's legal status, service address, and required registration disclosures remain to be confirmed before publication.</LegalP>

      <LegalH2>2. Data collected and used</LegalH2>
      <LegalUl>
        <li><LegalStrong>Authentication and profile:</LegalStrong> Firebase Authentication handles the email/password credential or Google identity data (name, email, profile photo). SpotFinder does not receive a plaintext password. An optional display name is stored with Firebase Auth.</li>
        <li><LegalStrong>Date of birth:</LegalStrong> the full date is stored in a private Firestore user document to enforce the current minimum age of 16. It is not displayed publicly. Whether a less intrusive age-proof should replace full-date storage remains under review.</li>
        <li><LegalStrong>SMS two-factor authentication:</LegalStrong> only after completed enrollment, Firebase Authentication stores the enrolled phone number and uses it to deliver sign-in codes.</li>
        <li><LegalStrong>Location:</LegalStrong> with device permission, precise GPS is used for map centering, nearby results, and routes. Searches, reverse-geocoding requests, and route start/destination coordinates are transmitted to the selected external provider. SpotFinder does not intentionally write live GPS history to a user profile.</li>
        <li><LegalStrong>Public contributions:</LegalStrong> spots, coordinates, descriptions, ratings/reviews, social links, and uploaded photos. These are public by design. New photos are re-encoded as JPEG, which removes ordinary embedded metadata, before Firebase Storage upload.</li>
        <li><LegalStrong>Private activity:</LegalStrong> drafts and draft photos, saved/liked spots, and per-account rating records.</li>
        <li><LegalStrong>Feedback, reports, and abuse prevention:</LegalStrong> submitted text, optional contact email, reCAPTCHA result, account/session identifiers, and a salted hash derived from the request IP. Infrastructure and external providers also receive ordinary network data such as an IP address.</li>
        <li><LegalStrong>Payments:</LegalStrong> only if checkout is enabled, Stripe processes card and billing details. SpotFinder stores plan/status, Stripe customer and subscription identifiers, and current-period end; it does not receive the full card number.</li>
        <li><LegalStrong>Optional analytics and advertising:</LegalStrong> Google Analytics and Google AdSense load only for the independently selected consent category. Choices are stored in local storage under <code>spotfinder_cookie_consent_v1</code>.</li>
      </LegalUl>

      <LegalH2>3. Purposes and proposed legal bases</LegalH2>
      <LegalUl>
        <li>Provide and secure accounts and core app features: contract performance.</li>
        <li>Moderation, fraud, rate limiting, and service security: proposed legitimate interests, subject to review and balancing.</li>
        <li>Payments and required accounting: contract performance and applicable legal obligations.</li>
        <li>Analytics and advertising storage/access: consent, withdrawable in Settings.</li>
      </LegalUl>

      <LegalH2>4. Providers and disclosures</LegalH2>
      <LegalP>Implemented integrations include Google Firebase (Auth, Firestore, Storage, Functions), Google sign-in/reCAPTCHA/Analytics/AdSense, Vercel, Stripe, Mapy/Seznam, OpenStreetMap-based services, OpenFreeMap/Protomaps, OpenRouteService, OSRM, Geoapify, Wikimedia Commons, Instagram, and TikTok. A provider receives only the requests made to its feature, but social embeds can receive IP/browser data after the user chooses to load them. Provider roles, production data regions, contracts, and exact subprocessor lists still require verification.</LegalP>

      <LegalH2>5. International transfers</LegalH2>
      <LegalP>Some providers may process data outside the EU/EEA, including in the United States. The applicable transfer mechanisms and contractual safeguards have not yet been verified for publication.</LegalP>

      <LegalH2>6. Retention and account deletion</LegalH2>
      <LegalP>No legacy-account DOB completion migration or automatic 30-day DOB-deadline deletion is currently active. New email/password registrations must provide a valid date of birth. A Settings deletion request requires recent reauthentication. An active or unresolved subscription must be cancelled through support before deletion so billing is not orphaned. The backend removes the Firebase Auth account, private profile/DOB, private drafts and draft images, saves, likes, and individual spot ratings. It removes direct contributor fields or applies a former-contributor label to retained public spots, reviews, photos, social references, and moderation records. Public geographic contributions and public uploaded photos are retained to preserve map integrity unless removed separately. Public Firebase Storage URLs can retain a pseudonymous UID in their object path until a reviewed storage migration is completed.</LegalP>
      <LegalP>Payment providers may retain legally required records. Fixed periods for feedback, deletion-operation records, hashed anti-abuse signals, moderation data, provider/server logs, and payment records are not yet approved. Those periods and an operational purge schedule require human/legal approval.</LegalP>

      <LegalH2>7. Rights and deletion recovery</LegalH2>
      <LegalP>Depending on applicable law, you may have rights to access, correct, erase, restrict, object, receive portable data, withdraw consent, and complain to a supervisory authority. Request deletion in Settings after reauthentication or contact spotfinder@icloud.com. If cleanup fails, Settings reports the failure and the Auth account remains available for a safe retry; contact support if retries fail.</LegalP>

      <LegalH2>8. Public content and legacy records</LegalH2>
      <LegalP>Do not include personal information in public contributions unless you intend it to be public. New spot submissions do not copy the account email into the public contributor field. Legacy records may still contain email-derived ownership values and require a controlled, non-destructive migration; this draft does not claim that migration has occurred.</LegalP>

      <LegalH2>9. Children</LegalH2>
      <LegalP>SpotFinder currently requires account holders to be at least 16. This threshold, the need to store full date of birth, and jurisdiction-specific parental-consent handling require legal approval. Contact spotfinder@icloud.com if you believe an under-age person supplied data.</LegalP>

      <LegalH2>10. Security</LegalH2>
      <LegalP>Implemented controls include provider transport encryption, Firebase access rules, server-side authorization and recent-auth checks, input/upload limits, rate limits, and admin audit records. These measures reduce risk but do not guarantee security; deployed configuration still requires verification.</LegalP>

      <LegalH2>11. Changes and contact</LegalH2>
      <LegalP>Material changes should be highlighted in the app. Questions or data requests: spotfinder@icloud.com.</LegalP>
    </LegalPageLayout>
  );
}
