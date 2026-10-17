import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="17 October 2026">
      <LegalNote><LegalStrong>Review status:</LegalStrong> This draft is pending legal and operational review. Paid checkout must remain disabled until cancellation, withdrawal, tax, and refund operations are verified.</LegalNote>
      <LegalP>This policy applies only to a subscription actually purchased through an enabled SpotFinder checkout. Plan previews are not purchases.</LegalP>

      <LegalH2>1. Withdrawal rights</LegalH2>
      <LegalP>Depending on location and contract, a consumer may have a statutory withdrawal right, including a 14-day period under some European laws. The exact scope, exceptions, notices, and refund calculation need qualified review. Immediate digital-service performance and any proportionate charge may depend on an explicit checkout request and acknowledgement; the current flow has not been verified to collect every required acknowledgement.</LegalP>

      <LegalH2>2. Cancellation</LegalH2>
      <LegalUl>
        <li>The current app has no verified self-service cancellation portal. Contact spotfinder@icloud.com. Support must confirm completion and effective timing.</li>
        <li>Whether access continues to period end and whether a current-period amount is refundable depends on applicable law, checkout terms, and the confirmed Stripe operation.</li>
      </LegalUl>

      <LegalH2>3. Errors and refunds</LegalH2>
      <LegalP>For a duplicate, incorrect, or post-cancellation charge, contact spotfinder@icloud.com with the Stripe receipt or transaction identifier. Any approved refund should be returned through Stripe to the original method. No fixed 5–10-day timing is promised because provider and issuer timing has not been operationally verified.</LegalP>

      <LegalH2>4. App-store purchases</LegalH2>
      <LegalP>No App Store or Google Play purchase path is implemented in the audited web flow. If one is later added, the applicable store process and disclosures must be documented before sale.</LegalP>
    </LegalPageLayout>
  );
}
