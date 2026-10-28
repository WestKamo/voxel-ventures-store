import Stripe from 'stripe';
import { env } from '../config/env.js';
import { fail } from '../middleware/core.js';
// Provider boundary: application services depend only on these provider operations.
export function stripeProvider() {
  const client = () => {
    if (!env.STRIPE_SECRET_KEY) fail(503, 'Payments are not configured yet');
    return new Stripe(env.STRIPE_SECRET_KEY);
  };
  return {
    assertReady() {
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
        fail(503, 'Payments and their webhook must be configured before checkout');
    },
    async checkout(order) {
      return client().checkout.sessions.create(
        {
          mode: 'payment',
          client_reference_id: order.id,
          metadata: { orderId: order.id },
          expires_at: Math.floor(order.expiresAt.getTime() / 1000),
          success_url: `${env.CLIENT_URL}/orders/${order.id}?checkout=returned`,
          cancel_url: `${env.CLIENT_URL}/orders/${order.id}`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: order.currency.toLowerCase(),
                unit_amount: order.total,
                product_data: { name: 'Voxel Ventures order ' + order.id.slice(-8) },
              },
            },
          ],
        },
        { idempotencyKey: 'checkout:' + order.id },
      );
    },
    event(raw, signature) {
      if (!env.STRIPE_WEBHOOK_SECRET) fail(503, 'Webhook is not configured');
      try {
        return client().webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch {
        fail(400, 'Invalid payment signature');
      }
    },
    async retrieve(id) {
      return client().checkout.sessions.retrieve(id);
    },
    async refund(order) {
      return client().refunds.create(
        { payment_intent: order.paymentIntent },
        { idempotencyKey: 'refund:' + order.id },
      );
    },
  };
}
