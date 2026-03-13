import { useEffect, useRef } from 'react';

/**
 * Google AdSense banner component.
 *
 * Setup steps (one-time):
 *  1. Sign up at https://adsense.google.com and get approved.
 *  2. Replace PUBLISHER_ID below with your real ca-pub-XXXXXXXXXXXXXXXX id.
 *  3. Replace AD_SLOT with the ad unit slot ID from your AdSense dashboard.
 *  4. Uncomment the <script> tag in index.html (see comment there).
 *
 * Until your site is approved by AdSense, the banner area will be blank but
 * reserved — it won't break the layout.
 */

// ── Replace these two values after AdSense approval ─────────────────────────
const CLIENT = 'ca-pub-9210597135045895'; // e.g. ca-pub-1234567890123456
const SLOT      = '3588954548';              // e.g. 1234567890
// ────────────────────────────────────────────────────────────────────────────
 
export default function AdBanner() {
  const adRef = useRef(null);
  const pushed = useRef(false);
 
  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current) return;
    try {
      // adsbygoogle is injected by the script tag in index.html
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('AdSense push failed:', e);
    }
  }, []);
 
  // Placeholder shown when no AdSense credentials are configured
  if (!CLIENT || !SLOT) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-accent/40 rounded-lg border border-dashed border-gray-300 dark:border-border"
        style={{ minHeight: 40 }}
      >
        <span className="text-[10px] text-gray-400 dark:text-muted-foreground text-center leading-tight px-1">
          Ad
        </span>
      </div>
    );
  }
 
  return (
    <div className="w-full h-full overflow-hidden rounded-lg" style={{ minHeight: 40 }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%', minHeight: 40 }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}