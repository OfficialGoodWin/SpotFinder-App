import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise;

function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-spotfinder-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.dataset.spotfinderTurnstile = 'true';
      document.head.appendChild(script);
    }
    const poll = window.setInterval(() => {
      if (window.turnstile?.render) finish(null, window.turnstile);
    }, 50);
    const timeout = window.setTimeout(() => finish(new Error('Challenge timed out')), 15_000);
    const onError = () => finish(new Error('Challenge could not load'));
    function finish(error, api) {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      script.removeEventListener('error', onError);
      if (error) {
        script.remove();
        reject(error);
      } else resolve(api);
    }
    script.addEventListener('error', onError);
  }).catch(error => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

// Dormant reusable UI: mount only after the server requests a challenge.
export default function TurnstileChallenge({ active, siteKey, action, onToken, resetKey = 0 }) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onToken);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  callbackRef.current = onToken;

  useEffect(() => {
    if (!active) return undefined;
    if (!siteKey || !action) {
      setError('Challenge is unavailable. Please try again later.');
      return undefined;
    }
    let cancelled = false;
    let api;
    let widgetId;
    setError('');
    loadTurnstile().then(turnstile => {
      if (cancelled || !containerRef.current) return;
      api = turnstile;
      widgetId = api.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: token => callbackRef.current?.(token),
        'expired-callback': () => {
          callbackRef.current?.(null);
          setError('Challenge expired. Please retry.');
        },
        'error-callback': () => {
          callbackRef.current?.(null);
          setError('Challenge failed. Please retry.');
        },
      });
    }).catch(() => {
      if (!cancelled) setError('Challenge could not load. Please retry.');
    });
    return () => {
      cancelled = true;
      if (widgetId !== undefined) api?.remove(widgetId);
    };
  }, [active, siteKey, action, resetKey, attempt]);

  if (!active) return null;
  return <div role="group" aria-label="Security challenge">
    <div ref={containerRef} />
    {error && <p role="alert">{error} <button type="button" onClick={() => { callbackRef.current?.(null); setError(''); setAttempt(value => value + 1); }}>Retry challenge</button></p>}
  </div>;
}
