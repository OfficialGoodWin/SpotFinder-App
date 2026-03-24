import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { priceId, returnUrl } = await request.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}/?success=true`,
      cancel_url: `${returnUrl}/?canceled=true`,
      metadata: {
        // Will be available in webhook
      },
      subscription_data: {
        trial_period_days: 7 // 7-day trial
      }
    });

    return Response.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: { message: 'Checkout creation failed' } }, { status: 500 });
  }
}

