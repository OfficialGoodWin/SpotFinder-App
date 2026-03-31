/**
 * SubscriptionModal.jsx
 * SpotFinder Elite (bruise purple) & Ultra (black/dark-green) subscription plans.
 * Uses Stripe Checkout (redirect mode) — no card details handled client-side.
 *
 * Setup:
 *  1. Create products + prices in your Stripe Dashboard (or CLI).
 *  2. Paste the price IDs into the PRICES object below.
 *  3. Set VITE_STRIPE_PUBLISHABLE_KEY in .env
 *  4. Deploy a small backend (Vercel Edge Function / Firebase Function)
 *     at POST /api/create-checkout-session  — see the comment block at the bottom.
 */

import React, { useState } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { X, Zap, Crown, Check, Sparkles, Shield } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

// ── Stripe config ─────────────────────────────────────────────────────────────
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

// ── Price IDs from your Stripe Dashboard ─────────────────────────────────────
// Replace these with your real price IDs after creating products
const PRICES = {
  elite_monthly: import.meta.env.VITE_STRIPE_ELITE_MONTHLY || 'price_elite_monthly',
  elite_yearly:  import.meta.env.VITE_STRIPE_ELITE_YEARLY  || 'price_elite_yearly',
  ultra_monthly: import.meta.env.VITE_STRIPE_ULTRA_MONTHLY || 'price_ultra_monthly',
  ultra_yearly:  import.meta.env.VITE_STRIPE_ULTRA_YEARLY  || 'price_ultra_yearly',
};

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'elite',
    name: 'SpotFinder Elite',
    tagline: 'For the avid explorer',
    icon: Zap,
    // Bruise-purple color palette
    gradient: 'linear-gradient(135deg, #4a1a7a 0%, #6b2fa0 40%, #8b3fc0 100%)',
    accentColor: '#c084fc',
    textColor: '#f3e8ff',
    mutedColor: '#d8b4fe',
    borderColor: '#7c3aed',
    badgeBg: 'rgba(139,63,192,0.3)',
    monthly: { price: '$4.99', priceId: PRICES.elite_monthly, period: '/month' },
    yearly:  { price: '$27.99', priceId: PRICES.elite_yearly,  period: '/year', saving: 'Save $31.89' },
    features: [
      'Unlimited spot saves',
      'Advanced route planning',
      'Offline maps for 3 regions',
      'Priority spot ratings',
      'Elite badge on profile',
      'No ads',
      'Early access to new features',
    ],
  },
  {
    id: 'ultra',
    name: 'SpotFinder Ultra',
    tagline: 'The ultimate experience',
    icon: Crown,
    // Black / dark-green palette
    gradient: 'linear-gradient(135deg, #050f05 0%, #0a1f0a 40%, #0d2b0d 60%, #111 100%)',
    accentColor: '#4ade80',
    textColor: '#f0fdf4',
    mutedColor: '#86efac',
    borderColor: '#166534',
    badgeBg: 'rgba(22,101,52,0.4)',
    monthly: { price: '$7.99', priceId: PRICES.ultra_monthly, period: '/month' },
    yearly:  { price: '$45.99', priceId: PRICES.ultra_yearly,  period: '/year', saving: 'Save $49.89' },
    features: [
      'Everything in Elite',
      'Unlimited offline maps',
      'Real-time traffic alerts',
      'Custom map themes',
      'Trip history & export',
      'Priority support',
      'Ultra badge on profile',
      'AI-powered spot recommendations',
      'Share private spots with friends',
    ],
    popular: true,
  },
];

// ── Stripe checkout helper ────────────────────────────────────────────────────
async function redirectToCheckout(priceId, userEmail) {
  if (!stripePromise) {
    alert('Stripe is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY to your .env file.');
    return;
  }

  // Call your backend to create a Checkout Session
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      customerEmail: userEmail || undefined,
      successUrl: `${window.location.origin}/?subscribed=success`,
      cancelUrl:  `${window.location.origin}/?subscribed=cancel`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(`Checkout failed: ${err.message || res.statusText}`);
    return;
  }

  const { sessionId } = await res.json();
  const stripe = await stripePromise;
  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) alert(error.message);
}

// ── Plan card component ────────────────────────────────────────────────────────
function PlanCard({ plan, user, onClose }) {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const Icon = plan.icon;
  const price = billing === 'monthly' ? plan.monthly : plan.yearly;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await redirectToCheckout(price.priceId, user?.email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex flex-col rounded-3xl overflow-hidden shadow-2xl"
      style={{
        background: plan.gradient,
        border: `1.5px solid ${plan.borderColor}`,
        minHeight: 520,
      }}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        {plan.popular && (
          <div
            className="absolute top-1.5 right-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide z-30 backdrop-blur-sm"
            style={{ background: plan.badgeBg, color: plan.accentColor, border: `1px solid ${plan.borderColor}` }}
          >
            ✦ MOST POPULAR
          </div>
        )}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: plan.badgeBg }}
          >
            <Icon className="w-5 h-5" style={{ color: plan.accentColor }} />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-none" style={{ color: plan.textColor }}>
              {plan.name}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: plan.mutedColor }}>{plan.tagline}</p>
          </div>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="px-6 mb-4">
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
          {['monthly', 'yearly'].map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={billing === b
                ? { background: plan.badgeBg, color: plan.accentColor, boxShadow: `0 0 12px ${plan.accentColor}44` }
                : { color: plan.mutedColor }
              }
            >
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
              {b === 'yearly' && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: plan.accentColor + '22', color: plan.accentColor }}
                >
                  SAVE
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="px-6 mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black" style={{ color: plan.textColor }}>
            {price.price}
          </span>
          <span className="text-sm" style={{ color: plan.mutedColor }}>{price.period}</span>
        </div>
        {billing === 'yearly' && (
          <p className="text-xs mt-1 font-semibold" style={{ color: plan.accentColor }}>
            {price.saving}
          </p>
        )}
      </div>

      {/* Features */}
      <div className="px-6 flex-1 mb-4">
        <ul className="space-y-2">
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: plan.mutedColor }}>
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: plan.accentColor }} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Subscribe button */}
      <div className="px-6 pb-6">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{
            background: plan.accentColor,
            color: plan.id === 'elite' ? '#1a0a2e' : '#052e05',
            boxShadow: `0 4px 24px ${plan.accentColor}55`,
          }}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <Icon className="w-4 h-4" />
              Get {plan.name.split(' ')[1]}
            </>
          )}
        </button>
        <p className="text-center text-[10px] mt-2" style={{ color: plan.mutedColor }}>
          Cancel anytime · Secured by Stripe
        </p>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SubscriptionModal({ onClose, user }) {
  const { isDark } = useTheme();
  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div
        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-background border border-gray-200 dark:border-border"
        style={{ maxHeight: '92vh' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#1a1a1a', color: '#888' }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-xs font-bold tracking-widest text-purple-400 uppercase">
              SpotFinder Premium
            </span>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">Unlock the Full Experience</h2>
          <p className="text-sm text-gray-400">
            Choose your plan and take your adventures to the next level
          </p>
        </div>

        {/* Plan cards */}
        <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 120px)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} user={user} onClose={onClose} />
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-4 pb-2">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Shield className="w-3.5 h-3.5" />
              256-bit SSL
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Check className="w-3.5 h-3.5" />
              Cancel anytime
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Zap className="w-3.5 h-3.5" />
              Instant activation
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
        BACKEND REQUIRED: POST /api/create-checkout-session
        
        Deploy this as a Vercel Edge Function at /api/create-checkout-session.js:
        
        import Stripe from 'stripe';
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        export default async function handler(req, res) {
          if (req.method !== 'POST') return res.status(405).end();
          const { priceId, customerEmail, successUrl, cancelUrl } = req.body;
          const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            customer_email: customerEmail,
            success_url: successUrl,
            cancel_url: cancelUrl,
          });
          res.json({ sessionId: session.id });
        }
        
        Add to .env:
          STRIPE_SECRET_KEY=sk_live_...
          VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
          VITE_STRIPE_ELITE_MONTHLY=price_...
          VITE_STRIPE_ELITE_YEARLY=price_...
          VITE_STRIPE_ULTRA_MONTHLY=price_...
          VITE_STRIPE_ULTRA_YEARLY=price_...
      ──────────────────────────────────────────────────────────────────────── */}
    </div>
  );
}
