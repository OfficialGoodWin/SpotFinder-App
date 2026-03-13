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
const PUBLISHER_ID = 'ca-pub-XXXXXXXXXXXXXXXX'; // e.g. ca-pub-1234567890123456
const AD_SLOT      = 'XXXXXXXXXX';              // e.g. 1234567890
// ────────────────────────────────────────────────────────────────────────────

export default function AdBanner() {
  const adRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    // adsbygoogle must be loaded (via the script in index.html) before push works
    if (pushed.current) return;
    try {
      if (window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      }
    } catch (e) {
      // silently ignore — AdSense not loaded yet or blocked by ad-blocker
    }
  }, []);

  // Don't render if publisher ID hasn't been configured
  if (PUBLISHER_ID === 'ca-pub-XXXXXXXXXXXXXXXX') {
    return (
      <div className="w-full h-[50px] bg-gray-100 dark:bg-card border-t border-gray-200 dark:border-border flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-muted-foreground select-none">
          Ad banner — configure AdSense publisher ID
        </span>
      </div>
    );
  }

  return (
    <div className="w-full bg-background border-t border-gray-200 dark:border-border overflow-hidden" style={{ minHeight: 50 }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: 50 }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={AD_SLOT}
        data-ad-format="banner"
        data-full-width-responsive="false"
      />
    </div>
  );
}
