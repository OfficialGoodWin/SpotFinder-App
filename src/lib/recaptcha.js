const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=';
let loadPromise = null;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const loadRecaptcha = () => {
  if (!isBrowser()) return Promise.reject(new Error('reCAPTCHA requires a browser'));
  if (!SITE_KEY) return Promise.reject(new Error('VITE_RECAPTCHA_SITE_KEY is not configured'));
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-spotfinder-recaptcha="true"]');
    const onReady = () => {
      if (window.grecaptcha?.execute) resolve(window.grecaptcha);
      else reject(new Error('reCAPTCHA failed to initialize'));
    };

    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA script failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `${SCRIPT_URL}${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.dataset.spotfinderRecaptcha = 'true';
    script.onload = onReady;
    script.onerror = () => reject(new Error('reCAPTCHA script failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
};

export const isRecaptchaConfigured = () => Boolean(SITE_KEY);

export const getRecaptchaToken = async (action) => {
  const grecaptcha = await loadRecaptcha();
  await new Promise((resolve) => grecaptcha.ready(resolve));
  const token = await grecaptcha.execute(SITE_KEY, { action });
  if (!token) throw new Error('reCAPTCHA did not return a token');
  return token;
};
