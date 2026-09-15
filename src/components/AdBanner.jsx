import { useEffect, useRef, useState } from 'react';
import { getConsent } from '@/lib/consent';

const CLIENT = 'ca-pub-9210597135045895';
const SLOT    = '3588954548';

export default function AdBanner() {
  const adRef  = useRef(null);
  const pushed = useRef(false);
  const [adsConsent, setAdsConsent] = useState(() => getConsent().ads);

  // React to the user granting/revoking ad consent via the cookie banner
  // without needing a full page reload.
  useEffect(() => {
    const onChange = (e) => setAdsConsent(!!e.detail?.ads);
    window.addEventListener('spotfinder:consent-changed', onChange);
    return () => window.removeEventListener('spotfinder:consent-changed', onChange);
  }, []);

  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current || !adsConsent) return;
    const width = adRef.current?.offsetWidth ?? 0;
    if (width < 250) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('AdSense push failed:', e);
    }
  }, [adsConsent]);

  // No advertising consent yet (or user declined): don't request any ad —
  // AdSense sets advertising/personalization cookies, which requires opt-in
  // consent under GDPR/ePrivacy for EU/EEA/UK users.
  if (!adsConsent) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-100 dark:bg-accent/40"
        style={{ height: 50 }}
      >
        <span className="text-[10px] text-gray-400 dark:text-muted-foreground">Ad space (enable in Cookie settings)</span>
      </div>
    );
  }

  if (!CLIENT || !SLOT) {
    return (
      <div
        className="w-full flex items-center justify-center bg-gray-100 dark:bg-accent/40"
        style={{ height: 50 }}
      >
        <span className="text-[10px] text-gray-400 dark:text-muted-foreground">Ad</span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: 50,
        overflow: 'hidden',
        /* clip-path cuts even position:absolute iframe children */
        clipPath: 'inset(0)',
        WebkitClipPath: 'inset(0)',
      }}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '50px' }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}