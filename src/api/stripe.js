import { loadStripe } from '@stripe/stripe-js';

// Stripe publishable key (add to .env as VITE_STRIPE_PUBLISHABLE_KEY)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY || '');

export const PLANS = {
  elite: {
    monthly: 'price_elite_monthly', // Replace with actual Stripe price IDs
    yearly: 'price_elite_yearly',
    name: 'SpotFinder Elite',
    priceMonthly: '$4.99/mo',
    priceYearly: '$27.99/yr',
    colors: { bg: '#7C3AED', accent: '#A78BFA' },
    icon: '👑',
    features: ['Lane markings', 'Advanced POI filters', 'Offline premium']
  },
  ultra: {
    monthly: 'price_ultra_monthly',
    yearly: 'price_ultra_yearly',
    name: 'SpotFinder Ultra',
    priceMonthly: '$9.99/mo',
    priceYearly: '$49.99/yr',
    colors: { bg: '#065F46', accent: '#111827' },
    icon: '💎',
    features: ['All Elite + Live traffic', 'Unlimited routes', 'Priority support']
  }
};

export async function createCheckoutSession(planId, returnUrl = window.location.origin) {
  if (!STRIPE_PUBLISHABLE_KEY) throw new Error('Stripe key missing');

  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId: planId, returnUrl })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Checkout failed');
  }

  const { sessionId } = await response.json();
  const stripe = await stripePromise;
  return stripe.redirectToCheckout({ sessionId });
}

// Client-side subscription status check
export async function getSubscriptionStatus(userId) {
  const response = await fetch(`/api/subscription-status?userId=${userId}`);
  if (!response.ok) return null;
  return await response.json();
}

