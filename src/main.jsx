import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootConsent } from '@/lib/consent'

// Must run before any analytics/ads script can load: sets Google Consent
// Mode defaults to "denied" and re-applies any previously-saved consent
// choice. See src/lib/consent.js.
bootConsent()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Register after the critical map UI has loaded. The worker only caches
// same-origin app-shell assets; map tiles, Firebase, and API traffic stay live.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const register = () => navigator.serviceWorker.register('/sw.js')
      .catch(error => console.warn('Service worker registration failed:', error));
    if ('requestIdleCallback' in window) window.requestIdleCallback(register);
    else window.setTimeout(register, 1000);
  }, { once: true });
}
