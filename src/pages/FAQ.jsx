import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowLeft, MapPin, Star, Navigation, Layers, Share2, Mic, Car, Wifi, Lock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';

// ─── Reusable step-by-step guide component ───────────────────────────────────
function StepGuide({ steps }) {
  return (
    <div className="mt-4 space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3 items-start">
          {/* Step number */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-foreground mb-2">{step.label}</p>
            {/* Illustration */}
            <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-border bg-gray-50 dark:bg-accent/30">
              {step.svg}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Illustrations ────────────────────────────────────────────────────────

// Map with + button highlighted
const SvgPlusButton = () => (
  <svg viewBox="0 0 300 160" className="w-full" style={{display:'block'}}>
    <rect width="300" height="160" fill="#f0f9ff"/>
    {/* Phone frame */}
    <rect x="60" y="10" width="180" height="140" rx="14" fill="#1e293b"/>
    <rect x="65" y="18" width="170" height="110" rx="8" fill="#dbeafe"/>
    {/* Map tiles */}
    <rect x="65" y="18" width="85" height="55" rx="0" fill="#e0f2fe"/>
    <rect x="150" y="18" width="85" height="55" rx="0" fill="#f0fdf4"/>
    <rect x="65" y="73" width="85" height="55" rx="0" fill="#fef9f0"/>
    <rect x="150" y="73" width="85" height="55" rx="0" fill="#f0f9ff"/>
    {/* Roads */}
    <line x1="65" y1="73" x2="235" y2="73" stroke="white" strokeWidth="3"/>
    <line x1="150" y1="18" x2="150" y2="128" stroke="white" strokeWidth="3"/>
    {/* Spot markers on map */}
    <circle cx="110" cy="50" r="5" fill="#3b82f6"/>
    <circle cx="185" cy="95" r="5" fill="#22c55e"/>
    {/* Bottom bar */}
    <rect x="65" y="128" width="170" height="22" rx="0" fill="#f8fafc"/>
    {/* + button — highlighted with glow */}
    <circle cx="150" cy="139" r="14" fill="#22c55e" opacity="0.25"/>
    <circle cx="150" cy="139" r="10" fill="#22c55e"/>
    <line x1="150" y1="134" x2="150" y2="144" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="145" y1="139" x2="155" y2="139" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Arrow pointing to + button */}
    <path d="M40 139 L132 139" stroke="#ef4444" strokeWidth="2" markerEnd="url(#red)"/>
    <defs><marker id="red" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#ef4444"/></marker></defs>
    <text x="20" y="136" fontSize="9" fill="#ef4444" fontWeight="bold">TAP</text>
  </svg>
);

// Map with crosshair + tap animation
const SvgTapMap = () => (
  <svg viewBox="0 0 300 160" className="w-full" style={{display:'block'}}>
    <rect width="300" height="160" fill="#f0fdf4"/>
    <rect x="60" y="10" width="180" height="140" rx="14" fill="#1e293b"/>
    <rect x="65" y="18" width="170" height="110" rx="8" fill="#dbeafe"/>
    {/* Map background */}
    <rect x="65" y="18" width="85" height="55" fill="#e0f2fe"/>
    <rect x="150" y="18" width="85" height="55" fill="#f0fdf4"/>
    <rect x="65" y="73" width="85" height="55" fill="#fef9f0"/>
    <rect x="150" y="73" width="85" height="55" fill="#f0f9ff"/>
    <line x1="65" y1="73" x2="235" y2="73" stroke="white" strokeWidth="3"/>
    <line x1="150" y1="18" x2="150" y2="128" stroke="white" strokeWidth="3"/>
    {/* Tap ripples */}
    <circle cx="175" cy="58" r="22" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.3"/>
    <circle cx="175" cy="58" r="14" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.5"/>
    <circle cx="175" cy="58" r="7" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.8"/>
    {/* Pin being placed */}
    <ellipse cx="175" cy="70" rx="4" ry="2" fill="#00000022"/>
    <path d="M175 58 Q178 48 175 44 Q172 48 175 58 Z" fill="#ef4444"/>
    <circle cx="175" cy="44" r="6" fill="#ef4444"/>
    <circle cx="173" cy="42" r="2" fill="white" opacity="0.6"/>
    {/* Bottom bar */}
    <rect x="65" y="128" width="170" height="22" rx="0" fill="#f8fafc"/>
    <circle cx="150" cy="139" r="10" fill="#ef4444"/>
    <line x1="147" y1="136" x2="147" y2="142" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="144" y1="139" x2="150" y2="139" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <line x1="150" y1="136" x2="153" y2="142" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    {/* Crosshair mode indicator */}
    <rect x="75" y="22" width="100" height="14" rx="7" fill="#3b82f6"/>
    <text x="125" y="32" fontSize="7" fill="white" textAnchor="middle">Tap to place spot</text>
    {/* Finger icon */}
    <text x="185" y="75" fontSize="20">👆</text>
  </svg>
);

// Form with description + ratings
const SvgFillForm = () => (
  <svg viewBox="0 0 300 200" className="w-full" style={{display:'block'}}>
    <rect width="300" height="200" fill="#fffbeb"/>
    {/* Bottom sheet form */}
    <rect x="20" y="10" width="260" height="180" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* Header */}
    <rect x="20" y="10" width="260" height="38" rx="16" fill="#3b82f6"/>
    <rect x="20" y="30" width="260" height="18" fill="#3b82f6"/>
    <circle cx="42" cy="29" r="10" fill="#60a5fa"/>
    <path d="M38 29 Q40 25 42 23 Q44 25 46 29 Q44 33 42 35 Q40 33 38 29Z" fill="white" opacity="0.9"/>
    <text x="58" y="27" fontSize="10" fill="white" fontWeight="bold">Add Spot</text>
    <text x="58" y="38" fontSize="7.5" fill="#bfdbfe">lat 50.075, lng 14.437</text>
    {/* Description field */}
    <rect x="32" y="56" width="236" height="38" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
    <text x="40" y="71" fontSize="8" fill="#94a3b8">Description…</text>
    <text x="40" y="83" fontSize="8.5" fill="#374151">Nice quiet spot near the river</text>
    {/* Parking rating */}
    <text x="32" y="108" fontSize="8" fill="#64748b" fontWeight="bold">Parking Quality</text>
    <text x="32" y="122" fontSize="18" fill="#fbbf24">★★★★</text>
    <text x="104" y="122" fontSize="18" fill="#d1d5db">★</text>
    {/* Beauty rating */}
    <text x="32" y="142" fontSize="8" fill="#64748b" fontWeight="bold">Scenery &amp; Beauty</text>
    <text x="32" y="156" fontSize="18" fill="#fbbf24">★★★★★</text>
    {/* Save button */}
    <rect x="32" y="165" width="236" height="20" rx="8" fill="#22c55e"/>
    <text x="150" y="178" fontSize="9" fill="white" textAnchor="middle" fontWeight="bold">Save Spot</text>
  </svg>
);

// Photo upload
const SvgAddPhoto = () => (
  <svg viewBox="0 0 300 160" className="w-full" style={{display:'block'}}>
    <rect width="300" height="160" fill="#fdf4ff"/>
    {/* Camera box */}
    <rect x="30" y="20" width="110" height="120" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* Camera icon area */}
    <rect x="40" y="30" width="90" height="65" rx="8" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,3"/>
    <circle cx="85" cy="63" r="14" fill="#cbd5e1"/>
    <circle cx="85" cy="63" r="9" fill="#94a3b8"/>
    <circle cx="85" cy="63" r="4" fill="#64748b"/>
    <rect x="96" y="34" width="12" height="8" rx="3" fill="#cbd5e1"/>
    <text x="85" y="110" fontSize="8" fill="#94a3b8" textAnchor="middle">Tap to add photo</text>
    {/* Arrow */}
    <path d="M148 80 L165 80" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3,2" markerEnd="url(#gray)"/>
    <defs><marker id="gray" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#94a3b8"/></marker></defs>
    {/* Preview with photo */}
    <rect x="168" y="20" width="102" height="120" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    <rect x="178" y="30" width="82" height="65" rx="8" fill="#dcfce7"/>
    {/* Landscape photo preview */}
    <ellipse cx="219" cy="70" rx="35" ry="15" fill="#86efac"/>
    <ellipse cx="200" cy="75" rx="15" ry="10" fill="#4ade80"/>
    <ellipse cx="235" cy="73" rx="18" ry="12" fill="#22c55e"/>
    <rect x="178" y="75" width="82" height="20" fill="#bfdbfe"/>
    <circle cx="196" cy="64" r="8" fill="#fcd34d"/>
    {/* Remove X */}
    <circle cx="252" cy="34" r="8" fill="#00000066"/>
    <line x1="249" y1="31" x2="255" y2="37" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="255" y1="31" x2="249" y2="37" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <text x="219" y="115" fontSize="8" fill="#22c55e" textAnchor="middle" fontWeight="bold">✓ Photo added</text>
  </svg>
);

// Map showing spot pin
const SvgSpotAppears = () => (
  <svg viewBox="0 0 300 160" className="w-full" style={{display:'block'}}>
    <rect width="300" height="160" fill="#f0f9ff"/>
    {/* Map */}
    <rect x="20" y="10" width="260" height="140" rx="12" fill="#dbeafe"/>
    <rect x="20" y="10" width="130" height="70" rx="0" fill="#e0f2fe"/>
    <rect x="150" y="10" width="130" height="70" rx="0" fill="#f0fdf4"/>
    <rect x="20" y="80" width="130" height="70" rx="0" fill="#fef9f0"/>
    <rect x="150" y="80" width="130" height="70" rx="0" fill="#f0f9ff"/>
    <line x1="20" y1="80" x2="280" y2="80" stroke="white" strokeWidth="4"/>
    <line x1="150" y1="10" x2="150" y2="150" stroke="white" strokeWidth="4"/>
    {/* New spot pin with animation ring */}
    <circle cx="190" cy="52" r="24" fill="#22c55e" opacity="0.15"/>
    <circle cx="190" cy="52" r="16" fill="#22c55e" opacity="0.25"/>
    {/* Pin */}
    <ellipse cx="190" cy="63" rx="5" ry="2.5" fill="#00000022"/>
    <path d="M190 52 Q194 42 190 37 Q186 42 190 52Z" fill="#22c55e"/>
    <circle cx="190" cy="37" r="8" fill="#22c55e"/>
    <circle cx="188" cy="35" r="2.5" fill="white" opacity="0.7"/>
    {/* Sparkle */}
    <text x="204" y="30" fontSize="14">✨</text>
    {/* Other existing spots */}
    <circle cx="90" cy="45" r="7" fill="#3b82f6"/>
    <circle cx="88" cy="43" r="2" fill="white" opacity="0.7"/>
    <circle cx="105" cy="110" r="7" fill="#f97316"/>
    {/* Label callout */}
    <rect x="140" y="90" width="120" height="36" rx="8" fill="white" stroke="#22c55e" strokeWidth="1.5"/>
    <text x="200" y="104" fontSize="8" fill="#166534" textAnchor="middle" fontWeight="bold">✓ Spot saved!</text>
    <text x="200" y="118" fontSize="7" fill="#64748b" textAnchor="middle">Visible to everyone</text>
  </svg>
);

// Open spot detail
const SvgOpenDetail = () => (
  <svg viewBox="0 0 300 180" className="w-full" style={{display:'block'}}>
    <rect width="300" height="180" fill="#f0fdf4"/>
    {/* Map background */}
    <rect x="20" y="10" width="260" height="80" rx="12" fill="#dbeafe"/>
    <line x1="20" y1="50" x2="280" y2="50" stroke="white" strokeWidth="3"/>
    <line x1="150" y1="10" x2="150" y2="90" stroke="white" strokeWidth="3"/>
    {/* Spot pin */}
    <circle cx="110" cy="40" r="10" fill="#3b82f6"/>
    <circle cx="108" cy="38" r="3" fill="white" opacity="0.7"/>
    {/* Tap finger */}
    <text x="118" y="55" fontSize="16">👆</text>
    {/* Bottom sheet popping up */}
    <rect x="20" y="95" width="260" height="75" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    <rect x="130" y="101" width="40" height="4" rx="2" fill="#e2e8f0"/>
    {/* Spot detail content */}
    <circle cx="42" cy="120" r="11" fill="#dbeafe"/>
    <path d="M38 120 Q40 116 42 114 Q44 116 46 120 Q44 124 42 126 Q40 124 38 120Z" fill="#3b82f6" opacity="0.8"/>
    <text x="58" y="118" fontSize="9" fill="#1e293b" fontWeight="bold">Nice Parking Spot</text>
    <text x="58" y="129" fontSize="7.5" fill="#94a3b8">Added by user · today</text>
    {/* Stars */}
    <text x="32" y="148" fontSize="14" fill="#fbbf24">★★★★</text>
    <text x="89" y="148" fontSize="14" fill="#d1d5db">★</text>
    <text x="104" y="148" fontSize="8" fill="#64748b">4.0 (12 ratings)</text>
    {/* Nav button */}
    <rect x="200" y="105" width="72" height="22" rx="8" fill="#3b82f6"/>
    <text x="236" y="119" fontSize="8" fill="white" textAnchor="middle">▶ Navigate</text>
  </svg>
);

// Rate the spot
const SvgRateSpot = () => (
  <svg viewBox="0 0 300 180" className="w-full" style={{display:'block'}}>
    <rect width="300" height="180" fill="#fffbeb"/>
    {/* Detail card */}
    <rect x="20" y="10" width="260" height="160" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* Header */}
    <circle cx="44" cy="32" r="14" fill="#dbeafe"/>
    <path d="M40 32 Q42 28 44 26 Q46 28 48 32 Q46 36 44 38 Q42 36 40 32Z" fill="#3b82f6" opacity="0.8"/>
    <text x="64" y="29" fontSize="9" fill="#1e293b" fontWeight="bold">Great Viewpoint</text>
    <text x="64" y="40" fontSize="7.5" fill="#94a3b8">Added by jan.novak</text>
    {/* Overall rating section */}
    <rect x="30" y="52" width="240" height="32" rx="8" fill="#f8fafc"/>
    <text x="40" y="64" fontSize="7.5" fill="#64748b">Overall Rating</text>
    <text x="40" y="77" fontSize="16" fill="#fbbf24">★★★★</text>
    <text x="108" y="77" fontSize="16" fill="#d1d5db">★</text>
    <text x="126" y="77" fontSize="8" fill="#64748b">4.2 (28)</text>
    {/* Rate this spot section */}
    <rect x="30" y="92" width="240" height="44" rx="8" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1"/>
    <text x="40" y="104" fontSize="8" fill="#1d4ed8" fontWeight="bold">Rate this spot</text>
    {/* Interactive stars */}
    <text x="40" y="126" fontSize="22" fill="#fbbf24">★★★★★</text>
    {/* Finger tapping 5th star */}
    <text x="140" y="136" fontSize="14">👆</text>
    {/* Submitted */}
    <rect x="30" y="144" width="240" height="18" rx="6" fill="#dcfce7"/>
    <text x="150" y="156" fontSize="8.5" fill="#166534" textAnchor="middle" fontWeight="bold">✓ Thanks for rating!</text>
  </svg>
);

// Navigate panel
const SvgNavigate = () => (
  <svg viewBox="0 0 300 200" className="w-full" style={{display:'block'}}>
    <rect width="300" height="200" fill="#f0fdf4"/>
    {/* Map with route */}
    <rect x="20" y="10" width="260" height="90" rx="12" fill="#1e3a5f"/>
    {/* Route path */}
    <path d="M50 85 Q70 60 100 50 Q130 40 170 35 Q200 32 240 30" stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* User dot */}
    <circle cx="50" cy="85" r="8" fill="#3b82f6" stroke="white" strokeWidth="2"/>
    <circle cx="50" cy="85" r="4" fill="white"/>
    {/* Destination */}
    <circle cx="240" cy="30" r="9" fill="#ef4444" stroke="white" strokeWidth="2"/>
    <circle cx="238" cy="28" r="2.5" fill="white" opacity="0.7"/>
    {/* Nav panel */}
    <rect x="20" y="108" width="260" height="82" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* Current instruction banner */}
    <rect x="20" y="108" width="260" height="40" rx="16" fill="#1d4ed8"/>
    <rect x="20" y="128" width="260" height="20" fill="#1d4ed8"/>
    <rect x="30" y="114" width="28" height="28" rx="8" fill="#3b82f6"/>
    <path d="M38 128 L44 122 L50 128" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <text x="66" y="126" fontSize="9" fill="white" fontWeight="bold">Turn right onto Strakonická</text>
    <text x="66" y="138" fontSize="8" fill="#93c5fd">in 200 m</text>
    {/* Distance / time */}
    <text x="50" y="165" fontSize="11" fill="#1e293b" textAnchor="middle" fontWeight="bold">3.2 km</text>
    <text x="50" y="178" fontSize="7.5" fill="#64748b" textAnchor="middle">Distance</text>
    <line x1="130" y1="155" x2="130" y2="180" stroke="#e2e8f0" strokeWidth="1"/>
    <text x="185" y="165" fontSize="11" fill="#1e293b" textAnchor="middle" fontWeight="bold">8 min</text>
    <text x="185" y="178" fontSize="7.5" fill="#64748b" textAnchor="middle">Duration</text>
    <rect x="220" y="156" width="52" height="24" rx="8" fill="#22c55e"/>
    <text x="246" y="172" fontSize="8.5" fill="white" textAnchor="middle" fontWeight="bold">Start</text>
  </svg>
);

// Route modes
const SvgRouteModes = () => (
  <svg viewBox="0 0 300 120" className="w-full" style={{display:'block'}}>
    <rect width="300" height="120" fill="#f8fafc"/>
    {/* Three mode cards */}
    {[
      { x:20,  icon:'🚗', label:'Drive',  color:'#3b82f6', bg:'#dbeafe', active:true  },
      { x:115, icon:'🚲', label:'Bike',   color:'#22c55e', bg:'#dcfce7', active:false },
      { x:210, icon:'🚶', label:'Walk',   color:'#f97316', bg:'#ffedd5', active:false },
    ].map(({x, icon, label, color, bg, active}) => (
      <g key={label}>
        <rect x={x} y="10" width="85" height="100" rx="14" fill={active ? color : 'white'} stroke={active ? color : '#e2e8f0'} strokeWidth={active ? 0 : 1.5}/>
        <text x={x+42} y="55" fontSize="28" textAnchor="middle">{icon}</text>
        <text x={x+42} y="75" fontSize="10" textAnchor="middle" fill={active ? 'white' : '#374151'} fontWeight={active ? 'bold' : 'normal'}>{label}</text>
        {active && <rect x={x+22} y="84" width="41" height="16" rx="6" fill="white" opacity="0.25"/>}
        {active && <text x={x+42} y="95" fontSize="8" textAnchor="middle" fill="white">Selected</text>}
        {/* Route time */}
        <text x={x+42} y="105" fontSize="7.5" textAnchor="middle" fill={active ? '#bfdbfe' : '#94a3b8'}>
          {label==='Drive' ? '8 min' : label==='Bike' ? '22 min' : '45 min'}
        </text>
      </g>
    ))}
  </svg>
);

// Voice dictation
const SvgVoice = () => (
  <svg viewBox="0 0 300 160" className="w-full" style={{display:'block'}}>
    <rect width="300" height="160" fill="#fffbeb"/>
    {/* Form */}
    <rect x="20" y="10" width="260" height="140" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* Textarea */}
    <rect x="32" y="20" width="190" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
    <text x="42" y="38" fontSize="8.5" fill="#374151">Nice place</text>
    <text x="42" y="51" fontSize="8.5" fill="#f97316" fontStyle="italic">to rest…</text>
    <rect x="42" y="56" width="8" height="12" rx="2" fill="#3b82f6" opacity="0.7">
      <animate attributeName="opacity" values="0.7;0;0.7" dur="1s" repeatCount="indefinite"/>
    </rect>
    {/* Mic button highlighted */}
    <rect x="226" y="20" width="54" height="24" rx="8" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1.5"/>
    <circle cx="253" cy="32" r="5" fill="#f97316"/>
    <path d="M250 37 Q253 41 256 37" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="253" y1="41" x2="253" y2="44" stroke="#f97316" strokeWidth="1.5"/>
    <text x="262" y="36" fontSize="7" fill="#92400e">●REC</text>
    {/* Waveform */}
    <rect x="32" y="88" width="236" height="28" rx="8" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1"/>
    {[8,14,10,18,12,20,8,16,10,18,14,8,16,12,20,8,14,18,10,16,12,8,20,14,10,18].map((h,i) => (
      <rect key={i} x={40+i*8.5} y={95+(20-h)/2} width="5" height={h} rx="2.5" fill="#f97316" opacity="0.8"/>
    ))}
    <text x="150" y="126" fontSize="8" fill="#92400e" textAnchor="middle" fontWeight="bold">🎙 Listening… speak now</text>
    {/* Language badge */}
    <rect x="32" y="132" width="60" height="14" rx="5" fill="#dbeafe"/>
    <text x="62" y="142" fontSize="7.5" fill="#1d4ed8" textAnchor="middle">🌍 Auto-language</text>
    <text x="200" y="140" fontSize="7.5" fill="#64748b">Tap mic again to stop</text>
  </svg>
);

// Share button
const SvgShare = () => (
  <svg viewBox="0 0 300 180" className="w-full" style={{display:'block'}}>
    <rect width="300" height="180" fill="#fdf4ff"/>
    {/* Spot detail */}
    <rect x="20" y="10" width="260" height="80" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    <circle cx="44" cy="35" r="14" fill="#ede9fe"/>
    <path d="M40 35 Q42 31 44 29 Q46 31 48 35 Q46 39 44 41 Q42 39 40 35Z" fill="#7c3aed" opacity="0.8"/>
    <text x="64" y="32" fontSize="9" fill="#1e293b" fontWeight="bold">Hidden Waterfall</text>
    <text x="64" y="43" fontSize="7.5" fill="#94a3b8">⭐ 4.8 · 34 ratings</text>
    {/* Action buttons row */}
    <rect x="30" y="58" width="48" height="26" rx="8" fill="#f1f5f9"/>
    <text x="54" y="75" fontSize="8" fill="#374151" textAnchor="middle">✏️ Edit</text>
    <rect x="84" y="58" width="48" height="26" rx="8" fill="#fee2e2"/>
    <text x="108" y="75" fontSize="8" fill="#dc2626" textAnchor="middle">🗑 Del</text>
    {/* Share button highlighted */}
    <rect x="138" y="58" width="56" height="26" rx="8" fill="#7c3aed"/>
    <circle cx="142" cy="58" r="8" fill="#fbbf24" opacity="0"/>
    <text x="166" y="73" fontSize="8.5" fill="white" textAnchor="middle" fontWeight="bold">↑ Share</text>
    {/* Arrow pointing to share */}
    <path d="M166 88 L166 100" stroke="#7c3aed" strokeWidth="2" markerEnd="url(#purple)"/>
    <defs><marker id="purple" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#7c3aed"/></marker></defs>
    {/* Share result panel */}
    <rect x="20" y="104" width="260" height="66" rx="16" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
    <text x="40" y="120" fontSize="8.5" fill="#374151" fontWeight="bold">Link copied to clipboard!</text>
    <rect x="30" y="126" width="240" height="16" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
    <text x="40" y="138" fontSize="7" fill="#94a3b8">spotfinder.app/?spot=AbC123xYz</text>
    <text x="40" y="158" fontSize="7.5" fill="#64748b">📱 Share via WhatsApp, SMS, or paste anywhere</text>
    <text x="40" y="168" fontSize="7.5" fill="#22c55e">✓ Recipient opens map pinpointed to this spot</text>
  </svg>
);

// Map layers
const SvgMapLayers = () => (
  <svg viewBox="0 0 300 140" className="w-full" style={{display:'block'}}>
    <rect width="300" height="140" fill="#f0f9ff"/>
    {/* Layer cards */}
    {[
      { x:10,  fill:'#dbeafe', road:'#93c5fd', label:'Basic',     extra: null },
      { x:68,  fill:'#dcfce7', road:'#86efac', label:'Outdoor',   extra: null },
      { x:126, fill:'#1e3a5f', road:'#3b82f6', label:'Satellite', extra: null },
      { x:184, fill:'#e0f2fe', road:'#0ea5e9', label:'Winter',    extra: 'snow' },
      { x:242, fill:'#dbeafe', road:'#ef4444', label:'Traffic',   extra: 'traffic' },
    ].map(({x, fill, road, label, extra}) => (
      <g key={label}>
        <rect x={x} y="8" width="52" height="90" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
        <rect x={x+3} y="11" width="46" height="60" rx="7" fill={fill}/>
        {/* Roads */}
        <line x1={x+3} y1="41" x2={x+49} y2="41" stroke={road} strokeWidth="3"/>
        <line x1={x+26} y1="11" x2={x+26} y2="71" stroke={road} strokeWidth="3"/>
        {extra==='snow' && <>
          <text x={x+10} y="38" fontSize="9">❄</text>
          <text x={x+32} y="60" fontSize="9">❄</text>
        </>}
        {extra==='traffic' && <>
          <circle cx={x+14} cy="32" r="4" fill="#22c55e"/>
          <circle cx={x+26} cy="36" r="4" fill="#fbbf24"/>
          <circle cx={x+38} cy="32" r="4" fill="#ef4444"/>
          <circle cx={x+14} cy="55" r="4" fill="#22c55e"/>
          <circle cx={x+38} cy="55" r="4" fill="#22c55e"/>
        </>}
        <text x={x+26} y="82" fontSize="7.5" fill="#475569" textAnchor="middle">{label}</text>
      </g>
    ))}
    {/* Layers button */}
    <rect x="10" y="104" width="280" height="30" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
    <text x="35" y="123" fontSize="8.5" fill="#374151">Tap the</text>
    <rect x="80" y="111" width="52" height="18" rx="6" fill="#3b82f6"/>
    <rect x="84" y="117" width="10" height="2" rx="1" fill="white"/>
    <rect x="84" y="121" width="10" height="2" rx="1" fill="white"/>
    <rect x="84" y="125" width="10" height="2" rx="1" fill="white"/>
    <text x="104" y="123" fontSize="8" fill="white">Layers</text>
    <text x="140" y="123" fontSize="8.5" fill="#374151">button in the bottom-left corner</text>
  </svg>
);

// Traffic layer
const SvgTrafficLayer = () => (
  <svg viewBox="0 0 300 160" className="w-full" style={{display:'block'}}>
    <rect width="300" height="160" fill="#fff5f5"/>
    {/* Dark map background */}
    <rect x="10" y="10" width="180" height="140" rx="12" fill="#1e3a5f"/>
    {/* Roads */}
    <line x1="10" y1="80" x2="190" y2="80" stroke="#334155" strokeWidth="10"/>
    <line x1="100" y1="10" x2="100" y2="150" stroke="#334155" strokeWidth="10"/>
    {/* Traffic flow */}
    <line x1="10" y1="80" x2="60" y2="80" stroke="#22c55e" strokeWidth="6"/>
    <line x1="60" y1="80" x2="100" y2="80" stroke="#fbbf24" strokeWidth="6"/>
    <line x1="100" y1="80" x2="190" y2="80" stroke="#ef4444" strokeWidth="6"/>
    <line x1="100" y1="10" x2="100" y2="50" stroke="#22c55e" strokeWidth="6"/>
    <line x1="100" y1="50" x2="100" y2="80" stroke="#ef4444" strokeWidth="6"/>
    <line x1="100" y1="80" x2="100" y2="150" stroke="#22c55e" strokeWidth="6"/>
    {/* Road closure icon */}
    <circle cx="135" cy="45" r="11" fill="white"/>
    <circle cx="135" cy="45" r="10" fill="#CC1111"/>
    <rect x="127" y="42" width="16" height="6" rx="2" fill="white"/>
    {/* Jam icon */}
    <path d="M68 102 L82 102 L75 90 Z" fill="#FFD600" stroke="#CC6600" strokeWidth="1.5"/>
    <text x="75" y="100" fontSize="7" fill="#333" textAnchor="middle">!</text>
    {/* Legend */}
    <rect x="200" y="10" width="90" height="140" rx="12" fill="white" stroke="#fca5a5" strokeWidth="1.5"/>
    <text x="245" y="28" fontSize="8" fill="#374151" textAnchor="middle" fontWeight="bold">Legend</text>
    {[{col:'#22c55e',lbl:'Free flow'},{col:'#fbbf24',lbl:'Slow'},{col:'#ef4444',lbl:'Congested'}].map(({col,lbl},i)=>(
      <g key={lbl}>
        <rect x="210" y={38+i*22} width="14" height="10" rx="3" fill={col}/>
        <text x="230" y={47+i*22} fontSize="8" fill="#374151">{lbl}</text>
      </g>
    ))}
    <line x1="210" y1="108" x2="282" y2="108" stroke="#e2e8f0" strokeWidth="1"/>
    <text x="215" y="120" fontSize="8" fill="#374151">⛔ Closed</text>
    <text x="215" y="133" fontSize="8" fill="#374151">🚦 Jam</text>
    <text x="215" y="146" fontSize="7" fill="#94a3b8">Auto-detected</text>
  </svg>
);

// ─── All FAQ content, fully translated, with step-by-step guides ──────────────
const FAQ_CONTENT = {
  en: {
    sections: [
      {
        category: 'Getting Started',
        items: [
          {
            q: 'What is SpotFinder?',
            a: 'SpotFinder is a free community map app for discovering and sharing useful spots — parking areas, scenic viewpoints, rest stops, and more. Everyone can add spots, rate them, and navigate directly from the app — no account required.',
            steps: null
          },
          {
            q: 'Do I need an account?',
            a: 'No account needed! You can browse the map, add spots, and rate them as a guest. Creating an account (email or Google) lets you manage and track your own spots later.',
            steps: null
          },
        ]
      },
      {
        category: 'Adding Spots',
        items: [
          {
            q: 'How do I add a spot?',
            a: 'Follow these 5 steps:',
            steps: [
              { label: 'Tap the green + button at the bottom of the screen', svg: <SvgPlusButton /> },
              { label: 'The map enters "add mode" — tap anywhere to place your spot', svg: <SvgTapMap /> },
              { label: 'Fill in a description and set star ratings for Parking, Scenery, and Privacy', svg: <SvgFillForm /> },
              { label: 'Optionally add a photo by tapping the camera area', svg: <SvgAddPhoto /> },
              { label: 'Tap Save Spot — your spot immediately appears on the map for everyone', svg: <SvgSpotAppears /> },
            ]
          },
          {
            q: 'How do I use voice to write the description?',
            a: 'Tap the Voice button next to the description field. The mic listens in whichever language you have set in Settings (Czech, English, German, etc.). Your words appear live in the field. Tap again to stop.',
            steps: [
              { label: 'Tap the Voice / mic button next to the description field', svg: <SvgVoice /> },
            ]
          },
        ]
      },
      {
        category: 'Rating Spots',
        items: [
          {
            q: 'How do I rate a spot?',
            a: 'Anyone can rate — including guests. Tap a spot on the map, then tap the stars in the detail panel. There is an overall rating plus individual ratings for Parking, Beauty, and Privacy.',
            steps: [
              { label: 'Tap any spot marker to open its detail', svg: <SvgOpenDetail /> },
              { label: 'Tap the stars to leave your rating — no account required', svg: <SvgRateSpot /> },
            ]
          },
        ]
      },
      {
        category: 'Navigation',
        items: [
          {
            q: 'How do I navigate to a spot?',
            a: 'Open a spot\'s detail and tap Navigate Here. Choose your travel mode, then tap Start Navigation for turn-by-turn voice directions.',
            steps: [
              { label: 'Open any spot and tap the Navigate Here button', svg: <SvgOpenDetail /> },
              { label: 'Choose Drive, Bike, or Walk — then tap Start Navigation', svg: <SvgNavigate /> },
              { label: 'Switch between driving, cycling, and walking mode anytime', svg: <SvgRouteModes /> },
            ]
          },
          {
            q: 'Will it reroute if I go off-route?',
            a: 'Yes. If you go more than 80 m off the planned route, SpotFinder automatically recalculates from your current position and announces "Rerouting" in your language.',
            steps: null
          },
        ]
      },
      {
        category: 'Map & Traffic',
        items: [
          {
            q: 'How do I switch the map style?',
            a: 'Tap the Layers button in the bottom-left corner to choose between Basic, Outdoor, Satellite, Winter, or Traffic view.',
            steps: [
              { label: 'Tap the Layers button to open the style picker', svg: <SvgMapLayers /> },
            ]
          },
          {
            q: 'What does the Traffic layer show?',
            a: 'Real-time traffic flow (green = free, yellow = slow, red = heavy), plus road closure icons (⛔) and traffic jam icons (🚦) that appear automatically.',
            steps: [
              { label: 'Switch to Traffic view to see live road conditions', svg: <SvgTrafficLayer /> },
            ]
          },
        ]
      },
      {
        category: 'Sharing',
        items: [
          {
            q: 'How do I share a spot?',
            a: 'Open any spot detail and tap the Share button. On mobile the system share sheet opens. On desktop the link is copied. The recipient opens the map directly at that spot.',
            steps: [
              { label: 'Open a spot and tap the Share (↑) button', svg: <SvgShare /> },
            ]
          },
        ]
      },
    ],
    about: {
      title: 'About SpotFinder',
      desc: 'SpotFinder is a free, community-driven map app built to help people discover and share useful spots — from hidden parking to scenic viewpoints. Anyone can contribute.',
      features: ['Free to use — no subscription', 'Works as a guest — no account needed', 'Add, rate, navigate, and share spots', 'Voice dictation in 12 languages', 'Real-time traffic & road closure overlay', 'Turn-by-turn navigation for car, bike, and foot'],
      built: 'Built with React, Leaflet, Firebase, and OSRM.',
      version: 'Version 2.1',
    }
  },

  cs: {
    sections: [
      {
        category: 'Začínáme',
        items: [
          { q: 'Co je SpotFinder?', a: 'SpotFinder je bezplatná komunitní mapová aplikace pro sdílení užitečných míst — parkovišť, výhledů, odpočívadel a dalšího. Kdokoli může přidávat spoty, hodnotit je a navigovat — bez nutnosti registrace.', steps: null },
          { q: 'Potřebuji účet?', a: 'Nepotřebujete! Jako host můžete procházet mapu, přidávat spoty a hodnotit je. Účet (e-mail nebo Google) umožňuje spravovat vaše spoty.', steps: null },
        ]
      },
      {
        category: 'Přidávání spotů',
        items: [
          {
            q: 'Jak přidám spot?',
            a: 'Postupujte podle těchto 5 kroků:',
            steps: [
              { label: 'Klepněte na zelené tlačítko + dole na obrazovce', svg: <SvgPlusButton /> },
              { label: 'Mapa přejde do režimu přidávání — klepněte kdekoliv pro umístění spotu', svg: <SvgTapMap /> },
              { label: 'Vyplňte popis a nastavte hvězdičkové hodnocení parkování, krásy a soukromí', svg: <SvgFillForm /> },
              { label: 'Volitelně přidejte fotku klepnutím na oblast fotoaparátu', svg: <SvgAddPhoto /> },
              { label: 'Klepněte na Uložit spot — váš spot se okamžitě zobrazí na mapě', svg: <SvgSpotAppears /> },
            ]
          },
          {
            q: 'Jak použít hlas pro popis?',
            a: 'Klepněte na tlačítko Hlas vedle pole popisu. Mikrofon naslouchá v jazyce nastaveném v Nastavení. Vaše slova se živě zobrazují v poli. Klepněte znovu pro zastavení.',
            steps: [{ label: 'Klepněte na tlačítko hlasu vedle pole popisu', svg: <SvgVoice /> }]
          },
        ]
      },
      {
        category: 'Hodnocení spotů',
        items: [
          {
            q: 'Jak hodnotím spot?',
            a: 'Hodnotit může kdokoli — i hosté. Klepněte na spot na mapě, poté klepněte na hvězdičky v detailu. Můžete hodnotit celkově i jednotlivě (parkování, krása, soukromí).',
            steps: [
              { label: 'Klepněte na značku spotu pro otevření detailu', svg: <SvgOpenDetail /> },
              { label: 'Klepněte na hvězdičky — bez potřeby účtu', svg: <SvgRateSpot /> },
            ]
          },
        ]
      },
      {
        category: 'Navigace',
        items: [
          {
            q: 'Jak navigovat ke spotu?',
            a: 'Otevřete detail spotu a klepněte na Navigovat sem. Vyberte způsob dopravy a klepněte na Spustit navigaci pro hlasové pokyny.',
            steps: [
              { label: 'Otevřete spot a klepněte na tlačítko Navigovat sem', svg: <SvgOpenDetail /> },
              { label: 'Vyberte Auto, Kolo nebo Pěšky — pak klepněte na Spustit navigaci', svg: <SvgNavigate /> },
              { label: 'Kdykoli přepínejte mezi režimy dopravy', svg: <SvgRouteModes /> },
            ]
          },
          { q: 'Přepočítá trasu automaticky?', a: 'Ano. Odchýlíte-li se o více než 80 m, SpotFinder automaticky přepočítá z aktuální polohy a ohlásí "Přepočítávám trasu" ve vašem jazyce.', steps: null },
        ]
      },
      {
        category: 'Mapa a doprava',
        items: [
          {
            q: 'Jak přepnu styl mapy?',
            a: 'Klepněte na tlačítko Vrstvy v levém dolním rohu pro výběr ze stylů Základní, Venkovní, Satelit, Zimní nebo Doprava.',
            steps: [{ label: 'Klepněte na tlačítko Vrstvy pro výběr stylu', svg: <SvgMapLayers /> }]
          },
          {
            q: 'Co zobrazuje vrstva Doprava?',
            a: 'Provoz v reálném čase (zelená = volno, žlutá = pomalu, červená = zácpa) plus ikony uzavírek (⛔) a kolon (🚦), které se zobrazují automaticky.',
            steps: [{ label: 'Přepněte na vrstvu Doprava pro zobrazení aktuálního provozu', svg: <SvgTrafficLayer /> }]
          },
        ]
      },
      {
        category: 'Sdílení',
        items: [
          {
            q: 'Jak sdílet spot?',
            a: 'Otevřete detail spotu a klepněte na Sdílet. Na mobilu se otevře nativní sdílení, na desktopu se zkopíruje odkaz. Příjemce otevře mapu přímo na daném spotu.',
            steps: [{ label: 'Otevřete spot a klepněte na tlačítko Sdílet (↑)', svg: <SvgShare /> }]
          },
        ]
      },
    ],
    about: {
      title: 'O SpotFinderu',
      desc: 'SpotFinder je bezplatná komunitní mapová aplikace, která pomáhá lidem objevovat a sdílet užitečná místa — od skrytých parkovišť po malebné výhledy. Přispět může kdokoli.',
      features: ['Zdarma — žádné předplatné', 'Funguje jako host — bez účtu', 'Přidávání, hodnocení, navigace a sdílení spotů', 'Hlasové diktování ve 12 jazycích', 'Přehled dopravy a uzavírek v reálném čase', 'Navigace hlasovými pokyny pro auto, kolo i pěšky'],
      built: 'Postaveno na React, Leaflet, Firebase a OSRM.',
      version: 'Verze 2.1',
    }
  },

  de: {
    sections: [
      {
        category: 'Erste Schritte',
        items: [
          { q: 'Was ist SpotFinder?', a: 'SpotFinder ist eine kostenlose Community-Karten-App zum Entdecken nützlicher Spots — Parkplätze, Aussichtspunkte, Rastplätze und mehr. Jeder kann Spots hinzufügen, bewerten und direkt navigieren — ohne Konto.', steps: null },
          { q: 'Benötige ich ein Konto?', a: 'Nein! Als Gast können Sie die Karte durchsuchen, Spots hinzufügen und bewerten. Ein Konto ermöglicht die Verwaltung Ihrer eigenen Spots.', steps: null },
        ]
      },
      {
        category: 'Spots hinzufügen',
        items: [
          {
            q: 'Wie füge ich einen Spot hinzu?',
            a: 'Folgen Sie diesen 5 Schritten:',
            steps: [
              { label: 'Tippen Sie auf die grüne +-Schaltfläche am unteren Bildschirmrand', svg: <SvgPlusButton /> },
              { label: 'Die Karte wechselt in den Hinzufüge-Modus — tippen Sie irgendwo auf die Karte', svg: <SvgTapMap /> },
              { label: 'Füllen Sie Beschreibung und Sternebewertungen für Parken, Landschaft und Privatsphäre aus', svg: <SvgFillForm /> },
              { label: 'Optional: Tippen Sie auf den Kamerabereich, um ein Foto hinzuzufügen', svg: <SvgAddPhoto /> },
              { label: 'Tippen Sie auf Spot speichern — Ihr Spot erscheint sofort auf der Karte', svg: <SvgSpotAppears /> },
            ]
          },
          {
            q: 'Wie nutze ich die Spracheingabe?',
            a: 'Tippen Sie auf die Sprach-Schaltfläche neben dem Beschreibungsfeld. Das Mikrofon hört in der in den Einstellungen gewählten Sprache zu. Ihre Worte erscheinen live im Feld.',
            steps: [{ label: 'Tippen Sie auf die Sprach-Schaltfläche neben dem Beschreibungsfeld', svg: <SvgVoice /> }]
          },
        ]
      },
      {
        category: 'Spots bewerten',
        items: [
          {
            q: 'Wie bewerte ich einen Spot?',
            a: 'Jeder kann bewerten — auch Gäste. Tippen Sie auf einen Spot, dann auf die Sterne im Detailbereich.',
            steps: [
              { label: 'Tippen Sie auf einen Spot-Marker, um das Detail zu öffnen', svg: <SvgOpenDetail /> },
              { label: 'Tippen Sie auf die Sterne — kein Konto erforderlich', svg: <SvgRateSpot /> },
            ]
          },
        ]
      },
      {
        category: 'Navigation',
        items: [
          {
            q: 'Wie navigiere ich zu einem Spot?',
            a: 'Öffnen Sie das Detail eines Spots und tippen Sie auf Hierher navigieren. Wählen Sie den Fahrmodus und starten Sie die Navigation.',
            steps: [
              { label: 'Öffnen Sie einen Spot und tippen Sie auf Hierher navigieren', svg: <SvgOpenDetail /> },
              { label: 'Wählen Sie Auto, Fahrrad oder Zu Fuß — dann Navigation starten', svg: <SvgNavigate /> },
              { label: 'Wechseln Sie jederzeit den Fahrmodus', svg: <SvgRouteModes /> },
            ]
          },
          { q: 'Berechnet es die Route neu?', a: 'Ja. Bei mehr als 80 m Abweichung berechnet SpotFinder automatisch neu und kündigt „Umleitung" in Ihrer Sprache an.', steps: null },
        ]
      },
      {
        category: 'Karte & Verkehr',
        items: [
          {
            q: 'Wie wechsle ich den Kartenstil?',
            a: 'Tippen Sie auf die Ebenen-Schaltfläche unten links, um zwischen Grundkarte, Outdoor, Satellit, Winter und Verkehr zu wählen.',
            steps: [{ label: 'Tippen Sie auf die Ebenen-Schaltfläche für den Stilwechsel', svg: <SvgMapLayers /> }]
          },
          {
            q: 'Was zeigt die Verkehrsebene?',
            a: 'Echtzeit-Verkehrsfluss (grün = frei, gelb = langsam, rot = Stau) plus Sperr-Icons (⛔) und Stau-Icons (🚦) automatisch.',
            steps: [{ label: 'Wechseln Sie zur Verkehrsebene für Live-Straßenbedingungen', svg: <SvgTrafficLayer /> }]
          },
        ]
      },
      {
        category: 'Teilen',
        items: [
          {
            q: 'Wie teile ich einen Spot?',
            a: 'Öffnen Sie das Spot-Detail und tippen Sie auf Teilen. Auf dem Handy öffnet sich das native Teilen-Menü, am Desktop wird der Link kopiert.',
            steps: [{ label: 'Öffnen Sie einen Spot und tippen Sie auf Teilen (↑)', svg: <SvgShare /> }]
          },
        ]
      },
    ],
    about: {
      title: 'Über SpotFinder',
      desc: 'SpotFinder ist eine kostenlose Community-App zum Entdecken nützlicher Orte — von versteckten Parkplätzen bis zu malerischen Aussichtspunkten. Jeder kann beitragen.',
      features: ['Kostenlos — kein Abo', 'Als Gast nutzbar — kein Konto nötig', 'Spots hinzufügen, bewerten, navigieren und teilen', 'Spracheingabe in 12 Sprachen', 'Echtzeit-Verkehr & Straßensperren', 'Abbieg-Navigationsansagen für Auto, Fahrrad, Fußgänger'],
      built: 'Entwickelt mit React, Leaflet, Firebase und OSRM.',
      version: 'Version 2.1',
    }
  },

  pl: {
    sections: [
      { category: 'Pierwsze kroki', items: [
        { q: 'Czym jest SpotFinder?', a: 'SpotFinder to bezpłatna aplikacja mapowa do odkrywania i udostępniania miejsc — parkingów, widoków, miejsc odpoczynku i nie tylko. Każdy może dodawać spoty bez konta.', steps: null },
        { q: 'Czy potrzebuję konta?', a: 'Nie! Jako gość możesz przeglądać mapę, dodawać spoty i je oceniać. Konto pozwala zarządzać swoimi spotami.', steps: null },
      ]},
      { category: 'Dodawanie spotów', items: [
        { q: 'Jak dodać spot?', a: 'Wykonaj 5 kroków:', steps: [
          { label: 'Naciśnij zielony przycisk + na dole ekranu', svg: <SvgPlusButton /> },
          { label: 'Mapa przechodzi w tryb dodawania — dotknij dowolnego miejsca na mapie', svg: <SvgTapMap /> },
          { label: 'Wypełnij opis i ustaw oceny gwiazdkowe dla Parkingu, Scenerii i Prywatności', svg: <SvgFillForm /> },
          { label: 'Opcjonalnie dodaj zdjęcie, dotykając obszaru aparatu', svg: <SvgAddPhoto /> },
          { label: 'Naciśnij Zapisz spot — spot natychmiast pojawia się na mapie', svg: <SvgSpotAppears /> },
        ]},
        { q: 'Jak korzystać z dyktowania głosowego?', a: 'Naciśnij przycisk Głos obok pola opisu. Mikrofon słucha w języku ustawionym w Ustawieniach. Słowa pojawiają się na bieżąco.', steps: [{ label: 'Naciśnij przycisk głosu obok pola opisu', svg: <SvgVoice /> }]},
      ]},
      { category: 'Ocenianie spotów', items: [
        { q: 'Jak ocenić spot?', a: 'Każdy może oceniać — w tym goście. Dotknij spotu, potem gwiazdek w panelu szczegółów.', steps: [
          { label: 'Dotknij znacznika spotu, aby otworzyć szczegóły', svg: <SvgOpenDetail /> },
          { label: 'Dotknij gwiazdek — konto nie jest wymagane', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Nawigacja', items: [
        { q: 'Jak nawigować do spotu?', a: 'Otwórz szczegóły spotu i naciśnij Nawiguj tutaj. Wybierz tryb podróży i uruchom nawigację.', steps: [
          { label: 'Otwórz spot i naciśnij Nawiguj tutaj', svg: <SvgOpenDetail /> },
          { label: 'Wybierz Samochód, Rower lub Pieszo — potem Rozpocznij nawigację', svg: <SvgNavigate /> },
          { label: 'Zmieniaj tryb transportu w dowolnym momencie', svg: <SvgRouteModes /> },
        ]},
        { q: 'Czy trasa jest przeliczana automatycznie?', a: 'Tak. Przy odchyleniu ponad 80 m SpotFinder automatycznie przelicza trasę i ogłasza "Przeliczam trasę" w Twoim języku.', steps: null },
      ]},
      { category: 'Udostępnianie', items: [
        { q: 'Jak udostępnić spot?', a: 'Otwórz szczegóły spotu i naciśnij Udostępnij. Na telefonie otwiera się natywne menu udostępniania, na komputerze kopiowany jest link.', steps: [{ label: 'Otwórz spot i naciśnij Udostępnij (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'O SpotFinderze', desc: 'SpotFinder to bezpłatna aplikacja mapowa do odkrywania miejsc — od ukrytych parkingów po malownicze widoki. Każdy może dodawać spoty bez konta.', features: ['Bezpłatna — bez subskrypcji', 'Działa jako gość — bez konta', 'Dodaj, oceń, nawiguj i udostępnij spoty', 'Dyktowanie głosowe w 12 językach', 'Ruch drogowy i zamknięcia dróg w czasie rzeczywistym', 'Nawigacja głosowa dla samochodu, roweru i pieszych'], built: 'Zbudowany z React, Leaflet, Firebase i OSRM.', version: 'Wersja 2.1' }
  },

  sk: {
    sections: [
      { category: 'Začíname', items: [
        { q: 'Čo je SpotFinder?', a: 'SpotFinder je bezplatná komunitná mapová aplikácia na zdieľanie zaujímavých miest — parkovísk, výhľadov, oddychových miest a ďalšieho. Každý môže pridávať spoty bez účtu.', steps: null },
        { q: 'Potrebujem účet?', a: 'Nie! Ako hosť môžete prezerať mapu, pridávať spoty a hodnotiť ich. Účet umožňuje spravovať vaše spoty.', steps: null },
      ]},
      { category: 'Pridávanie spotov', items: [
        { q: 'Ako pridám spot?', a: 'Postupujte podľa 5 krokov:', steps: [
          { label: 'Klepnite na zelené tlačidlo + dole na obrazovke', svg: <SvgPlusButton /> },
          { label: 'Mapa prejde do režimu pridávania — klepnite kdekoľvek na mapu', svg: <SvgTapMap /> },
          { label: 'Vyplňte popis a hodnotenia parkovania, krásy a súkromia', svg: <SvgFillForm /> },
          { label: 'Voliteľne pridajte fotku klepnutím na oblasť fotoaparátu', svg: <SvgAddPhoto /> },
          { label: 'Klepnite na Uložiť spot — okamžite sa zobrazí na mape', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Hodnotenie spotov', items: [
        { q: 'Ako hodnotím spot?', a: 'Hodnotiť môže kdokoľvek — aj hostia. Klepnite na spot a potom na hviezdy v detaile.', steps: [
          { label: 'Klepnite na značku spotu pre otvorenie detailu', svg: <SvgOpenDetail /> },
          { label: 'Klepnite na hviezdy — bez potreby účtu', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Navigácia', items: [
        { q: 'Ako navigovať k spotu?', a: 'Otvorte detail spotu a klepnite na Navigovať sem. Vyberte spôsob dopravy a spustite navigáciu.', steps: [
          { label: 'Otvorte spot a klepnite na Navigovať sem', svg: <SvgOpenDetail /> },
          { label: 'Vyberte Auto, Bicykel alebo Pešo — potom Spustiť navigáciu', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Zdieľanie', items: [
        { q: 'Ako zdieľam spot?', a: 'Otvorte detail spotu a klepnite na Zdieľať. Na mobile sa otvorí natívne zdieľanie, na počítači sa skopíruje odkaz.', steps: [{ label: 'Otvorte spot a klepnite na Zdieľať (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'O SpotFinderi', desc: 'SpotFinder je bezplatná komunitná aplikácia na objavovanie miest — od skrytých parkovísk po malebné výhľady. Každý môže pridávať spoty bez účtu.', features: ['Zadarmo — bez predplatného', 'Funguje ako hosť — bez účtu', 'Pridávanie, hodnotenie, navigácia a zdieľanie spotov', 'Hlasové diktovanie v 12 jazykoch', 'Doprava a uzávierky ciest v reálnom čase', 'Hlasová navigácia pre auto, bicykel a pešo'], built: 'Postavené na React, Leaflet, Firebase a OSRM.', version: 'Verzia 2.1' }
  },

  fr: {
    sections: [
      { category: 'Premiers pas', items: [
        { q: 'Qu\'est-ce que SpotFinder ?', a: 'SpotFinder est une application de carte communautaire gratuite pour découvrir des spots utiles — parkings, points de vue, aires de repos et plus. Tout le monde peut ajouter des spots sans compte.', steps: null },
        { q: 'Ai-je besoin d\'un compte ?', a: 'Non ! En tant qu\'invité, vous pouvez parcourir la carte, ajouter des spots et les noter. Un compte permet de gérer vos spots.', steps: null },
      ]},
      { category: 'Ajouter des spots', items: [
        { q: 'Comment ajouter un spot ?', a: 'Suivez ces 5 étapes :', steps: [
          { label: 'Appuyez sur le bouton vert + en bas de l\'écran', svg: <SvgPlusButton /> },
          { label: 'La carte passe en mode ajout — appuyez n\'importe où sur la carte', svg: <SvgTapMap /> },
          { label: 'Remplissez la description et les étoiles pour Stationnement, Paysage et Confidentialité', svg: <SvgFillForm /> },
          { label: 'Ajoutez optionnellement une photo en appuyant sur la zone appareil photo', svg: <SvgAddPhoto /> },
          { label: 'Appuyez sur Enregistrer le spot — il apparaît immédiatement sur la carte', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Noter des spots', items: [
        { q: 'Comment noter un spot ?', a: 'Tout le monde peut noter — même les invités. Appuyez sur un spot, puis sur les étoiles dans le panneau de détail.', steps: [
          { label: 'Appuyez sur un marqueur de spot pour ouvrir le détail', svg: <SvgOpenDetail /> },
          { label: 'Appuyez sur les étoiles — aucun compte requis', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Navigation', items: [
        { q: 'Comment naviguer vers un spot ?', a: 'Ouvrez le détail d\'un spot et appuyez sur Naviguer ici. Choisissez votre mode de déplacement et démarrez la navigation.', steps: [
          { label: 'Ouvrez un spot et appuyez sur Naviguer ici', svg: <SvgOpenDetail /> },
          { label: 'Choisissez Voiture, Vélo ou À pied — puis Démarrer la navigation', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Partage', items: [
        { q: 'Comment partager un spot ?', a: 'Ouvrez le détail d\'un spot et appuyez sur Partager. Sur mobile le menu natif s\'ouvre, sur ordinateur le lien est copié.', steps: [{ label: 'Ouvrez un spot et appuyez sur Partager (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'À propos de SpotFinder', desc: 'SpotFinder est une application de carte communautaire gratuite pour découvrir des endroits utiles — des parkings cachés aux points de vue panoramiques. Tout le monde peut contribuer.', features: ['Gratuit — sans abonnement', 'Utilisable en tant qu\'invité — sans compte', 'Ajouter, noter, naviguer et partager des spots', 'Dictée vocale en 12 langues', 'Trafic en temps réel et fermetures de routes', 'Navigation vocale pour voiture, vélo et piétons'], built: 'Développé avec React, Leaflet, Firebase et OSRM.', version: 'Version 2.1' }
  },

  it: {
    sections: [
      { category: 'Per iniziare', items: [
        { q: 'Cos\'è SpotFinder?', a: 'SpotFinder è un\'app di mappe comunitaria gratuita per scoprire e condividere spot utili — parcheggi, panorami, aree di sosta e altro. Chiunque può aggiungere spot senza account.', steps: null },
        { q: 'Ho bisogno di un account?', a: 'No! Come ospite puoi sfogliare la mappa, aggiungere spot e valutarli. Un account permette di gestire i tuoi spot.', steps: null },
      ]},
      { category: 'Aggiungere spot', items: [
        { q: 'Come aggiungo uno spot?', a: 'Segui questi 5 passaggi:', steps: [
          { label: 'Tocca il pulsante verde + in basso sullo schermo', svg: <SvgPlusButton /> },
          { label: 'La mappa entra in modalità aggiunta — tocca qualsiasi punto della mappa', svg: <SvgTapMap /> },
          { label: 'Compila la descrizione e le stelle per Parcheggio, Paesaggio e Privacy', svg: <SvgFillForm /> },
          { label: 'Aggiungi opzionalmente una foto toccando l\'area fotocamera', svg: <SvgAddPhoto /> },
          { label: 'Tocca Salva spot — appare immediatamente sulla mappa', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Valutare spot', items: [
        { q: 'Come valuto uno spot?', a: 'Chiunque può valutare — anche gli ospiti. Tocca uno spot, poi tocca le stelle nel pannello dei dettagli.', steps: [
          { label: 'Tocca un marcatore spot per aprire i dettagli', svg: <SvgOpenDetail /> },
          { label: 'Tocca le stelle — nessun account richiesto', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Navigazione', items: [
        { q: 'Come navigo verso uno spot?', a: 'Apri il dettaglio di uno spot e tocca Naviga qui. Scegli la modalità di trasporto e avvia la navigazione.', steps: [
          { label: 'Apri uno spot e tocca Naviga qui', svg: <SvgOpenDetail /> },
          { label: 'Scegli Auto, Bici o A piedi — poi Avvia navigazione', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Condivisione', items: [
        { q: 'Come condivido uno spot?', a: 'Apri il dettaglio di uno spot e tocca Condividi. Su mobile si apre il menu nativo, su desktop viene copiato un link.', steps: [{ label: 'Apri uno spot e tocca Condividi (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'Informazioni su SpotFinder', desc: 'SpotFinder è un\'app di mappe comunitaria gratuita per scoprire posti utili — dai parcheggi nascosti ai panorami mozzafiato. Tutti possono contribuire.', features: ['Gratuita — nessun abbonamento', 'Utilizzabile come ospite — senza account', 'Aggiungi, valuta, naviga e condividi spot', 'Dettatura vocale in 12 lingue', 'Traffico e chiusure stradali in tempo reale', 'Navigazione vocale per auto, bici e pedoni'], built: 'Sviluppato con React, Leaflet, Firebase e OSRM.', version: 'Versione 2.1' }
  },

  ru: {
    sections: [
      { category: 'Начало работы', items: [
        { q: 'Что такое SpotFinder?', a: 'SpotFinder — бесплатное сообщество карт для открытия полезных мест — парковок, смотровых площадок, мест отдыха и многого другого. Каждый может добавлять споты без регистрации.', steps: null },
        { q: 'Нужна ли мне учётная запись?', a: 'Нет! Как гость вы можете просматривать карту, добавлять споты и оценивать их. Аккаунт позволяет управлять своими спотами.', steps: null },
      ]},
      { category: 'Добавление спотов', items: [
        { q: 'Как добавить спот?', a: 'Следуйте 5 шагам:', steps: [
          { label: 'Нажмите зелёную кнопку + внизу экрана', svg: <SvgPlusButton /> },
          { label: 'Карта переходит в режим добавления — нажмите в любом месте', svg: <SvgTapMap /> },
          { label: 'Заполните описание и выставьте звёзды за Парковку, Красоту и Приватность', svg: <SvgFillForm /> },
          { label: 'Опционально добавьте фото, нажав на область камеры', svg: <SvgAddPhoto /> },
          { label: 'Нажмите Сохранить спот — он сразу появится на карте', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Оценка спотов', items: [
        { q: 'Как оценить спот?', a: 'Оценивать может любой — включая гостей. Нажмите на спот, затем на звёзды в панели деталей.', steps: [
          { label: 'Нажмите на маркер спота, чтобы открыть подробности', svg: <SvgOpenDetail /> },
          { label: 'Нажмите на звёзды — без регистрации', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Навигация', items: [
        { q: 'Как навигировать к споту?', a: 'Откройте подробности спота и нажмите Навигация сюда. Выберите режим транспорта и начните навигацию.', steps: [
          { label: 'Откройте спот и нажмите Навигация сюда', svg: <SvgOpenDetail /> },
          { label: 'Выберите Авто, Велосипед или Пешком — затем Начать навигацию', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Совместный доступ', items: [
        { q: 'Как поделиться спотом?', a: 'Откройте подробности спота и нажмите Поделиться. На мобильном откроется нативное меню, на десктопе скопируется ссылка.', steps: [{ label: 'Откройте спот и нажмите Поделиться (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'О SpotFinder', desc: 'SpotFinder — бесплатное приложение-карта для открытия мест — от скрытых парковок до живописных площадок. Каждый может вносить вклад.', features: ['Бесплатно — без подписки', 'Работает как гость — без аккаунта', 'Добавляйте, оценивайте, навигируйте и делитесь спотами', 'Голосовое дiktоvание на 12 языках', 'Пробки и перекрытия дорог в реальном времени', 'Голосовая навигация для авто, велосипеда и пешеходов'], built: 'Создано на React, Leaflet, Firebase и OSRM.', version: 'Версия 2.1' }
  },

  uk: {
    sections: [
      { category: 'Початок роботи', items: [
        { q: 'Що таке SpotFinder?', a: 'SpotFinder — безкоштовний спільнотний картографічний застосунок для відкриття корисних місць — паркінгів, видових майданчиків, місць відпочинку та іншого. Кожен може додавати споти без реєстрації.', steps: null },
        { q: 'Чи потрібен мені обліковий запис?', a: 'Ні! Як гість ви можете переглядати карту, додавати споти та оцінювати їх. Акаунт дозволяє керувати своїми спотами.', steps: null },
      ]},
      { category: 'Додавання спотів', items: [
        { q: 'Як додати спот?', a: 'Виконайте 5 кроків:', steps: [
          { label: 'Натисніть зелену кнопку + внизу екрана', svg: <SvgPlusButton /> },
          { label: 'Карта переходить у режим додавання — натисніть будь-де на карті', svg: <SvgTapMap /> },
          { label: 'Заповніть опис і встановіть зірки за Паркінг, Красу та Приватність', svg: <SvgFillForm /> },
          { label: 'За бажанням додайте фото, натиснувши на область камери', svg: <SvgAddPhoto /> },
          { label: 'Натисніть Зберегти спот — він одразу з\'явиться на карті', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Оцінка спотів', items: [
        { q: 'Як оцінити спот?', a: 'Оцінювати може будь-хто — включно з гостями. Натисніть на спот, потім на зірки в панелі деталей.', steps: [
          { label: 'Натисніть на маркер спота, щоб відкрити подробиці', svg: <SvgOpenDetail /> },
          { label: 'Натисніть на зірки — без реєстрації', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Навігація', items: [
        { q: 'Як навігувати до спота?', a: 'Відкрийте подробиці спота і натисніть Навігація сюди. Виберіть режим транспорту і розпочніть навігацію.', steps: [
          { label: 'Відкрийте спот і натисніть Навігація сюди', svg: <SvgOpenDetail /> },
          { label: 'Виберіть Авто, Велосипед або Пішки — потім Розпочати навігацію', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Поширення', items: [
        { q: 'Як поділитися спотом?', a: 'Відкрийте подробиці спота і натисніть Поділитися. На мобільному відкриється нативне меню, на десктопі скопіюється посилання.', steps: [{ label: 'Відкрийте спот і натисніть Поділитися (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'Про SpotFinder', desc: 'SpotFinder — безкоштовний застосунок-карта для відкриття місць — від прихованих паркінгів до мальовничих майданчиків. Кожен може додавати споти.', features: ['Безкоштовно — без підписки', 'Працює як гість — без акаунта', 'Додавайте, оцінюйте, навігуйте та діліться спотами', 'Голосове диктування 12 мовами', 'Пробки та перекриття доріг у реальному часі', 'Голосова навігація для авто, велосипеда та пішоходів'], built: 'Створено на React, Leaflet, Firebase та OSRM.', version: 'Версія 2.1' }
  },

  hu: {
    sections: [
      { category: 'Első lépések', items: [
        { q: 'Mi az a SpotFinder?', a: 'A SpotFinder egy ingyenes közösségi térképalkalmazás hasznos helyek felfedezéséhez — parkolók, kilátópontok, pihenőhelyek és egyebek. Mindenki hozzáadhat spotokat regisztráció nélkül.', steps: null },
        { q: 'Szükségem van fiókra?', a: 'Nem! Vendégként böngészheted a térképet, hozzáadhatsz spotokat és értékelheted őket. Fiók lehetővé teszi saját spotjaid kezelését.', steps: null },
      ]},
      { category: 'Spot hozzáadása', items: [
        { q: 'Hogyan adok hozzá egy spotot?', a: 'Kövesd ezt az 5 lépést:', steps: [
          { label: 'Koppints a zöld + gombra a képernyő alján', svg: <SvgPlusButton /> },
          { label: 'A térkép hozzáadási módba vált — koppints bárhol a térképen', svg: <SvgTapMap /> },
          { label: 'Töltsd ki a leírást és állítsd be a csillagokat Parkolás, Szépség és Magánszféra szerint', svg: <SvgFillForm /> },
          { label: 'Opcionálisan adj hozzá fotót a kamera területre koppintva', svg: <SvgAddPhoto /> },
          { label: 'Koppints a Spot mentése gombra — azonnal megjelenik a térképen', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Spotok értékelése', items: [
        { q: 'Hogyan értékelek egy spotot?', a: 'Bárki értékelhet — vendégek is. Koppints egy spotra, majd a csillagokra a részletek panelben.', steps: [
          { label: 'Koppints egy spot jelölőre a részletek megnyitásához', svg: <SvgOpenDetail /> },
          { label: 'Koppints a csillagokra — fiók nem szükséges', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Navigáció', items: [
        { q: 'Hogyan navigálok egy spothoz?', a: 'Nyisd meg egy spot részleteit és koppints az Ide navigálás gombra. Válassz közlekedési módot és indítsd el a navigációt.', steps: [
          { label: 'Nyisd meg a spotot és koppints az Ide navigálás gombra', svg: <SvgOpenDetail /> },
          { label: 'Válassz Autó, Kerékpár vagy Gyalog módot — majd Navigáció indítása', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Megosztás', items: [
        { q: 'Hogyan osztok meg egy spotot?', a: 'Nyisd meg egy spot részleteit és koppints a Megosztás gombra. Mobilon a natív menü nyílik meg, asztali gépen a link másolódik.', steps: [{ label: 'Nyisd meg a spotot és koppints a Megosztás (↑) gombra', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'A SpotFinderről', desc: 'A SpotFinder egy ingyenes közösségi térképalkalmazás hasznos helyek felfedezéséhez — rejtett parkolóktól festői kilátópontokig. Mindenki hozzájárulhat.', features: ['Ingyenes — nincs előfizetés', 'Vendégként használható — fiók nélkül', 'Spotok hozzáadása, értékelése, navigálása és megosztása', 'Hangbevitel 12 nyelven', 'Valós idejű forgalom és útlezárások', 'Hangos navigáció autóhoz, kerékpárhoz és gyalogosokhoz'], built: 'Fejlesztve React, Leaflet, Firebase és OSRM alapokon.', version: '2.1-es verzió' }
  },

  ro: {
    sections: [
      { category: 'Noțiuni de bază', items: [
        { q: 'Ce este SpotFinder?', a: 'SpotFinder este o aplicație de hartă comunitară gratuită pentru descoperirea locurilor utile — parcări, priveliști, locuri de odihnă și altele. Oricine poate adăuga spoturi fără cont.', steps: null },
        { q: 'Am nevoie de un cont?', a: 'Nu! Ca vizitator poți naviga pe hartă, adăuga spoturi și le poți evalua. Un cont permite gestionarea spoturilor tale.', steps: null },
      ]},
      { category: 'Adăugarea spoturilor', items: [
        { q: 'Cum adaug un spot?', a: 'Urmează acești 5 pași:', steps: [
          { label: 'Atinge butonul verde + din josul ecranului', svg: <SvgPlusButton /> },
          { label: 'Harta intră în modul de adăugare — atinge oriunde pe hartă', svg: <SvgTapMap /> },
          { label: 'Completează descrierea și stele pentru Parcare, Peisaj și Intimitate', svg: <SvgFillForm /> },
          { label: 'Opțional adaugă o fotografie atingând zona camerei', svg: <SvgAddPhoto /> },
          { label: 'Atinge Salvează spot — apare imediat pe hartă', svg: <SvgSpotAppears /> },
        ]},
      ]},
      { category: 'Evaluarea spoturilor', items: [
        { q: 'Cum evaluez un spot?', a: 'Oricine poate evalua — inclusiv vizitatorii. Atinge un spot, apoi stelele din panoul de detalii.', steps: [
          { label: 'Atinge un marker de spot pentru a deschide detaliile', svg: <SvgOpenDetail /> },
          { label: 'Atinge stelele — cont neobligatoriu', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Navigare', items: [
        { q: 'Cum navighez la un spot?', a: 'Deschide detaliile unui spot și atinge Navighează aici. Alege modul de transport și pornește navigarea.', steps: [
          { label: 'Deschide un spot și atinge Navighează aici', svg: <SvgOpenDetail /> },
          { label: 'Alege Mașină, Bicicletă sau Pe jos — apoi Pornire navigare', svg: <SvgNavigate /> },
        ]},
      ]},
      { category: 'Partajare', items: [
        { q: 'Cum partajez un spot?', a: 'Deschide detaliile unui spot și atinge Distribuie. Pe mobil se deschide meniul nativ, pe desktop se copiază linkul.', steps: [{ label: 'Deschide un spot și atinge Distribuie (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'Despre SpotFinder', desc: 'SpotFinder este o aplicație de hartă comunitară gratuită pentru descoperirea locurilor utile — de la parcări ascunse la priveliști panoramice. Oricine poate contribui.', features: ['Gratuit — fără abonament', 'Utilizabil ca vizitator — fără cont', 'Adaugă, evaluează, navighează și distribuie spoturi', 'Dictare vocală în 12 limbi', 'Trafic și închideri de drumuri în timp real', 'Navigare vocală pentru mașină, bicicletă și pietoni'], built: 'Construit cu React, Leaflet, Firebase și OSRM.', version: 'Versiunea 2.1' }
  },

  es: {
    sections: [
      { category: 'Primeros pasos', items: [
        { q: '¿Qué es SpotFinder?', a: 'SpotFinder es una app de mapas comunitaria gratuita para descubrir lugares útiles — aparcamientos, miradores, áreas de descanso y más. Cualquiera puede añadir spots sin cuenta.', steps: null },
        { q: '¿Necesito una cuenta?', a: '¡No! Como invitado puedes explorar el mapa, añadir spots y valorarlos. Una cuenta permite gestionar tus spots.', steps: null },
      ]},
      { category: 'Añadir spots', items: [
        { q: '¿Cómo añado un spot?', a: 'Sigue estos 5 pasos:', steps: [
          { label: 'Toca el botón verde + en la parte inferior de la pantalla', svg: <SvgPlusButton /> },
          { label: 'El mapa entra en modo añadir — toca cualquier lugar del mapa', svg: <SvgTapMap /> },
          { label: 'Rellena la descripción y las estrellas de Aparcamiento, Paisaje y Privacidad', svg: <SvgFillForm /> },
          { label: 'Opcionalmente añade una foto tocando el área de la cámara', svg: <SvgAddPhoto /> },
          { label: 'Toca Guardar spot — aparece inmediatamente en el mapa para todos', svg: <SvgSpotAppears /> },
        ]},
        { q: '¿Puedo usar voz para la descripción?', a: 'Sí. Toca el botón Voz junto al campo de descripción. El micrófono escucha en el idioma configurado en Ajustes. Toca de nuevo para detener.', steps: [{ label: 'Toca el botón Voz junto al campo de descripción', svg: <SvgVoice /> }]},
      ]},
      { category: 'Valorar spots', items: [
        { q: '¿Cómo valoro un spot?', a: 'Cualquiera puede valorar — incluso invitados. Toca un spot, luego las estrellas en el panel de detalles.', steps: [
          { label: 'Toca un marcador de spot para abrir los detalles', svg: <SvgOpenDetail /> },
          { label: 'Toca las estrellas — no se requiere cuenta', svg: <SvgRateSpot /> },
        ]},
      ]},
      { category: 'Navegación', items: [
        { q: '¿Cómo navego a un spot?', a: 'Abre el detalle de un spot y toca Navegar aquí. Elige el modo de desplazamiento y toca Iniciar navegación.', steps: [
          { label: 'Abre un spot y toca Navegar aquí', svg: <SvgOpenDetail /> },
          { label: 'Elige Coche, Bici o A pie — luego Iniciar navegación', svg: <SvgNavigate /> },
          { label: 'Cambia el modo de transporte en cualquier momento', svg: <SvgRouteModes /> },
        ]},
      ]},
      { category: 'Compartir', items: [
        { q: '¿Cómo comparto un spot?', a: 'Abre el detalle de un spot y toca Compartir. En móvil se abre el menú nativo, en escritorio se copia el enlace.', steps: [{ label: 'Abre un spot y toca Compartir (↑)', svg: <SvgShare /> }]},
      ]},
    ],
    about: { title: 'Acerca de SpotFinder', desc: 'SpotFinder es una app de mapas comunitaria gratuita para descubrir lugares útiles — desde aparcamientos ocultos hasta miradores panorámicos. Cualquiera puede contribuir.', features: ['Gratis — sin suscripción', 'Funciona como invitado — sin cuenta', 'Añade, valora, navega y comparte spots', 'Dictado por voz en 12 idiomas', 'Tráfico y cortes de carretera en tiempo real', 'Navegación por voz para coche, bici y peatones'], built: 'Desarrollado con React, Leaflet, Firebase y OSRM.', version: 'Versión 2.1' }
  },
};

// ─── Accordion item with step-by-step guide ───────────────────────────────────
function AccordionItem({ q, a, steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-gray-100 dark:border-border last:border-0 ${open ? 'bg-gray-50 dark:bg-accent/30' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-foreground">{q}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-sm text-gray-600 dark:text-muted-foreground leading-relaxed mb-1">{a}</p>
          {steps && <StepGuide steps={steps} />}
        </div>
      )}
    </div>
  );
}

// ─── About section ────────────────────────────────────────────────────────────
function AboutSection({ data }) {
  const icons = [Star, MapPin, Navigation, Mic, Layers, Share2];
  return (
    <div className="rounded-2xl overflow-hidden border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">{data.title}</h2>
        </div>
        <p className="text-sm text-blue-100 leading-relaxed">{data.desc}</p>
      </div>
      {/* Features */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 gap-2">
          {data.features.map((f, i) => {
            const Icon = icons[i] || Star;
            return (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-blue-100 dark:border-blue-900/40 last:border-0">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm text-gray-700 dark:text-foreground">{f}</p>
              </div>
            );
          })}
        </div>
      </div>
      {/* Footer */}
      <div className="px-6 py-4 bg-blue-50 dark:bg-blue-950/40 border-t border-blue-100 dark:border-blue-900/40">
        <p className="text-xs text-gray-500 dark:text-muted-foreground">{data.built}</p>
        <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5">{data.version}</p>
      </div>
    </div>
  );
}

// ─── Main FAQ page ────────────────────────────────────────────────────────────
export default function FAQ() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const content = FAQ_CONTENT[language] || FAQ_CONTENT.en;



  return (
    // FIX: use fixed+overflow-y-auto to escape the Layout's overflow:hidden prison
    <div className="bg-background text-foreground min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">{t('faq.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('faq.backToMap')}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-16">
        {content.sections.map(section => (
          <div key={section.category}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2 px-1">
              {section.category}
            </h2>
            <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border overflow-hidden">
              {section.items.map(item => (
                <AccordionItem key={item.q} q={item.q} a={item.a} steps={item.steps} />
              ))}
            </div>
          </div>
        ))}

        {/* About section */}
        <AboutSection data={content.about} />
      </div>
    </div>
  );
}
