# SpotFinder legal and privacy publication checklist

Status: **not approved for publication**. This engineering audit is not legal advice.

## Blocking confirmations

- Confirm the operator's legal name, service address, business status, and support contact. Do not publish unverified registration details.
- Obtain qualified review of the Privacy Policy, Cookie Policy, Terms, and Refund Policy for every country in which the service is offered.
- Verify production data regions, retention periods, processor roles, transfer mechanisms, and data-processing agreements for Firebase, Vercel, Stripe, Google, Geoapify, Mapy/Seznam, OpenRouteService, OSRM, OpenFreeMap/Protomaps, and Wikimedia Commons.
- Run a production cookie/tag inventory. Confirm that Analytics and AdSense make no non-essential storage or requests before opt-in, including Consent Mode behavior.
- Decide whether Elite/Ultra sales are live. If live, verify prices, renewals, checkout consent, invoices/tax, cancellation, withdrawal, and refund operations. If not, remove purchase claims and disable checkout entry points.
- Deploy and verify the new recent-auth account-deletion workflow with disposable emulator/staging accounts. Approve the policy of deleting private data while de-identifying and retaining public geographic contributions; define support recovery for failed requests.
- Confirm the age threshold, parental-consent handling, date-of-birth retention, and the claimed 30-day deletion process.
- Document moderation retention, abuse-prevention IP hashing/retention, reCAPTCHA processing, user-content licensing, takedowns, and appeals.
- Confirm public contributor identity never exposes an email. Legacy records may contain email-derived `created_by` values and require a non-destructive display/privacy audit.
- Confirm consumer-dispute and accessibility information required for the operator's jurisdiction.
- Approve fixed retention periods and an enforceable purge schedule for feedback, moderation, hashed abuse signals, deletion-operation records, audit/provider logs, and payment records.
- Review the public ownership model: current spot documents still contain a Firebase UID for direct owner authorization. Approve migration to private ownership records/callable edits before making stronger privacy claims.

## Photography and third-party content

- New user uploads carry uploader-attestation provenance. Verify that the Terms grant only the rights needed to host and display them.
- Audit images that predate provenance metadata. Never infer ownership or license from a URL.
- Wikimedia images must retain author, license, source URL, and modification attribution wherever required.
- Do not use Mapy, Instagram, TikTok, Foursquare, or other provider imagery outside their APIs and terms. Social posts should remain user-initiated embeds or links with provider URL validation.

## Release evidence to retain

- Approved policy copies and effective dates.
- Production cookie scan and consent test results.
- Processor/subprocessor list and agreements.
- Subscription/refund test transactions and cancellation evidence.
- Account export/deletion test evidence.
- Evidence that both client and server subscription switches remained disabled until the checkout checklist was approved.
- Security-rule emulator results for owner, non-owner, admin, anonymous, and unverified-user cases.
