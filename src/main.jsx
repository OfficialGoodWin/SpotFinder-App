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
