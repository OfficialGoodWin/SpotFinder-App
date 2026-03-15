import { useEffect, useRef } from 'react';

const CLIENT = 'ca-pub-9210597135045895';
const SLOT    = '3588954548';

export default function AdBanner() {
  const adRef  = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current) return;
    const width = adRef.current?.offsetWidth ?? 0;
    if (width < 250) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('AdSense push failed:', e);
    }
  }, []);

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