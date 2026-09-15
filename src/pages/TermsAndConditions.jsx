import React from 'react';
import LegalPageLayout, { LegalH2, LegalP, LegalUl, LegalStrong, LegalNote } from '@/components/legal/LegalPageLayout';

export default function TermsAndConditions() {
  return (
    <LegalPageLayout title="Terms & Conditions" lastUpdated="[DATE — fill in before publishing]">
      <LegalNote>
        <LegalStrong>Before publishing:</LegalStrong> fill in the bracketed business details, pick a
        real governing law/jurisdiction, and have this reviewed by a lawyer. This draft was prepared
        from an automated review of the app's code and is not legal advice.
      </LegalNote>

      <LegalP>
        These Terms & Conditions ("<LegalStrong>Terms</LegalStrong>") govern your use of the SpotFinder
        app and website (the "<LegalStrong>Service</LegalStrong>"), operated by [YOUR LEGAL ENTITY OR
        SOLE-TRADER NAME], [REGISTERED ADDRESS] ("<LegalStrong>we</LegalStrong>", "<LegalStrong>us</LegalStrong>").
        By creating an account or using the Service, you agree to these Terms.
      </LegalP>

      <LegalH2>1. The Service</LegalH2>
      <LegalP>
        SpotFinder is a community map app for discovering and sharing outdoor "spots" (viewpoints,
        parking, camping, and similar places), with optional paid subscription tiers (Elite/Ultra) that
        unlock additional features. Some map, routing, and points-of-interest data is provided by
        third parties (see our <a href="/PrivacyPolicy" className="underline text-blue-600 dark:text-blue-400">Privacy Policy</a>);
        we don't guarantee the accuracy of third-party map data, and locations shown may be
        inaccurate, outdated, or on private property — always exercise your own judgment and follow
        local laws (including trespassing and access rules) when visiting any spot.
      </LegalP>

      <LegalH2>2. Accounts</LegalH2>
      <LegalUl>
        <li>You must provide accurate information when creating an account and keep your login credentials confidential.</li>
        <li>You're responsible for all activity under your account.</li>
        <li>You must be at least 16 years old to create an account. If we learn an account belongs to a younger child, we may suspend or delete it.</li>
        <li>You may delete your account at any time from Settings.</li>
      </LegalUl>

      <LegalH2>3. User-generated content</LegalH2>
      <LegalP>By submitting a spot, rating, description, photo, or review, you confirm that:</LegalP>
      <LegalUl>
        <li>It's your own content, or you have the right to share it (don't upload photos you don't own or that show identifiable people without their consent).</li>
        <li>It doesn't infringe anyone's copyright, privacy, or other rights.</li>
        <li>It's accurate to the best of your knowledge — spot ratings and descriptions reflect one contributor's opinion/experience, not a verified guarantee of the location's condition, safety, legality of access, or accessibility.</li>
        <li>It doesn't contain hate speech, harassment, spam, illegal content, or content that could endanger others.</li>
      </LegalUl>
      <LegalP>
        You keep ownership of your content, but grant us a worldwide, non-exclusive, royalty-free
        license to host, display, and distribute it within the Service so other users can see it. We
        may remove content that violates these Terms or that we're required to remove by law, and may
        suspend accounts that repeatedly violate them (see our moderation/reporting tools in the app).
      </LegalP>

      <LegalH2>4. Acceptable use</LegalH2>
      <LegalP>You agree not to:</LegalP>
      <LegalUl>
        <li>Use the Service to harass, defraud, or endanger others</li>
        <li>Post fake, misleading, or manipulated ratings/reviews</li>
        <li>Attempt to access other users' accounts or bypass security/rate-limiting measures</li>
        <li>Scrape, reverse-engineer, or resell the Service's data without permission</li>
        <li>Use automated bots to create accounts or content</li>
      </LegalUl>

      <LegalH2>5. Subscriptions & payments</LegalH2>
      <LegalUl>
        <li>SpotFinder Elite and Ultra are paid, auto-renewing subscriptions billed monthly or yearly, as shown at checkout. Prices are shown in the currency displayed at checkout and may change with advance notice.</li>
        <li>Payment is processed by Stripe; by subscribing you also agree to <a href="https://stripe.com/legal/end-users" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">Stripe's terms</a>.</li>
        <li>Subscriptions renew automatically until cancelled. You can cancel any time from Settings/your account; cancellation takes effect at the end of the current billing period, and you keep access until then.</li>
        <li>See our <a href="/RefundPolicy" className="underline text-blue-600 dark:text-blue-400">Refund Policy</a> for cancellations, refunds, and your legal right of withdrawal.</li>
      </LegalUl>

      <LegalH2>6. Advertising</LegalH2>
      <LegalP>
        Free-tier use of the Service may display ads served by Google AdSense, shown only if you've
        consented to advertising cookies. Elite and Ultra subscriptions remove ads. We aren't
        responsible for the content of third-party ads.
      </LegalP>

      <LegalH2>7. Disclaimers</LegalH2>
      <LegalP>
        THE SERVICE IS PROVIDED "AS IS." Spot locations, ratings, directions, and other user- or
        third-party-supplied content may be inaccurate, incomplete, or unsafe. We are not responsible
        for injury, loss, or damage arising from visiting a spot found through the app, from following
        navigation directions, or from relying on user-submitted information. Always check current
        local conditions, access rules, and safety before visiting any location.
      </LegalP>

      <LegalH2>8. Limitation of liability</LegalH2>
      <LegalP>
        To the maximum extent permitted by law, [YOUR LEGAL ENTITY NAME] is not liable for indirect,
        incidental, or consequential damages arising from your use of the Service. Nothing in these
        Terms limits liability that cannot be limited under applicable law (for example, liability for
        death or personal injury caused by negligence, where such a limitation isn't permitted).
      </LegalP>

      <LegalH2>9. Termination</LegalH2>
      <LegalP>
        We may suspend or terminate your account if you violate these Terms. You may stop using the
        Service and delete your account at any time.
      </LegalP>

      <LegalH2>10. Governing law</LegalH2>
      <LegalP>
        These Terms are governed by the laws of [GOVERNING JURISDICTION, e.g. the Czech Republic],
        without regard to conflict-of-law rules. If you're a consumer resident in the EU, mandatory
        consumer-protection provisions of your country of residence may also apply, and you can use
        the EU's{' '}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400">
          Online Dispute Resolution platform
        </a>{' '}
        for cross-border disputes.
      </LegalP>

      <LegalH2>11. Changes to these Terms</LegalH2>
      <LegalP>
        We may update these Terms from time to time. We'll notify you of material changes in the app.
        Continuing to use the Service after changes take effect means you accept the updated Terms.
      </LegalP>

      <LegalH2>12. Contact</LegalH2>
      <LegalP>Questions about these Terms? Email [CONTACT EMAIL].</LegalP>
    </LegalPageLayout>
  );
}
