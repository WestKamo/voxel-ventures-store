import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (name, required = false) => ({ type: Schema.Types.ObjectId, ref: name, required });
const opts = { timestamps: true, strict: 'throw' };
const model = (name, shape, indexes = []) => {
  const s = new Schema(shape, opts);
  for (const [fields, options] of indexes) s.index(fields, options);
  return mongoose.model(name, s);
};
const address = new Schema(
  {
    name: String,
    line1: String,
    line2: String,
    city: String,
    province: String,
    postalCode: String,
    country: { type: String, default: 'ZA' },
    phone: String,
  },
  { _id: true },
);
export const User = model('User', {
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  blocked: { type: Boolean, default: false },
  forcePasswordChange: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0 },
  addresses: [address],
  wishlist: [ref('Product')],
  resetHash: { type: String, select: false },
  resetExpires: Date,
});
export const Session = model(
  'Session',
  {
    user: ref('User', true),
    hash: { type: String, unique: true },
    family: String,
    expiresAt: Date,
    revoked: { type: Boolean, default: false },
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Category = model('Category', {
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
});
const variant = new Schema(
  {
    sku: { type: String, required: true },
    material: String,
    colour: String,
    size: String,
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);
export const Product = model('Product', {
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: String,
  category: ref('Category', true),
  images: [String],
  modelUrl: String,
  variants: [variant],
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
});
export const Cart = model('Cart', {
  user: { ...ref('User', true), unique: true },
  items: [
    {
      product: ref('Product', true),
      variant: Schema.Types.ObjectId,
      quantity: { type: Number, min: 1, max: 99 },
    },
  ],
});
export const Coupon = model('Coupon', {
  code: { type: String, unique: true },
  percent: { type: Number, min: 1, max: 80 },
  minimum: { type: Number, default: 0 },
  expiresAt: Date,
  active: { type: Boolean, default: true },
});
export const Settings = model('Settings', {
  key: { type: String, unique: true, default: 'store' },
  currency: String,
  taxBasisPoints: { type: Number, default: 0 },
  shipping: [{ name: String, price: Number }],
  contactEmail: String,
  whatsapp: String,
});
export const Order = model(
  'Order',
  {
    user: ref('User', true),
    request: ref('PrintRequest'),
    idempotencyKey: String,
    items: [
      {
        product: ref('Product'),
        variant: Schema.Types.ObjectId,
        name: String,
        sku: String,
        quantity: Number,
        price: Number,
      },
    ],
    address,
    shippingMethod: String,
    subtotal: Number,
    discount: Number,
    shipping: Number,
    tax: Number,
    total: Number,
    currency: String,
    coupon: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'expired', 'refunded'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['Awaiting payment', 'Processing', 'Printing', 'Shipped', 'Completed', 'Cancelled'],
      default: 'Awaiting payment',
    },
    checkoutStarted: { type: Boolean, default: false },
    stripeSessionId: String,
    paymentIntent: String,
    checkoutUrl: String,
    expiresAt: Date,
    paidAt: Date,
    trackingNumber: String,
    history: [{ status: String, at: Date }],
    refundedAt: Date,
  },
  [
    [{ user: 1, idempotencyKey: 1 }, { unique: true }],
    [{ stripeSessionId: 1 }, { sparse: true, unique: true }],
  ],
);
export const PrintRequest = model('PrintRequest', {
  user: ref('User', true),
  title: String,
  description: String,
  material: String,
  colour: String,
  dimensions: { x: Number, y: Number, z: Number },
  quantity: Number,
  deadline: Date,
  file: ref('Upload'),
  status: {
    type: String,
    enum: ['Submitted', 'Quoted', 'Accepted', 'Printing', 'Shipped', 'Completed', 'Declined'],
    default: 'Submitted',
  },
  quote: {
    currency: String,
    price: Number,
    leadDays: Number,
    notes: String,
    version: Number,
    expiresAt: Date,
  },
  order: ref('Order'),
  messages: [{ author: ref('User'), name: String, text: String, at: Date }],
  history: [{ status: String, at: Date }],
});
export const Review = model(
  'Review',
  {
    user: ref('User', true),
    product: ref('Product', true),
    name: String,
    rating: { type: Number, min: 1, max: 5 },
    text: String,
    approved: { type: Boolean, default: false },
  },
  [[{ user: 1, product: 1 }, { unique: true }]],
);
export const Upload = model('Upload', {
  user: ref('User', true),
  key: String,
  name: String,
  kind: String,
  size: Number,
  scanned: Boolean,
});
export const PaymentEvent = model('PaymentEvent', {
  eventId: { type: String, unique: true },
  type: String,
});
export const EmailJob = model('EmailJob', {
  key: { type: String, unique: true },
  to: String,
  subject: String,
  text: String,
  attempts: { type: Number, default: 0 },
  sentAt: Date,
  nextAttempt: { type: Date, default: Date.now },
  lockedUntil: Date,
});
