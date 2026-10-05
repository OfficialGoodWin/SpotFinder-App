# SpotFinder
App using mapy.cz to find spots

## Guest anti-spam / reCAPTCHA

Guest visitors use Firebase Anonymous Auth only as a rate-limiting identity; the app does not treat anonymous users as signed-in members. Public feedback is submitted through the `submitFeedback` Cloud Function, which verifies Google reCAPTCHA v3, applies per-anonymous-session and per-IP quotas, and only then writes to Firestore.

Configure the frontend with the public `VITE_RECAPTCHA_SITE_KEY`. Cloud Functions use reCAPTCHA Enterprise assessments with Google Cloud application credentials and the server-only `RECAPTCHA_SITE_KEY`, `RECAPTCHA_ALLOWED_HOSTNAMES`, `RECAPTCHA_MIN_SCORE`, and `ANTI_SPAM_IP_SALT` settings. No reCAPTCHA secret key is used. Enable **Anonymous** sign-in in Firebase Authentication before deployment, then deploy the Functions and Firestore rules.
