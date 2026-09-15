import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="[DATE — fill in before publishing]">
      <LegalNote>
        <LegalStrong>Before publishing:</LegalStrong> confirm this matches how you actually handle
        refund requests in Stripe, and fill in the contact email. If you also sell subscriptions
        through Google Play or the Apple App Store billing systems, add a section for their refund
        processes too (those are handled by Google/Apple directly, not by us).
      </LegalNote>

      <LegalP>
        This Refund Policy applies to paid subscriptions (SpotFinder Elite and Ultra) purchased
        directly through the SpotFinder website/app via Stripe.
      </LegalP>

      <LegalH2>1. Your legal right of withdrawal (EU/EEA/UK consumers)</LegalH2>
      <LegalP>
        If you're a consumer in the EU, EEA, or UK, you have a legal right to withdraw from a new
        subscription within <LegalStrong>14 days</LegalStrong> of purchase without giving a reason, for a
        full refund.
      </LegalP>
      <LegalP>
        Because a subscription gives you access to paid features immediately, if you ask us to start
        the service right away (which happens automatically when you subscribe) and then withdraw
        during the 14-day period, we may deduct an amount proportionate to what you already used before
        you told us you wanted to withdraw. If you don't use any paid features before withdrawing, you
        get a full refund of that period.
      </LegalP>
      <LegalP>
        To withdraw, email [CONTACT EMAIL] within 14 days of your purchase with your account email and
        the date you subscribed.
      </LegalP>

      <LegalH2>2. Cancelling your subscription</LegalH2>
      <LegalUl>
        <li>You can cancel auto-renewal at any time from Settings in the app, or by emailing [CONTACT EMAIL].</li>
        <li>Cancelling stops future renewals but doesn't automatically refund the current billing period — you keep access until the end of the period you already paid for.</li>
        <li>Outside the 14-day withdrawal window described above, renewal charges are generally non-refundable, except where required by law or at our discretion (e.g. accidental duplicate charges, billing errors, or extended service outages).</li>
      </LegalUl>

      <LegalH2>3. Billing errors and duplicate charges</LegalH2>
      <LegalP>
        If you believe you were charged in error (wrong amount, duplicate charge, or charged after you
        cancelled), contact [CONTACT EMAIL] with your receipt/transaction ID and we'll investigate and
        correct genuine errors.
      </LegalP>

      <LegalH2>4. How refunds are issued</LegalH2>
      <LegalP>
        Approved refunds are returned to your original payment method via Stripe. Processing times
        depend on your bank/card issuer and are typically 5–10 business days.
      </LegalP>

      <LegalH2>5. Subscriptions purchased through an app store</LegalH2>
      <LegalP>
        If in the future a subscription is purchased through Google Play or the Apple App Store rather
        than directly via Stripe, that purchase is governed by{' '}
        <a href="https://support.google.com/googleplay/answer/2479637" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">
          Google Play's refund policy
        </a>{' '}
        or{' '}
        <a href="https://support.apple.com/en-us/HT204084" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">
          Apple's refund policy
        </a>{' '}
        respectively — refunds for those purchases must be requested from Google/Apple, not from us.
      </LegalP>

      <LegalH2>6. Contact</LegalH2>
      <LegalP>Questions about a charge or refund? Email [CONTACT EMAIL].</LegalP>
    </LegalPageLayout>
  );
}
