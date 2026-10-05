const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const SCRIPT_URL = 'https://www.google.com/recaptcha/enterprise.js?render=';
let loadPromise = null;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const waitForEnterpriseReady = (resolve, reject) => {
  const startedAt = Date.now();
  const check = () => {
    const enterprise = window.grecaptcha?.enterprise;
    if (typeof enterprise?.ready === 'function') {
      enterprise.ready(() => {
        if (typeof window.grecaptcha?.enterprise?.execute === 'function') resolve(window.grecaptcha);
        else reject(new Error('reCAPTCHA Enterprise failed to initialize'));
      });
      return;
    }
    if (Date.now() - startedAt >= 15000) {
      reject(new Error('reCAPTCHA Enterprise timed out while initializing'));
      return;
    }
    window.setTimeout(check, 25);
  };
  check();
};

const loadRecaptcha = () => {
  if (!isBrowser()) return Promise.reject(new Error('reCAPTCHA requires a browser'));
  if (!SITE_KEY) return Promise.reject(new Error('VITE_RECAPTCHA_SITE_KEY is not configured'));
  if (window.grecaptcha?.enterprise?.execute) {
    return new Promise((resolve, reject) => waitForEnterpriseReady(resolve, reject));
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-spotfinder-recaptcha="true"]');
    const onReady = () => waitForEnterpriseReady(resolve, reject);
    const onError = () => reject(new Error('reCAPTCHA Enterprise script failed to load'));

    if (existing) {
      // The tag can already have fired `load` before a second caller arrives.
      // Polling for the Enterprise API handles both that case and Google's
      // short gap between the network event and API readiness.
      onReady();
      return;
    }

    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.dataset.spotfinderRecaptcha = 'true';
    script.onload = onReady;
    script.onerror = onError;
    document.head.appendChild(script);
  }).catch((error) => {
    // Permit a later retry after a genuine network/CSP failure. The singleton
    // promise is retained while loading so concurrent submissions still share it.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
};

export const isRecaptchaConfigured = () => Boolean(SITE_KEY);

export const getRecaptchaToken = async (action) => {
  const grecaptcha = await loadRecaptcha();
  const token = await grecaptcha.enterprise.execute(SITE_KEY, { action });
  if (!token) throw new Error('reCAPTCHA did not return a token');
  return token;
};
