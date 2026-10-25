import React from 'react';
import { Crosshair, Droplets, Mountain, Route, UtensilsCrossed } from 'lucide-react';

export default function NewWelcome({ onExplore, onGps, onSignIn }) {
  return <div className="sf-new-welcome-backdrop" role="presentation">
    <section className="sf-new-welcome" role="dialog" aria-modal="true" aria-labelledby="sf-new-welcome-title">
      <img src="/mobile-v2/official-logo.png" alt="SpotFinder" />
      <h1 id="sf-new-welcome-title">Najdi místa, která stojí za cestu.</h1>
      <p>Výhledy, túry, voda a dobré jídlo od lidí, kteří tam opravdu byli.</p>
      <div className="sf-new-welcome-categories"><span><Mountain />Výhledy</span><span><Route />Túry</span><span><Droplets />Voda</span><span><UtensilsCrossed />Jídlo</span></div>
      <button type="button" className="sf-new-welcome-primary" onClick={onExplore}>Prozkoumat mapu</button>
      <button type="button" className="sf-new-welcome-location" onClick={() => { onExplore(); onGps(); }}><Crosshair size={19} /> Zapnout polohu</button>
      <p className="sf-new-welcome-signin">Máš účet? <button type="button" onClick={() => { onExplore(); onSignIn(); }}>Přihlásit se</button></p>
      <small>Pokračováním souhlasíš s <a href="/TermsAndConditions">Podmínkami</a> a <a href="/PrivacyPolicy">Zásadami ochrany soukromí</a>.</small>
    </section>
  </div>;
}
