import React, { useState } from 'react';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

// ─── SVG Picture Guides ───────────────────────────────────────────────────────

const GuideAddSpot = () => (
  <svg viewBox="0 0 320 120" className="w-full rounded-xl my-3" style={{maxHeight:120}}>
    <rect width="320" height="120" rx="12" fill="#f0f9ff"/>
    {/* Phone outline */}
    <rect x="10" y="8" width="60" height="104" rx="8" fill="white" stroke="#93c5fd" strokeWidth="1.5"/>
    <rect x="14" y="18" width="52" height="70" rx="4" fill="#dbeafe"/>
    {/* Map dots */}
    <circle cx="28" cy="38" r="3" fill="#60a5fa"/>
    <circle cx="50" cy="45" r="3" fill="#60a5fa"/>
    <circle cx="38" cy="60" r="3" fill="#60a5fa"/>
    {/* Plus button */}
    <circle cx="40" cy="100" r="8" fill="#22c55e"/>
    <line x1="40" y1="96" x2="40" y2="104" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="36" y1="100" x2="44" y2="100" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    {/* Arrow */}
    <path d="M82 60 L108 60" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#arr)"/>
    <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>
    {/* Step 2: tap map */}
    <rect x="112" y="8" width="60" height="104" rx="8" fill="white" stroke="#93c5fd" strokeWidth="1.5"/>
    <rect x="116" y="18" width="52" height="70" rx="4" fill="#dbeafe"/>
    <circle cx="142" cy="50" r="5" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
    <line x1="142" y1="55" x2="142" y2="65" stroke="#ef4444" strokeWidth="2"/>
    <circle cx="142" cy="100" r="8" fill="#ef4444"/>
    <line x1="142" y1="96" x2="142" y2="104" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="138" y1="100" x2="146" y2="100" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <path d="M184 60 L210 60" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#arr)"/>
    {/* Step 3: form */}
    <rect x="214" y="8" width="96" height="104" rx="8" fill="white" stroke="#93c5fd" strokeWidth="1.5"/>
    <rect x="222" y="18" width="80" height="12" rx="3" fill="#dbeafe"/>
    <rect x="222" y="35" width="80" height="20" rx="3" fill="#f1f5f9"/>
    <text x="230" y="49" fontSize="7" fill="#64748b">Nice place...</text>
    {/* Stars */}
    <text x="222" y="70" fontSize="12" fill="#fbbf24">★★★★☆</text>
    {/* Save button */}
    <rect x="222" y="80" width="80" height="20" rx="5" fill="#3b82f6"/>
    <text x="262" y="94" fontSize="9" fill="white" textAnchor="middle">Save</text>
    {/* Step labels */}
    <text x="40" y="8" fontSize="7" fill="#3b82f6" textAnchor="middle">1</text>
    <text x="142" y="8" fontSize="7" fill="#3b82f6" textAnchor="middle">2</text>
    <text x="262" y="8" fontSize="7" fill="#3b82f6" textAnchor="middle">3</text>
  </svg>
);

const GuideNavigate = () => (
  <svg viewBox="0 0 280 110" className="w-full rounded-xl my-3" style={{maxHeight:110}}>
    <rect width="280" height="110" rx="12" fill="#f0fdf4"/>
    {/* Map */}
    <rect x="10" y="10" width="120" height="90" rx="8" fill="white" stroke="#86efac" strokeWidth="1.5"/>
    <rect x="14" y="14" width="112" height="68" rx="4" fill="#dcfce7"/>
    {/* Route line */}
    <path d="M30 70 Q50 50 60 40 Q80 30 100 28" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* User dot */}
    <circle cx="30" cy="70" r="5" fill="#3b82f6" stroke="white" strokeWidth="1.5"/>
    {/* Destination pin */}
    <circle cx="100" cy="28" r="6" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
    {/* Popup */}
    <rect x="20" y="82" width="100" height="16" rx="4" fill="#3b82f6"/>
    <text x="70" y="94" fontSize="8" fill="white" textAnchor="middle">▶ Navigate Here</text>
    {/* Arrow */}
    <path d="M140 55 L165 55" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#a2)"/>
    <defs><marker id="a2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>
    {/* Nav panel */}
    <rect x="168" y="10" width="100" height="90" rx="8" fill="white" stroke="#86efac" strokeWidth="1.5"/>
    <rect x="174" y="16" width="88" height="30" rx="4" fill="#1d4ed8"/>
    <text x="218" y="26" fontSize="7" fill="#93c5fd" textAnchor="middle">Navigating to</text>
    <text x="218" y="38" fontSize="9" fill="white" textAnchor="middle" fontWeight="bold">Park Spot</text>
    <rect x="174" y="52" width="40" height="16" rx="4" fill="#f1f5f9"/>
    <text x="194" y="63" fontSize="7" fill="#475569" textAnchor="middle">3.2 km</text>
    <rect x="220" y="52" width="40" height="16" rx="4" fill="#f1f5f9"/>
    <text x="240" y="63" fontSize="7" fill="#475569" textAnchor="middle">8 min</text>
    <rect x="174" y="74" width="88" height="20" rx="5" fill="#22c55e"/>
    <text x="218" y="88" fontSize="9" fill="white" textAnchor="middle">Start Navigation</text>
  </svg>
);

const GuideRate = () => (
  <svg viewBox="0 0 260 100" className="w-full rounded-xl my-3" style={{maxHeight:100}}>
    <rect width="260" height="100" rx="12" fill="#fffbeb"/>
    {/* Spot card */}
    <rect x="10" y="10" width="110" height="80" rx="8" fill="white" stroke="#fcd34d" strokeWidth="1.5"/>
    <rect x="18" y="18" width="94" height="28" rx="4" fill="#dbeafe"/>
    <text x="65" y="28" fontSize="8" fill="#3b82f6" textAnchor="middle" fontWeight="bold">Parking Spot</text>
    <text x="65" y="40" fontSize="7" fill="#64748b" textAnchor="middle">Added by user</text>
    {/* Stars interactive */}
    <text x="18" y="60" fontSize="14" fill="#fbbf24">★★★</text>
    <text x="68" y="60" fontSize="14" fill="#d1d5db">★★</text>
    <text x="18" y="75" fontSize="7" fill="#64748b">Tap stars to rate</text>
    {/* Arrow */}
    <path d="M128 50 L148 50" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#a3)"/>
    <defs><marker id="a3" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>
    {/* After rating */}
    <rect x="150" y="10" width="100" height="80" rx="8" fill="white" stroke="#86efac" strokeWidth="1.5"/>
    <text x="200" y="35" fontSize="12" fill="#fbbf24" textAnchor="middle">★★★★★</text>
    <rect x="158" y="48" width="84" height="22" rx="6" fill="#dcfce7"/>
    <text x="200" y="57" fontSize="7" fill="#166534" textAnchor="middle">✓ Thanks for</text>
    <text x="200" y="67" fontSize="7" fill="#166534" textAnchor="middle">rating!</text>
    {/* Labels */}
    <text x="65" y="97" fontSize="7" fill="#92400e" textAnchor="middle">Before</text>
    <text x="200" y="97" fontSize="7" fill="#166534" textAnchor="middle">After</text>
  </svg>
);

const GuideShare = () => (
  <svg viewBox="0 0 280 100" className="w-full rounded-xl my-3" style={{maxHeight:100}}>
    <rect width="280" height="100" rx="12" fill="#fdf4ff"/>
    {/* Phone 1 - spot detail */}
    <rect x="10" y="10" width="90" height="80" rx="8" fill="white" stroke="#d8b4fe" strokeWidth="1.5"/>
    <rect x="16" y="16" width="78" height="40" rx="4" fill="#ede9fe"/>
    <text x="55" y="30" fontSize="8" fill="#7c3aed" textAnchor="middle" fontWeight="bold">Great Spot</text>
    <text x="55" y="42" fontSize="7" fill="#8b5cf6" textAnchor="middle">⭐ 4.5 · 12 ratings</text>
    {/* Share button */}
    <rect x="16" y="62" width="78" height="20" rx="5" fill="#7c3aed"/>
    <text x="55" y="76" fontSize="8" fill="white" textAnchor="middle">↑ Share</text>
    {/* Arrow */}
    <path d="M106 50 L128 50" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#a4)"/>
    <defs><marker id="a4" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>
    {/* Share sheet */}
    <rect x="130" y="10" width="60" height="80" rx="8" fill="white" stroke="#d8b4fe" strokeWidth="1.5"/>
    <text x="160" y="30" fontSize="7" fill="#475569" textAnchor="middle">Share via…</text>
    <rect x="138" y="36" width="44" height="14" rx="3" fill="#f1f5f9"/>
    <text x="160" y="46" fontSize="7" fill="#3b82f6" textAnchor="middle">📋 Copy link</text>
    <rect x="138" y="54" width="44" height="14" rx="3" fill="#f1f5f9"/>
    <text x="160" y="64" fontSize="7" fill="#22c55e" textAnchor="middle">💬 WhatsApp</text>
    <rect x="138" y="72" width="44" height="12" rx="3" fill="#f1f5f9"/>
    <text x="160" y="81" fontSize="7" fill="#ef4444" textAnchor="middle">More…</text>
    {/* Arrow */}
    <path d="M196 50 L218 50" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#a4)"/>
    {/* Phone 2 - opens link */}
    <rect x="220" y="10" width="50" height="80" rx="8" fill="white" stroke="#86efac" strokeWidth="1.5"/>
    <rect x="226" y="16" width="38" height="30" rx="4" fill="#dcfce7"/>
    {/* Map pin */}
    <circle cx="244" cy="28" r="5" fill="#ef4444" stroke="white" strokeWidth="1"/>
    <line x1="244" y1="33" x2="244" y2="38" stroke="#ef4444" strokeWidth="1.5"/>
    <text x="245" y="56" fontSize="6" fill="#64748b" textAnchor="middle">Opens map</text>
    <text x="245" y="65" fontSize="6" fill="#64748b" textAnchor="middle">at exact spot</text>
  </svg>
);

const GuideMapLayers = () => (
  <svg viewBox="0 0 260 100" className="w-full rounded-xl my-3" style={{maxHeight:100}}>
    <rect width="260" height="100" rx="12" fill="#f0f9ff"/>
    {/* Map backgrounds */}
    {[
      {x:10,  label:'Basic',     fill:'#dbeafe', road:'#93c5fd'},
      {x:62,  label:'Outdoor',   fill:'#dcfce7', road:'#86efac'},
      {x:114, label:'Satellite', fill:'#1e3a5f', road:'#3b82f6'},
      {x:166, label:'Traffic',   fill:'#dbeafe', road:'#ef4444'},
    ].map(({x, label, fill, road}) => (
      <g key={label}>
        <rect x={x} y="10" width="44" height="70" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
        <rect x={x+2} y="12" width="40" height="50" rx="4" fill={fill}/>
        <line x1={x+10} y1="40" x2={x+35} y2="32" stroke={road} strokeWidth="2" strokeLinecap="round"/>
        <line x1={x+15} y1="50" x2={x+35} y2="44" stroke={road} strokeWidth="1.5" strokeLinecap="round"/>
        <text x={x+22} y="74" fontSize="6.5" fill="#475569" textAnchor="middle">{label}</text>
        {label==='Traffic' && <><circle cx={x+10} cy="35" r="3" fill="#22c55e"/><circle cx={x+22} cy="38" r="3" fill="#fbbf24"/><circle cx={x+34} cy="34" r="3" fill="#ef4444"/></>}
      </g>
    ))}
    {/* Layers button */}
    <rect x="218" y="10" width="32" height="70" rx="6" fill="#3b82f6"/>
    <rect x="222" y="22" width="24" height="4" rx="2" fill="white"/>
    <rect x="222" y="30" width="24" height="4" rx="2" fill="white"/>
    <rect x="222" y="38" width="24" height="4" rx="2" fill="white"/>
    <text x="234" y="60" fontSize="6.5" fill="white" textAnchor="middle">Layers</text>
    <text x="234" y="68" fontSize="6.5" fill="#93c5fd" textAnchor="middle">button</text>
  </svg>
);

const GuideVoice = () => (
  <svg viewBox="0 0 260 100" className="w-full rounded-xl my-3" style={{maxHeight:100}}>
    <rect width="260" height="100" rx="12" fill="#fef9f0"/>
    {/* Form */}
    <rect x="10" y="10" width="160" height="80" rx="8" fill="white" stroke="#fcd34d" strokeWidth="1.5"/>
    <text x="90" y="24" fontSize="8" fill="#374151" textAnchor="middle" fontWeight="bold">Add Spot</text>
    {/* Textarea */}
    <rect x="18" y="30" width="120" height="30" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
    <text x="22" y="43" fontSize="7" fill="#374151">Nice place</text>
    <text x="22" y="53" fontSize="7" fill="#d97706" fontStyle="italic">to rest…</text>
    {/* Mic button */}
    <rect x="118" y="27" width="24" height="12" rx="4" fill="#fef3c7"/>
    <circle cx="130" cy="31" r="3" fill="#f97316"/>
    <path d="M127 34 Q130 37 133 34" stroke="#f97316" strokeWidth="1" fill="none"/>
    <line x1="130" y1="37" x2="130" y2="39" stroke="#f97316" strokeWidth="1"/>
    {/* Recording bars */}
    <rect x="18" y="64" width="120" height="18" rx="4" fill="#fef3c7"/>
    <text x="78" y="71" fontSize="6" fill="#92400e" textAnchor="middle">🔴 Listening…</text>
    <text x="78" y="79" fontSize="6" fill="#b45309" textAnchor="middle">Speak your description</text>
    {/* Tips */}
    <rect x="178" y="10" width="72" height="80" rx="8" fill="white" stroke="#fcd34d" strokeWidth="1.5"/>
    <text x="214" y="22" fontSize="7" fill="#374151" textAnchor="middle" fontWeight="bold">Tips</text>
    {[
      '✓ Speak clearly',
      '✓ Any language',
      '✓ Tap again',
      '  to stop',
      '✓ Edit after',
    ].map((tip, i) => (
      <text key={i} x="182" y={34 + i*12} fontSize="6.5" fill="#475569">{tip}</text>
    ))}
  </svg>
);

const GuideTraffic = () => (
  <svg viewBox="0 0 260 100" className="w-full rounded-xl my-3" style={{maxHeight:100}}>
    <rect width="260" height="100" rx="12" fill="#fff5f5"/>
    {/* Map with traffic */}
    <rect x="10" y="10" width="150" height="80" rx="8" fill="#1e3a5f" stroke="#ef4444" strokeWidth="1.5"/>
    {/* Roads */}
    <line x1="10" y1="50" x2="160" y2="50" stroke="#94a3b8" strokeWidth="6"/>
    <line x1="85" y1="10" x2="85" y2="90" stroke="#94a3b8" strokeWidth="6"/>
    {/* Traffic colors */}
    <line x1="10" y1="50" x2="50" y2="50" stroke="#22c55e" strokeWidth="4"/>
    <line x1="50" y1="50" x2="85" y2="50" stroke="#fbbf24" strokeWidth="4"/>
    <line x1="85" y1="50" x2="160" y2="50" stroke="#ef4444" strokeWidth="4"/>
    {/* Road closure icon */}
    <circle cx="110" cy="30" r="9" fill="white"/>
    <circle cx="110" cy="30" r="8" fill="#CC1111"/>
    <rect x="103" y="27" width="14" height="6" rx="1" fill="white"/>
    {/* Jam icon */}
    <path d="M45 72 L65 72 L56 58 Z" fill="#FFD600" stroke="#CC6600" strokeWidth="1.5"/>
    <text x="55" y="70" fontSize="7" fill="#333" textAnchor="middle">!</text>
    {/* Legend */}
    <rect x="168" y="10" width="82" height="80" rx="8" fill="white" stroke="#fca5a5" strokeWidth="1.5"/>
    <text x="209" y="22" fontSize="7" fill="#374151" textAnchor="middle" fontWeight="bold">Traffic key</text>
    {[
      {col:'#22c55e', label:'Free flow'},
      {col:'#fbbf24', label:'Slow'},
      {col:'#ef4444', label:'Congested'},
    ].map(({col, label}, i) => (
      <g key={label}>
        <rect x="176" y={30 + i*16} width="12" height="8" rx="2" fill={col}/>
        <text x="192" y={38 + i*16} fontSize="7" fill="#374151">{label}</text>
      </g>
    ))}
    <text x="176" y="80" fontSize="6.5" fill="#64748b">⛔ Closed  🚦 Jam</text>
  </svg>
);

const GuideGPS = () => (
  <svg viewBox="0 0 240 90" className="w-full rounded-xl my-3" style={{maxHeight:90}}>
    <rect width="240" height="90" rx="12" fill="#f0f9ff"/>
    {/* Good GPS */}
    <rect x="10" y="10" width="100" height="70" rx="8" fill="white" stroke="#86efac" strokeWidth="1.5"/>
    <rect x="16" y="16" width="88" height="50" rx="4" fill="#dbeafe"/>
    <circle cx="60" cy="41" r="20" fill="#bfdbfe" opacity="0.5"/>
    <circle cx="60" cy="41" r="6" fill="#3b82f6" stroke="white" strokeWidth="2"/>
    <text x="60" y="74" fontSize="7" fill="#166534" textAnchor="middle" fontWeight="bold">✓ Good GPS</text>
    {/* Bad GPS */}
    <rect x="130" y="10" width="100" height="70" rx="8" fill="white" stroke="#fca5a5" strokeWidth="1.5"/>
    <rect x="136" y="16" width="88" height="50" rx="4" fill="#dbeafe"/>
    <circle cx="180" cy="41" r="38" fill="#fecaca" opacity="0.4"/>
    <circle cx="180" cy="41" r="6" fill="#ef4444" stroke="white" strokeWidth="2"/>
    <text x="180" y="74" fontSize="7" fill="#dc2626" textAnchor="middle" fontWeight="bold">Poor GPS (indoors)</text>
    <text x="60" y="85" fontSize="6" fill="#374151" textAnchor="middle">Small circle = accurate</text>
    <text x="180" y="85" fontSize="6" fill="#374151" textAnchor="middle">Large circle = approximate</text>
  </svg>
);

// ─── Full FAQ content in all 12 languages ─────────────────────────────────────
const FAQ_DATA = {
  en: [
    {
      category: 'Getting Started',
      items: [
        { q: 'What is SpotFinder?', a: 'SpotFinder is a community map app for discovering and sharing useful spots — parking areas, scenic viewpoints, rest stops, and more. Add spots, rate them, and navigate directly from the app.', guide: null },
        { q: 'Do I need an account to use SpotFinder?', a: 'No! You can browse, add spots, and rate them all as a guest. Creating an account lets you manage and track the spots you\'ve added.', guide: null },
        { q: 'How do I create an account?', a: 'Tap the person icon in the top-right corner of the map, then choose Sign In or Sign Up. You can register with email/password or sign in with Google.', guide: null },
      ]
    },
    {
      category: 'Adding & Rating Spots',
      items: [
        { q: 'How do I add a spot?', a: 'Tap the green + button at the bottom of the screen to enter add mode, then tap anywhere on the map to place the spot. A form will appear — add a description, star ratings, and a photo.', guide: <GuideAddSpot /> },
        { q: 'Can I use voice to write the description?', a: 'Yes! Tap the Voice button next to the description field. The app listens in whichever language you have selected, so if you switch to Czech in Settings the mic will understand Czech. Tap again to stop — your spoken text will appear in the field and you can edit it.', guide: <GuideVoice /> },
        { q: 'How do I rate a spot?', a: 'Tap any spot on the map to open its detail. You\'ll see an overall star rating you can tap, plus separate ratings for Parking, Beauty, and Privacy. Anyone — including guests — can rate.', guide: <GuideRate /> },
        { q: 'Can I add a photo to my spot?', a: 'Yes — when creating or editing a spot, tap the camera icon to pick a photo from your device. It\'s uploaded to Firebase Storage so it appears for everyone and persists permanently.', guide: null },
        { q: 'Can I delete a spot I added?', a: 'Yes. Open the spot detail and tap the trash icon. You can only delete spots you created (or all spots if you are a super admin).', guide: null },
      ]
    },
    {
      category: 'Navigation',
      items: [
        { q: 'How do I navigate to a spot?', a: 'Tap a spot marker on the map to open the detail panel, then press "Navigate Here". You can also tap the arrow icon next to any spot in the nearby list. Choose Drive, Bike, or Walk and hit Start Navigation.', guide: <GuideNavigate /> },
        { q: 'What routing engine does SpotFinder use?', a: 'SpotFinder uses OSRM (Open Source Routing Machine) — a fast, free routing engine that supports driving, cycling, and walking. Turn-by-turn instructions are spoken aloud using your device\'s text-to-speech in the language you have selected in Settings.', guide: null },
        { q: 'Can I navigate to a searched address?', a: 'Yes. Type any address or place in the search bar at the top. Tap the navigation arrow next to a result to start routing straight to that address.', guide: null },
        { q: 'Will it reroute if I leave the planned road?', a: 'Yes. If you go more than 80 m off the route, SpotFinder automatically recalculates from your current position and announces "Rerouting" in your chosen language.', guide: null },
      ]
    },
    {
      category: 'Map & Traffic',
      items: [
        { q: 'How do I switch the map style?', a: 'Tap the Layers button in the bottom-left corner of the map. You can choose Basic, Outdoor, Satellite, Winter, or Traffic view.', guide: <GuideMapLayers /> },
        { q: 'What does the Traffic layer show?', a: 'The Traffic layer overlays real-time traffic flow — green means free flow, yellow means slow, red means heavy congestion. Road closure markers (⛔) and traffic jam markers (🚦) appear on the map when incidents are detected. These use the TomTom API if a key is configured, or fall back to OpenStreetMap data automatically.', guide: <GuideTraffic /> },
        { q: 'Why is my GPS dot inaccurate?', a: 'GPS accuracy depends on your device and surroundings. Indoors or in dense urban canyons the signal is weaker. The light-blue circle around your dot represents the estimated accuracy radius — the smaller the circle, the better the fix.', guide: <GuideGPS /> },
      ]
    },
    {
      category: 'Sharing & Privacy',
      items: [
        { q: 'How do I share a spot with someone?', a: 'Open any spot detail and tap the Share button (↑). On mobile it opens the native share sheet. On desktop it copies a direct link to the clipboard. When the recipient opens the link, the map flies straight to that exact spot.', guide: <GuideShare /> },
        { q: 'Are my spots public?', a: 'Yes — all spots are visible to everyone. SpotFinder is a community sharing platform so public visibility is intentional.', guide: null },
        { q: 'Where is my data stored?', a: 'Spot data and user accounts live in Firebase (Google Cloud). Photos are stored in Firebase Storage. Authentication is handled by Firebase Auth. No personal data is sold to third parties.', guide: null },
        { q: 'How do I delete my account?', a: 'Tap the profile icon → Delete Account. Type the confirmation word shown and press Delete. Note: full backend deletion requires contacting support.', guide: null },
      ]
    },
  ],

  cs: [
    {
      category: 'Začínáme',
      items: [
        { q: 'Co je SpotFinder?', a: 'SpotFinder je komunitní mapová aplikace pro sdílení zajímavých míst — parkovišť, výhledů, odpočívadel a dalších. Přidávejte spoty, hodnoťte je a navigujte přímo z aplikace.', guide: null },
        { q: 'Potřebuji účet?', a: 'Ne! Jako host můžete procházet mapu, přidávat spoty i hodnotit. Účet umožňuje spravovat vaše přidané spoty.', guide: null },
        { q: 'Jak si vytvořím účet?', a: 'Klepněte na ikonu osoby v pravém horním rohu mapy, poté zvolte Přihlásit se nebo Zaregistrovat se. Lze se přihlásit e-mailem nebo přes Google.', guide: null },
      ]
    },
    {
      category: 'Přidávání a hodnocení spotů',
      items: [
        { q: 'Jak přidám spot?', a: 'Klepněte na zelené tlačítko + dole na obrazovce pro vstup do režimu přidávání, poté klepněte kdekoliv na mapu. Zobrazí se formulář — přidejte popis, hvězdičkové hodnocení a fotku.', guide: <GuideAddSpot /> },
        { q: 'Mohu použít hlas pro popis?', a: 'Ano! Klepněte na tlačítko Hlas vedle pole popisu. Aplikace poslouchá v jazyce nastaveném v Nastavení — přepnete-li na češtinu, mikrofon bude rozumět češtině. Klepnutím znovu zastavíte nahrávání.', guide: <GuideVoice /> },
        { q: 'Jak hodnotím spot?', a: 'Klepněte na spot na mapě a otevřete detail. Uvidíte celkové hvězdičkové hodnocení i samostatná hodnocení Parkování, Krásy a Soukromí. Hodnotit může kdokoli — i hosté.', guide: <GuideRate /> },
        { q: 'Mohu přidat fotku?', a: 'Ano — při vytváření nebo úpravě spotu klepněte na ikonu fotoaparátu. Fotka se nahraje do Firebase Storage a zůstane viditelná trvale.', guide: null },
        { q: 'Mohu smazat svůj spot?', a: 'Ano. Otevřete detail spotu a klepněte na ikonu koše. Smazat lze pouze spoty, které jste sami vytvořili.', guide: null },
      ]
    },
    {
      category: 'Navigace',
      items: [
        { q: 'Jak navigovat ke spotu?', a: 'Klepněte na značku spotu a otevřete detail, poté stiskněte „Navigovat sem". Vyberte Auto, Kolo nebo Pěšky a stiskněte Spustit navigaci.', guide: <GuideNavigate /> },
        { q: 'Jaký navigační engine SpotFinder používá?', a: 'SpotFinder používá OSRM — rychlý bezplatný navigační engine. Pokyny pro odbočky jsou hlasitě čteny v jazyce nastaveném v Nastavení.', guide: null },
        { q: 'Přepočítá trasu automaticky?', a: 'Ano. Odchýlíte-li se od trasy o více než 80 m, SpotFinder automaticky přepočítá z aktuální polohy a ohlásí „Přepočítávám trasu".', guide: null },
      ]
    },
    {
      category: 'Mapa a doprava',
      items: [
        { q: 'Jak přepnu styl mapy?', a: 'Klepněte na tlačítko Vrstvy v levém dolním rohu mapy. Vyberte Základní, Venkovní, Satelit, Zimní nebo Doprava.', guide: <GuideMapLayers /> },
        { q: 'Co zobrazuje vrstva Doprava?', a: 'Vrstva Doprava zobrazuje provoz v reálném čase — zelená = volno, žlutá = pomalu, červená = zácpa. Ikony uzavírek (⛔) a kolon (🚦) se zobrazují automaticky.', guide: <GuideTraffic /> },
        { q: 'Proč je moje GPS tečka nepřesná?', a: 'Přesnost GPS závisí na zařízení a prostředí. V budovách nebo husté zástavbě je signál slabší. Světle modrý kruh kolem tečky znázorňuje odhadovaný poloměr přesnosti.', guide: <GuideGPS /> },
      ]
    },
    {
      category: 'Sdílení a soukromí',
      items: [
        { q: 'Jak sdílet spot?', a: 'Otevřete detail spotu a klepněte na Sdílet (↑). Na mobilu se otevře nativní sdílení, na desktopu se zkopíruje odkaz. Příjemce otevře mapu přesně na daném spotu.', guide: <GuideShare /> },
        { q: 'Jsou moje spoty veřejné?', a: 'Ano — všechny spoty jsou viditelné pro všechny. SpotFinder je komunitní platforma pro sdílení.', guide: null },
        { q: 'Kde jsou uložena má data?', a: 'Data spotů a uživatelské účty jsou uloženy ve Firebase (Google Cloud). Fotky jsou v Firebase Storage. Osobní data nejsou prodávána třetím stranám.', guide: null },
      ]
    },
  ],

  de: [
    {
      category: 'Erste Schritte',
      items: [
        { q: 'Was ist SpotFinder?', a: 'SpotFinder ist eine Community-Karten-App zum Entdecken und Teilen nützlicher Spots — Parkplätze, Aussichtspunkte, Rastplätze und mehr.', guide: null },
        { q: 'Benötige ich ein Konto?', a: 'Nein! Als Gast können Sie Spots durchsuchen, hinzufügen und bewerten. Ein Konto ermöglicht Ihnen die Verwaltung Ihrer eigenen Spots.', guide: null },
        { q: 'Wie erstelle ich ein Konto?', a: 'Tippen Sie auf das Personensymbol oben rechts auf der Karte und wählen Sie Anmelden oder Registrieren. Sie können sich mit E-Mail/Passwort oder Google anmelden.', guide: null },
      ]
    },
    {
      category: 'Spots hinzufügen & bewerten',
      items: [
        { q: 'Wie füge ich einen Spot hinzu?', a: 'Tippen Sie auf die grüne +-Schaltfläche am unteren Bildschirmrand, um den Hinzufüge-Modus zu aktivieren, dann tippen Sie auf eine beliebige Stelle auf der Karte.', guide: <GuideAddSpot /> },
        { q: 'Kann ich Spracheingabe für die Beschreibung nutzen?', a: 'Ja! Tippen Sie auf die Sprach-Schaltfläche neben dem Beschreibungsfeld. Die App hört in der in den Einstellungen ausgewählten Sprache zu — bei Deutsch versteht das Mikrofon Deutsch.', guide: <GuideVoice /> },
        { q: 'Wie bewerte ich einen Spot?', a: 'Tippen Sie auf einen Spot-Marker und öffnen Sie das Detail. Sie sehen eine Gesamtbewertung sowie separate Bewertungen für Parken, Schönheit und Privatsphäre. Jeder kann bewerten.', guide: <GuideRate /> },
        { q: 'Kann ich einen Spot löschen?', a: 'Ja. Öffnen Sie das Detail des Spots und tippen Sie auf das Papierkorb-Symbol. Sie können nur Spots löschen, die Sie selbst erstellt haben.', guide: null },
      ]
    },
    {
      category: 'Navigation',
      items: [
        { q: 'Wie navigiere ich zu einem Spot?', a: 'Tippen Sie auf einen Spot-Marker, dann auf „Hierher navigieren". Wählen Sie Auto, Fahrrad oder Zu Fuß und starten Sie die Navigation.', guide: <GuideNavigate /> },
        { q: 'Wird die Route automatisch neu berechnet?', a: 'Ja. Wenn Sie mehr als 80 m von der Route abweichen, berechnet SpotFinder automatisch neu und kündigt „Umleitung" in Ihrer gewählten Sprache an.', guide: null },
      ]
    },
    {
      category: 'Karte & Verkehr',
      items: [
        { q: 'Wie wechsle ich den Kartenstil?', a: 'Tippen Sie auf die Ebenen-Schaltfläche unten links auf der Karte. Sie können zwischen Grundkarte, Outdoor, Satellit, Winter und Verkehr wählen.', guide: <GuideMapLayers /> },
        { q: 'Was zeigt die Verkehrsebene?', a: 'Die Verkehrsebene zeigt den Echtzeit-Verkehrsfluss — Grün = freie Fahrt, Gelb = langsam, Rot = Stau. Straßensperren (⛔) und Stau-Marker (🚦) erscheinen automatisch.', guide: <GuideTraffic /> },
      ]
    },
    {
      category: 'Teilen & Datenschutz',
      items: [
        { q: 'Wie teile ich einen Spot?', a: 'Öffnen Sie ein Spot-Detail und tippen Sie auf Teilen (↑). Auf dem Handy öffnet sich das native Teilen-Menü, am Desktop wird ein Link kopiert. Der Empfänger öffnet die Karte direkt am Spot.', guide: <GuideShare /> },
        { q: 'Sind meine Spots öffentlich?', a: 'Ja — alle Spots sind für alle sichtbar. SpotFinder ist eine Community-Plattform.', guide: null },
      ]
    },
  ],

  pl: [
    {
      category: 'Pierwsze kroki',
      items: [
        { q: 'Czym jest SpotFinder?', a: 'SpotFinder to aplikacja mapowa do odkrywania i udostępniania miejsc — parkingów, punktów widokowych, miejsc odpoczynku i nie tylko.', guide: null },
        { q: 'Czy potrzebuję konta?', a: 'Nie! Jako gość możesz przeglądać mapę, dodawać spoty i je oceniać. Konto umożliwia zarządzanie dodanymi przez Ciebie spotami.', guide: null },
      ]
    },
    {
      category: 'Dodawanie i ocenianie spotów',
      items: [
        { q: 'Jak dodać spot?', a: 'Naciśnij zielony przycisk + na dole ekranu, aby przejść do trybu dodawania, a następnie dotknij dowolnego miejsca na mapie. Wypełnij formularz z opisem, ocenami i zdjęciem.', guide: <GuideAddSpot /> },
        { q: 'Czy mogę użyć głosu do opisu?', a: 'Tak! Naciśnij przycisk Głos obok pola opisu. Aplikacja słucha w języku wybranym w Ustawieniach. Naciśnij ponownie, aby zatrzymać nagrywanie.', guide: <GuideVoice /> },
        { q: 'Jak ocenić spot?', a: 'Dotknij znacznika spotu na mapie, aby otworzyć szczegóły. Zobaczysz ogólną ocenę oraz osobne oceny dla Parkowania, Piękna i Prywatności. Każdy może oceniać — również goście.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Nawigacja',
      items: [
        { q: 'Jak nawigować do spotu?', a: 'Dotknij znacznika spotu, następnie naciśnij „Nawiguj tutaj". Wybierz Auto, Rower lub Pieszo i uruchom nawigację.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Mapa i ruch drogowy',
      items: [
        { q: 'Jak zmienić styl mapy?', a: 'Naciśnij przycisk Warstwy w lewym dolnym rogu mapy. Dostępne opcje: Podstawowa, Zewnętrzna, Satelita, Zimowa, Ruch.', guide: <GuideMapLayers /> },
        { q: 'Co pokazuje warstwa Ruchu?', a: 'Warstwa Ruchu pokazuje ruch w czasie rzeczywistym — zielony = swobodny, żółty = wolny, czerwony = korek. Ikony zamkniętych dróg (⛔) i korków (🚦) pojawiają się automatycznie.', guide: <GuideTraffic /> },
      ]
    },
    {
      category: 'Udostępnianie i prywatność',
      items: [
        { q: 'Jak udostępnić spot?', a: 'Otwórz szczegóły spotu i naciśnij Udostępnij (↑). Na telefonie otworzy się natywne udostępnianie, na komputerze zostanie skopiowany link. Odbiorca otworzy mapę dokładnie w tym miejscu.', guide: <GuideShare /> },
        { q: 'Czy moje spoty są publiczne?', a: 'Tak — wszystkie spoty są widoczne dla wszystkich. SpotFinder to platforma do wspólnego odkrywania miejsc.', guide: null },
      ]
    },
  ],

  sk: [
    {
      category: 'Začíname',
      items: [
        { q: 'Čo je SpotFinder?', a: 'SpotFinder je komunitná mapová aplikácia na objavovanie a zdieľanie zaujímavých miest — parkovísk, výhľadov, oddychových miest a ďalšieho.', guide: null },
        { q: 'Potrebujem účet?', a: 'Nie! Ako hosť môžete prezerať mapu, pridávať spoty aj ich hodnotiť. Účet umožňuje spravovať vaše pridané spoty.', guide: null },
      ]
    },
    {
      category: 'Pridávanie a hodnotenie spotov',
      items: [
        { q: 'Ako pridám spot?', a: 'Klepnite na zelené tlačidlo + dole na obrazovke, potom klepnite kdekoľvek na mapu. Vyplňte formulár s popisom, hodnoteniami a fotkou.', guide: <GuideAddSpot /> },
        { q: 'Ako hodnotím spot?', a: 'Klepnite na spot a otvorte detail. Uvidíte celkové hodnotenie aj samostatné hodnotenia Parkovania, Krásy a Súkromia. Hodnotiť môže ktokoľvek — aj hostia.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Navigácia',
      items: [
        { q: 'Ako navigovať k spotu?', a: 'Klepnite na značku spotu, potom stlačte „Navigovať sem". Vyberte Auto, Bicykel alebo Pešo a spustite navigáciu.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Mapa a doprava',
      items: [
        { q: 'Ako prepnem štýl mapy?', a: 'Klepnite na tlačidlo Vrstvy vľavo dole na mape. Vyberte Základnú, Vonkajšiu, Satelit, Zimnú alebo Dopravu.', guide: <GuideMapLayers /> },
      ]
    },
    {
      category: 'Zdieľanie a súkromie',
      items: [
        { q: 'Ako zdieľam spot?', a: 'Otvorte detail spotu a klepnite na Zdieľať (↑). Na mobile sa otvorí natívne zdieľanie, na počítači sa skopíruje odkaz.', guide: <GuideShare /> },
      ]
    },
  ],

  fr: [
    {
      category: 'Premiers pas',
      items: [
        { q: 'Qu\'est-ce que SpotFinder ?', a: 'SpotFinder est une application cartographique communautaire pour découvrir et partager des spots utiles — parkings, points de vue, aires de repos et bien plus.', guide: null },
        { q: 'Ai-je besoin d\'un compte ?', a: 'Non ! En tant qu\'invité, vous pouvez parcourir la carte, ajouter des spots et les noter. Un compte vous permet de gérer vos spots ajoutés.', guide: null },
      ]
    },
    {
      category: 'Ajouter & noter des spots',
      items: [
        { q: 'Comment ajouter un spot ?', a: 'Appuyez sur le bouton vert + en bas de l\'écran pour activer le mode ajout, puis appuyez n\'importe où sur la carte. Remplissez le formulaire avec une description, des étoiles et une photo.', guide: <GuideAddSpot /> },
        { q: 'Comment noter un spot ?', a: 'Appuyez sur un marqueur de spot pour ouvrir le détail. Vous verrez une note globale et des notes séparées pour le Stationnement, la Beauté et la Confidentialité. Tout le monde peut noter.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Navigation',
      items: [
        { q: 'Comment naviguer vers un spot ?', a: 'Appuyez sur un marqueur de spot, puis sur « Naviguer ici ». Choisissez Voiture, Vélo ou À pied et démarrez la navigation.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Carte & Trafic',
      items: [
        { q: 'Comment changer le style de carte ?', a: 'Appuyez sur le bouton Couches en bas à gauche de la carte. Choisissez entre Base, Extérieur, Satellite, Hiver ou Trafic.', guide: <GuideMapLayers /> },
        { q: 'Que montre la couche Trafic ?', a: 'La couche Trafic affiche le flux en temps réel — vert = fluide, jaune = ralenti, rouge = embouteillage. Les marqueurs de fermetures (⛔) et d\'embouteillages (🚦) apparaissent automatiquement.', guide: <GuideTraffic /> },
      ]
    },
    {
      category: 'Partage & Confidentialité',
      items: [
        { q: 'Comment partager un spot ?', a: 'Ouvrez le détail d\'un spot et appuyez sur Partager (↑). Sur mobile, le menu de partage natif s\'ouvre. Sur ordinateur, un lien est copié. Le destinataire ouvre la carte directement sur le spot.', guide: <GuideShare /> },
      ]
    },
  ],

  it: [
    {
      category: 'Per iniziare',
      items: [
        { q: 'Cos\'è SpotFinder?', a: 'SpotFinder è un\'app di mappe comunitaria per scoprire e condividere spot utili — parcheggi, punti panoramici, aree di sosta e altro ancora.', guide: null },
        { q: 'Ho bisogno di un account?', a: 'No! Come ospite puoi sfogliare la mappa, aggiungere spot e valutarli. Un account ti permette di gestire gli spot che hai aggiunto.', guide: null },
      ]
    },
    {
      category: 'Aggiungere e valutare spot',
      items: [
        { q: 'Come aggiungo uno spot?', a: 'Tocca il pulsante verde + in basso sullo schermo per entrare in modalità aggiunta, poi tocca qualsiasi punto della mappa. Compila il modulo con descrizione, stelle e foto.', guide: <GuideAddSpot /> },
        { q: 'Come valuto uno spot?', a: 'Tocca un marcatore spot per aprire il dettaglio. Vedrai una valutazione complessiva e valutazioni separate per Parcheggio, Bellezza e Privacy. Chiunque può valutare.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Navigazione',
      items: [
        { q: 'Come navigo verso uno spot?', a: 'Tocca un marcatore spot, poi premi "Naviga qui". Scegli Auto, Bici o A piedi e avvia la navigazione.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Mappa & Traffico',
      items: [
        { q: 'Come cambio lo stile della mappa?', a: 'Tocca il pulsante Livelli in basso a sinistra sulla mappa. Scegli tra Base, Outdoor, Satellite, Inverno o Traffico.', guide: <GuideMapLayers /> },
      ]
    },
    {
      category: 'Condivisione & Privacy',
      items: [
        { q: 'Come condivido uno spot?', a: 'Apri il dettaglio di uno spot e tocca Condividi (↑). Su mobile si apre il menu di condivisione nativo. Su desktop viene copiato un link. Il destinatario apre la mappa esattamente su quello spot.', guide: <GuideShare /> },
      ]
    },
  ],

  ru: [
    {
      category: 'Начало работы',
      items: [
        { q: 'Что такое SpotFinder?', a: 'SpotFinder — это приложение-карта для обмена полезными местами: парковками, видовыми площадками, местами отдыха и многим другим.', guide: null },
        { q: 'Нужна ли мне учётная запись?', a: 'Нет! В качестве гостя вы можете просматривать карту, добавлять споты и оценивать их. Аккаунт позволяет управлять добавленными спотами.', guide: null },
      ]
    },
    {
      category: 'Добавление и оценка спотов',
      items: [
        { q: 'Как добавить спот?', a: 'Нажмите зелёную кнопку + внизу экрана для входа в режим добавления, затем нажмите в любом месте карты. Заполните форму с описанием, звёздами и фото.', guide: <GuideAddSpot /> },
        { q: 'Как оценить спот?', a: 'Нажмите на маркер спота, чтобы открыть подробности. Вы увидите общую оценку и отдельные оценки для Парковки, Красоты и Приватности. Оценивать может любой, включая гостей.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Навигация',
      items: [
        { q: 'Как навигировать к споту?', a: 'Нажмите на маркер спота, затем нажмите «Навигация сюда». Выберите Авто, Велосипед или Пешком и начните навигацию.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Карта и трафик',
      items: [
        { q: 'Как переключить стиль карты?', a: 'Нажмите кнопку Слои в левом нижнем углу карты. Выберите Базовую, Природную, Спутник, Зимнюю или Трафик.', guide: <GuideMapLayers /> },
        { q: 'Что показывает слой Трафик?', a: 'Слой Трафик отображает поток движения в реальном времени — зелёный = свободно, жёлтый = медленно, красный = пробка. Иконки перекрытых дорог (⛔) и пробок (🚦) появляются автоматически.', guide: <GuideTraffic /> },
      ]
    },
    {
      category: 'Совместный доступ и конфиденциальность',
      items: [
        { q: 'Как поделиться спотом?', a: 'Откройте подробности спота и нажмите Поделиться (↑). На мобильном откроется нативное меню, на десктопе скопируется ссылка. Получатель откроет карту прямо на этом споте.', guide: <GuideShare /> },
      ]
    },
  ],

  uk: [
    {
      category: 'Початок роботи',
      items: [
        { q: 'Що таке SpotFinder?', a: 'SpotFinder — це спільнотний картографічний застосунок для обміну корисними місцями: паркінгами, видовими майданчиками, місцями відпочинку та іншим.', guide: null },
        { q: 'Чи потрібен мені обліковий запис?', a: 'Ні! Як гість ви можете переглядати карту, додавати споти та оцінювати їх. Акаунт дозволяє керувати доданими спотами.', guide: null },
      ]
    },
    {
      category: 'Додавання і оцінка спотів',
      items: [
        { q: 'Як додати спот?', a: 'Натисніть зелену кнопку + внизу екрана для входу в режим додавання, потім натисніть будь-де на карті. Заповніть форму з описом, зірками та фото.', guide: <GuideAddSpot /> },
        { q: 'Як оцінити спот?', a: 'Натисніть на маркер спота, щоб відкрити подробиці. Ви побачите загальну оцінку та окремі оцінки для Паркінгу, Краси та Приватності. Оцінювати може будь-хто.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Навігація',
      items: [
        { q: 'Як навігувати до спота?', a: 'Натисніть на маркер спота, потім натисніть «Навігація сюди». Виберіть Авто, Велосипед або Пішки і розпочніть навігацію.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Карта і трафік',
      items: [
        { q: 'Як переключити стиль карти?', a: 'Натисніть кнопку Шари у лівому нижньому куті карти. Виберіть Базову, Природну, Супутник, Зимову або Трафік.', guide: <GuideMapLayers /> },
      ]
    },
    {
      category: 'Поширення і конфіденційність',
      items: [
        { q: 'Як поділитися спотом?', a: 'Відкрийте подробиці спота і натисніть Поділитися (↑). На мобільному відкриється нативне меню, на десктопі скопіюється посилання.', guide: <GuideShare /> },
      ]
    },
  ],

  hu: [
    {
      category: 'Első lépések',
      items: [
        { q: 'Mi az a SpotFinder?', a: 'A SpotFinder egy közösségi térképalkalmazás hasznos spotok felfedezéséhez és megosztásához — parkolók, kilátópontok, pihenőhelyek és egyebek.', guide: null },
        { q: 'Szükségem van fiókra?', a: 'Nem! Vendégként böngészheted a térképet, hozzáadhatsz spotokat és értékelheted őket. A fiók lehetővé teszi az általad hozzáadott spotok kezelését.', guide: null },
      ]
    },
    {
      category: 'Spotok hozzáadása és értékelése',
      items: [
        { q: 'Hogyan adok hozzá egy spotot?', a: 'Koppints a zöld + gombra a képernyő alján a hozzáadási mód aktiválásához, majd koppints a térkép bármely pontjára. Töltsd ki az űrlapot leírással, csillagokkal és fotóval.', guide: <GuideAddSpot /> },
        { q: 'Hogyan értékelek egy spotot?', a: 'Koppints egy spot jelölőre a részletek megnyitásához. Látni fogod az összesített értékelést és a Parkolás, Szépség és Magánszféra kategóriák külön értékeléseit. Bárki értékelhet.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Navigáció',
      items: [
        { q: 'Hogyan navigálok egy spothoz?', a: 'Koppints egy spot jelölőre, majd nyomd meg az „Ide navigálás" gombot. Válassz Autó, Kerékpár vagy Gyalog módot, és indítsd el a navigációt.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Megosztás és adatvédelem',
      items: [
        { q: 'Hogyan osztom meg a spotot?', a: 'Nyiss meg egy spot részletet és koppints a Megosztás gombra (↑). Mobilon megnyílik a natív megosztási menü, asztali gépen másolódik a link.', guide: <GuideShare /> },
      ]
    },
  ],

  ro: [
    {
      category: 'Noțiuni de bază',
      items: [
        { q: 'Ce este SpotFinder?', a: 'SpotFinder este o aplicație de hărți comunitară pentru descoperirea și partajarea spoturilor utile — parcări, priveliști, locuri de odihnă și altele.', guide: null },
        { q: 'Am nevoie de un cont?', a: 'Nu! Ca vizitator poți naviga pe hartă, adăuga spoturi și le poți evalua. Un cont îți permite să gestionezi spoturile adăugate de tine.', guide: null },
      ]
    },
    {
      category: 'Adăugarea și evaluarea spoturilor',
      items: [
        { q: 'Cum adaug un spot?', a: 'Atinge butonul verde + din josul ecranului pentru a intra în modul de adăugare, apoi atinge orice loc de pe hartă. Completează formularul cu descriere, stele și fotografie.', guide: <GuideAddSpot /> },
        { q: 'Cum evaluez un spot?', a: 'Atinge un marker de spot pentru a deschide detaliile. Vei vedea o evaluare generală și evaluări separate pentru Parcare, Frumusețe și Intimitate. Oricine poate evalua.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Navigare',
      items: [
        { q: 'Cum navighez la un spot?', a: 'Atinge un marker de spot, apoi apasă „Navighează aici". Alege Mașină, Bicicletă sau Pe jos și pornește navigarea.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Hartă și trafic',
      items: [
        { q: 'Cum schimb stilul hărții?', a: 'Atinge butonul Straturi din colțul stânga jos al hărții. Alege între De bază, Exterior, Satelit, Iarnă sau Trafic.', guide: <GuideMapLayers /> },
      ]
    },
    {
      category: 'Partajare și confidențialitate',
      items: [
        { q: 'Cum partajez un spot?', a: 'Deschide detaliile unui spot și atinge Distribuie (↑). Pe mobil se deschide meniul nativ de partajare. Pe desktop se copiază un link. Destinatarul deschide harta exact pe acel spot.', guide: <GuideShare /> },
      ]
    },
  ],

  es: [
    {
      category: 'Primeros pasos',
      items: [
        { q: '¿Qué es SpotFinder?', a: 'SpotFinder es una aplicación de mapas comunitaria para descubrir y compartir spots útiles — aparcamientos, miradores, áreas de descanso y más.', guide: null },
        { q: '¿Necesito una cuenta?', a: '¡No! Como invitado puedes explorar el mapa, añadir spots y valorarlos. Una cuenta te permite gestionar los spots que hayas añadido.', guide: null },
      ]
    },
    {
      category: 'Añadir y valorar spots',
      items: [
        { q: '¿Cómo añado un spot?', a: 'Toca el botón verde + en la parte inferior de la pantalla para activar el modo de adición, luego toca cualquier lugar del mapa. Rellena el formulario con descripción, estrellas y foto.', guide: <GuideAddSpot /> },
        { q: '¿Puedo usar voz para la descripción?', a: 'Sí. Toca el botón Voz junto al campo de descripción. La app escucha en el idioma seleccionado en Configuración. Toca de nuevo para detener la grabación.', guide: <GuideVoice /> },
        { q: '¿Cómo valoro un spot?', a: 'Toca un marcador de spot para abrir el detalle. Verás una valoración general y valoraciones separadas para Aparcamiento, Belleza y Privacidad. Cualquiera puede valorar.', guide: <GuideRate /> },
      ]
    },
    {
      category: 'Navegación',
      items: [
        { q: '¿Cómo navego a un spot?', a: 'Toca un marcador de spot, luego pulsa «Navegar aquí». Elige Coche, Bici o A pie e inicia la navegación.', guide: <GuideNavigate /> },
      ]
    },
    {
      category: 'Mapa y tráfico',
      items: [
        { q: '¿Cómo cambio el estilo del mapa?', a: 'Toca el botón Capas en la esquina inferior izquierda del mapa. Elige entre Básico, Exterior, Satélite, Invierno o Tráfico.', guide: <GuideMapLayers /> },
        { q: '¿Qué muestra la capa de Tráfico?', a: 'La capa de Tráfico muestra el flujo en tiempo real — verde = libre, amarillo = lento, rojo = atasco. Los marcadores de cortes de tráfico (⛔) y atascos (🚦) aparecen automáticamente.', guide: <GuideTraffic /> },
      ]
    },
    {
      category: 'Compartir y privacidad',
      items: [
        { q: '¿Cómo comparto un spot?', a: 'Abre el detalle de un spot y toca Compartir (↑). En móvil se abre el menú nativo de compartir. En escritorio se copia un enlace. El destinatario abre el mapa justo en ese spot.', guide: <GuideShare /> },
        { q: '¿Mis spots son públicos?', a: 'Sí — todos los spots son visibles para todos. SpotFinder es una plataforma comunitaria.', guide: null },
      ]
    },
  ],
};

// ─── Accordion item ───────────────────────────────────────────────────────────
function AccordionItem({ q, a, guide }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-gray-100 dark:border-border last:border-0 transition-colors ${open ? 'bg-gray-50 dark:bg-accent/40' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-foreground">{q}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {guide && <div className="mb-3">{guide}</div>}
          <p className="text-sm text-gray-600 dark:text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FAQ() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const sections = FAQ_DATA[language] || FAQ_DATA.en;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">{t('faq.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('faq.backToMap')}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {sections.map(section => (
          <div key={section.category}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2 px-1">
              {section.category}
            </h2>
            <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border overflow-hidden">
              {section.items.map(item => (
                <AccordionItem key={item.q} q={item.q} a={item.a} guide={item.guide} />
              ))}
            </div>
          </div>
        ))}
        <p className="text-center text-xs text-muted-foreground pb-8">
          {t('settings.feedback')} → Settings
        </p>
      </div>
    </div>
  );
}
