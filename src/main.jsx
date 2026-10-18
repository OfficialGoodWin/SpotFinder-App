import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootConsent } from '@/lib/consent'
import { applyTextScale, getTextScale } from '@/lib/textScale'
import { installVitePreloadRecovery } from '@/lib/chunkRecovery'
import { registerSpotFinderWorker } from '@/lib/pwaUpdates'

// Optional analytics and advertising are suspended. Boot only removes legacy
// tag artifacts/cookies and exposes an effective necessary-only state.
bootConsent()
applyTextScale(getTextScale())
installVitePreloadRecovery()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Register after the critical map UI has loaded. The worker only caches
// same-origin app-shell assets; map tiles, Firebase, and API traffic stay live.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const register = () => registerSpotFinderWorker();
    if ('requestIdleCallback' in window) window.requestIdleCallback(register);
    else window.setTimeout(register, 1000);
  }, { once: true });
}
