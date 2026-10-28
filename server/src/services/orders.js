import mongoose from 'mongoose';
import {
  Product,
  Order,
  Settings,
  Coupon,
  PrintRequest,
  PaymentEvent,
  User,
} from '../models/index.js';
import { fail, owner } from '../middleware/core.js';
import { enqueueEmail } from './email.js';
export async function transaction(fn) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}
export async function settings(session) {
  const s = await Settings.findOne({ key: 'store' }).session(session || null);
  if (!s) fail(503, 'Store setup is incomplete. Run the seed script.');
  return s;
}
export function totals(subtotal, discount, shipping, basisPoints) {
  const tax = Math.round(((subtotal - discount) * basisPoints) / 10000);
  return { subtotal, discount, shipping, tax, total: subtotal - discount + shipping + tax };
}
export async function calculate(input, session, reserve = false) {
  const config = await settings(session);
  const shipping = config.shipping.id(input.shippingMethod);
  if (!shipping) fail(422, 'Choose a valid shipping method');
  const items = [];
  const seen = new Set();
  for (const item of input.items) {
    const key = item.product + ':' + item.variant;
    if (seen.has(key)) fail(422, 'Duplicate cart variant');
    seen.add(key);
    const p = await Product.findOne({ _id: item.product, active: true }).session(session || null);
    const v = p?.variants.id(item.variant);
    if (!v) fail(422, 'A product variant is unavailable');
    if (v.stock < item.quantity) fail(409, `${p.name}: insufficient stock`);
    if (reserve) {
      const result = await Product.updateOne(
        { _id: p._id, variants: { $elemMatch: { _id: v._id, stock: { $gte: item.quantity } } } },
        { $inc: { 'variants.$.stock': -item.quantity } },
        { session },
      );
      if (!result.modifiedCount) fail(409, 'Stock changed; please try again');
    }
    items.push({
      product: p._id,
      variant: v._id,
      name: p.name,
      sku: v.sku,
      quantity: item.quantity,
      price: v.price,
    });
  }
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let discount = 0;
  if (input.coupon) {
    const coupon = await Coupon.findOne({
      code: input.coupon.toUpperCase(),
      active: true,
      expiresAt: { $gt: new Date() },
    }).session(session || null);
    if (!coupon || subtotal < coupon.minimum)
      fail(422, 'Coupon is invalid, expired, or its minimum has not been met');
    discount = Math.round((subtotal * coupon.percent) / 100);
  }
  return {
    items,
    ...totals(subtotal, discount, shipping.price, config.taxBasisPoints),
    currency: config.currency,
    shippingMethod: shipping.name,
    coupon: input.coupon.toUpperCase(),
  };
}
async function sessionFor(order, provider) {
  if (order.paymentStatus !== 'pending') fail(409, 'This order is no longer awaiting payment');
  if (order.checkoutUrl) return order;
  if (order.expiresAt < new Date(Date.now() + 30 * 60000))
    fail(409, 'This checkout has expired or has too little time left. Start a new checkout.');
  await Order.updateOne(
    { _id: order._id, paymentStatus: 'pending' },
    { $set: { checkoutStarted: true } },
  );
  const checkout = await provider.checkout(order);
  order = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'pending' },
    { $set: { stripeSessionId: checkout.id, checkoutUrl: checkout.url } },
    { new: true },
  );
  if (!order) fail(409, 'Order state changed');
  return order;
}
export async function createOrder(user, input, provider) {
  provider.assertReady?.();
  let order = await Order.findOne({ user: user._id, idempotencyKey: input.idempotencyKey });
  if (!order) {
    try {
      order = await transaction(async (session) => {
        const values = await calculate(input, session, true);
        const [created] = await Order.create(
          [
            {
              ...values,
              user: user._id,
              address: input.address,
              idempotencyKey: input.idempotencyKey,
              expiresAt: new Date(Date.now() + 35 * 60000),
              history: [{ status: 'Awaiting payment', at: new Date() }],
            },
          ],
          { session },
        );
        return created;
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
      order = await Order.findOne({ user: user._id, idempotencyKey: input.idempotencyKey });
    }
  }
  return sessionFor(order, provider);
}
export async function quoteOrder(user, id, input, provider) {
  provider.assertReady?.();
  let order = await transaction(async (session) => {
    const request = owner(await PrintRequest.findById(id).session(session), user);
    if (String(request.user) !== user.id) fail(403, 'Only the customer can pay their quote');
    if (request.status !== 'Accepted') fail(409, 'Accept the current quote first');
    if (request.order) return Order.findById(request.order).session(session);
    if (request.quote.expiresAt < new Date()) fail(409, 'Quote expired; request a new quote');
    const config = await settings(session);
    if (request.quote.currency !== config.currency)
      fail(409, 'Store currency changed; request an updated quote');
    const method = config.shipping.id(input.shippingMethod);
    if (!method) fail(422, 'Invalid shipping method');
    const [created] = await Order.create(
      [
        {
          user: user._id,
          request: request._id,
          items: [
            {
              name: request.title,
              quantity: request.quantity,
              price: Math.round(request.quote.price / request.quantity),
            },
          ],
          ...totals(request.quote.price, 0, method.price, config.taxBasisPoints),
          currency: config.currency,
          address: input.address,
          shippingMethod: method.name,
          idempotencyKey: input.idempotencyKey,
          expiresAt: new Date(Date.now() + 35 * 60000),
          history: [{ status: 'Awaiting payment', at: new Date() }],
        },
      ],
      { session },
    );
    request.order = created._id;
    await request.save({ session });
    return created;
  });
  return sessionFor(order, provider);
}
async function release(order, session) {
  for (const item of order.items) {
    if (item.product)
      await Product.updateOne(
        { _id: item.product, 'variants._id': item.variant },
        { $inc: { 'variants.$.stock': item.quantity } },
        { session },
      );
  }
  if (order.request)
    await PrintRequest.updateOne(
      { _id: order.request, order: order._id },
      { $unset: { order: 1 } },
      { session },
    );
  order.paymentStatus = 'expired';
  order.status = 'Cancelled';
  order.history.push({ status: 'Cancelled', at: new Date() });
  await order.save({ session });
}
export async function webhook(event) {
  try {
    await transaction(async (session) => {
      if (await PaymentEvent.exists({ eventId: event.id }).session(session)) return;
      const obj = event.data.object;
      const id = obj.metadata?.orderId;
      if (
        [
          'checkout.session.completed',
          'checkout.session.async_payment_succeeded',
          'checkout.session.expired',
          'checkout.session.async_payment_failed',
        ].includes(event.type) &&
        id
      ) {
        const order = await Order.findById(id).session(session);
        if (!order) fail(400, 'Unknown payment order');
        if (order.stripeSessionId && order.stripeSessionId !== obj.id)
          fail(400, 'Session mismatch');
        if (event.type.endsWith('expired') || event.type.endsWith('failed')) {
          if (order.paymentStatus === 'pending') await release(order, session);
        } else if (obj.payment_status === 'paid' && order.paymentStatus === 'pending') {
          if (obj.amount_total !== order.total || obj.currency?.toUpperCase() !== order.currency)
            fail(400, 'Payment amount mismatch');
          order.paymentStatus = 'paid';
          order.status = 'Processing';
          order.paidAt = new Date();
          order.stripeSessionId = obj.id;
          order.paymentIntent = obj.payment_intent;
          order.history.push({ status: 'Processing', at: new Date() });
          await order.save({ session });
          const user = await User.findById(order.user).session(session);
          await enqueueEmail(
            'paid:' + order.id,
            user.email,
            'Your Voxel Ventures order is confirmed',
            `Order ${order.id} is paid. Track it in your account.`,
            session,
          );
        }
      }
      await PaymentEvent.create([{ eventId: event.id, type: event.type }], { session });
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}
export async function expireReservations(provider) {
  const orders = await Order.find({
    paymentStatus: 'pending',
    expiresAt: { $lt: new Date(Date.now() - 60000) },
  }).limit(25);
  for (const order of orders) {
    if (order.checkoutStarted && !order.stripeSessionId) continue;
    if (order.stripeSessionId) {
      const remote = await provider.retrieve(order.stripeSessionId);
      if (remote.status !== 'expired') continue;
    }
    await transaction(async (session) => {
      const fresh = await Order.findById(order._id).session(session);
      if (fresh.paymentStatus === 'pending') await release(fresh, session);
    });
  }
}
export async function updateOrder(id, input) {
  return transaction(async (session) => {
    const order = await Order.findById(id).session(session);
    if (!order) fail(404, 'Order not found');
    if (order.paymentStatus !== 'paid') fail(409, 'Only paid orders can be fulfilled');
    const next = {
      Processing: ['Printing', 'Shipped'],
      Printing: ['Shipped'],
      Shipped: ['Completed'],
      Completed: [],
    };
    if (input.status !== order.status && !next[order.status]?.includes(input.status))
      fail(409, 'Invalid order status transition');
    if (input.status === 'Shipped' && !input.trackingNumber && !order.trackingNumber)
      fail(422, 'Tracking number is required');
    order.status = input.status;
    order.trackingNumber = input.trackingNumber || order.trackingNumber;
    order.history.push({ status: input.status, at: new Date() });
    await order.save({ session });
    if (order.request && ['Printing', 'Shipped', 'Completed'].includes(input.status))
      await PrintRequest.updateOne(
        { _id: order.request },
        {
          $set: { status: input.status },
          $push: { history: { status: input.status, at: new Date() } },
        },
        { session },
      );
    const user = await User.findById(order.user).session(session);
    await enqueueEmail(
      'status:' + order.id + ':' + order.history.length,
      user.email,
      'Order update: ' + input.status,
      `Your order ${order.id} is ${input.status}. Tracking: ${order.trackingNumber || 'Not yet assigned'}`,
      session,
    );
    return order;
  });
}
export async function refundOrder(id, provider) {
  let order = await Order.findById(id);
  if (!order) fail(404, 'Order not found');
  if (order.paymentStatus === 'refunded') return order;
  if (order.paymentStatus !== 'paid' || !order.paymentIntent)
    fail(409, 'Only paid orders can be refunded');
  const refund = await provider.refund(order);
  if (refund.status !== 'succeeded')
    fail(409, 'Refund is pending with the payment provider; retry to reconcile');
  return transaction(async (session) => {
    order = await Order.findById(id).session(session);
    if (order.paymentStatus === 'refunded') return order;
    order.paymentStatus = 'refunded';
    order.refundedAt = new Date();
    order.status = 'Cancelled';
    order.history.push({ status: 'Refunded', at: new Date() });
    await order.save({ session });
    const user = await User.findById(order.user).session(session);
    await enqueueEmail(
      'refund:' + id,
      user.email,
      'Order refunded',
      `Your order ${id} has been refunded.`,
      session,
    );
    return order;
  });
}
