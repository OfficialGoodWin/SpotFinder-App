import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';

export default function TermsAndConditions() {
  return (
    <LegalPageLayout title="Terms & Conditions" lastUpdated="13 October 2026">
      <LegalNote><LegalStrong>Review status:</LegalStrong> This draft is pending qualified legal review, including operator identity, governing law, subscriptions, and consumer rights.</LegalNote>
      <LegalP>These terms govern SpotFinder, currently identified as operated by Michael Neděle. Contact: spotfinder@icloud.com. Required operator registration, address, and tax disclosures have not been confirmed.</LegalP>

      <LegalH2>1. Service</LegalH2>
      <LegalP>SpotFinder is a community map for outdoor places. Locations, conditions, access rights, and third-party map/routes may be inaccurate or outdated. Follow local law, verify access and safety, and do not rely on the Service as an emergency or safety system.</LegalP>

      <LegalH2>2. Accounts and age</LegalH2>
      <LegalUl>
        <li>Keep credentials secure and provide accurate information.</li>
        <li>The current minimum registration age is 16. New email/password registrations must provide a valid date of birth. No legacy-account DOB completion migration is currently active.</li>
        <li>You may request deletion in Settings after recent reauthentication. An active or unresolved subscription must first be cancelled through support so billing is not orphaned. Private data is removed while public geographic contributions may be retained under a former-contributor label as described in the Privacy Policy.</li>
      </LegalUl>

      <LegalH2>3. User content</LegalH2>
      <LegalP>You must own or have permission to share submitted spots, text, social links, and photos; respect privacy and intellectual-property rights; and avoid illegal, dangerous, deceptive, or abusive content. You retain ownership and grant SpotFinder a worldwide, non-exclusive, royalty-free licence to host, reproduce as technically necessary, display, and distribute the contribution within the Service. The scope and post-deletion duration of this licence require legal review. Content may be moderated or removed.</LegalP>

      <LegalH2>4. Acceptable use</LegalH2>
      <LegalUl>
        <li>Do not access another account, evade security/rate limits, automate abuse, or manipulate ratings.</li>
        <li>Do not post personal data without authority or content that infringes rights.</li>
        <li>Do not scrape or resell protected Service/provider data without permission.</li>
      </LegalUl>

      <LegalH2>5. Subscriptions and payments</LegalH2>
      <LegalUl>
        <li>Elite/Ultra cards are previews unless both client and server checkout switches are enabled. A preview is not an offer for sale.</li>
        <li>If enabled after review, Stripe Checkout creates an auto-renewing monthly/yearly subscription at the price shown at checkout.</li>
        <li>The current app has no verified self-service cancellation portal. Support cancellation, tax/invoice handling, failure recovery, entitlement revocation, and checkout withdrawal disclosures must be operationally verified before sales are enabled.</li>
        <li>See the <a href="/RefundPolicy" className="underline text-blue-600 dark:text-blue-400">Refund Policy</a>, which is also pending review.</li>
      </LegalUl>

      <LegalH2>6. Advertising</LegalH2>
      <LegalP>Advertising is temporarily disabled and the current build does not request Google ads or create ad slots. Any future advertising requires separate implementation, disclosure, and consent review. Any promise that paid tiers remove ads applies only if paid subscriptions and advertising are actually enabled and the entitlement is active.</LegalP>

      <LegalH2>7. Disclaimers and liability</LegalH2>
      <LegalP>The Service is provided without a guarantee that community or third-party information is accurate, complete, available, lawful to access, or safe. Nothing in these terms excludes rights or liability that applicable law does not permit us to exclude. The appropriate liability wording requires qualified review.</LegalP>

      <LegalH2>8. Suspension and termination</LegalH2>
      <LegalP>Accounts or content may be suspended or removed for rule violations, legal requirements, safety, or abuse prevention. You may stop using the Service and request account deletion.</LegalP>

      <LegalH2>9. Governing law and disputes</LegalH2>
      <LegalP>The governing law and competent court have not been selected or approved and must be completed after operator details are confirmed. Mandatory consumer protections may apply regardless of that choice. The former EU Online Dispute Resolution platform was discontinued in July 2025 and is not presented as an available dispute channel.</LegalP>

      <LegalH2>10. Changes and contact</LegalH2>
      <LegalP>Material changes should be communicated before they take effect where required. Questions: spotfinder@icloud.com.</LegalP>
    </LegalPageLayout>
  );
}
