import { useEffect, useRef, useState } from 'react';
import { getConsent } from '@/lib/consent';

const CLIENT = 'ca-pub-9210597135045895';
const SLOT    = '3588954548';

export default function AdBanner() {
  const containerRef = useRef(null);
  const adRef  = useRef(null);
  const pushed = useRef(false);
  const [adsConsent, setAdsConsent] = useState(() => getConsent().ads);
  const [hasUsableWidth, setHasUsableWidth] = useState(false);

  // React to the user granting/revoking ad consent via the cookie banner
  // without needing a full page reload.
  useEffect(() => {
    const onChange = (e) => {
      const nextConsent = !!e.detail?.ads;
      if (!nextConsent) {
        pushed.current = false;
        setHasUsableWidth(false);
      }
      setAdsConsent(nextConsent);
    };
    window.addEventListener('spotfinder:consent-changed', onChange);
    return () => window.removeEventListener('spotfinder:consent-changed', onChange);
  }, []);

  useEffect(() => {
    if (!adsConsent || !containerRef.current) return undefined;
    const container = containerRef.current;
    const update = () => setHasUsableWidth(container.getClientRects().length > 0 && container.offsetWidth >= 250);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [adsConsent]);

  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current || !adsConsent || !hasUsableWidth || !adRef.current) return;
    pushed.current = true;
    const frame = requestAnimationFrame(() => {
      if (!adRef.current || adRef.current.offsetWidth < 250 || adRef.current.getClientRects().length === 0) {
        pushed.current = false;
        return;
      }
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        pushed.current = false;
        console.warn('AdSense push failed:', e);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [adsConsent, hasUsableWidth]);

  const placeholder = (label) => (
    <div ref={containerRef} className="w-full flex items-center justify-center bg-gray-100 dark:bg-accent/40" style={{ height: 50 }}>
      <span className="text-[10px] text-gray-400 dark:text-muted-foreground">{label}</span>
    </div>
  );

  // No advertising consent yet (or user declined): don't request any ad —
  // AdSense sets advertising/personalization cookies, which requires opt-in
  // consent under GDPR/ePrivacy for EU/EEA/UK users.
  if (!adsConsent) return placeholder('Ad space (enable in Cookie settings)');

  if (!CLIENT || !SLOT) return placeholder('Ad');

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        minWidth: 0,
        height: 50,
        overflow: 'hidden',
        clipPath: 'inset(0)',
        WebkitClipPath: 'inset(0)',
      }}
    >
      {(hasUsableWidth || pushed.current) && <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minWidth: '250px', height: '50px' }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />}
    </div>
  );
}
