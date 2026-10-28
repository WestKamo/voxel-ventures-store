import { jest, beforeAll, afterAll, beforeEach, test, expect } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1/test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.JWT_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.CSRF_SECRET = 'test-csrf-secret-that-is-at-least-32-characters';
process.env.STRIPE_SECRET_KEY = 'sk_test_integration';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_integration';
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'Temporary-seed-password';
const { createApp } = await import('../src/app.js');
const models = await import('../src/models/index.js');
const { seed } = await import('../src/seed.js');
const { stripeProvider } = await import('../src/services/payments.js');
const { totals, expireReservations } = await import('../src/services/orders.js');
const { validateModel } = await import('../src/services/uploads.js');
const { User, Product, Settings, Order, Session, EmailJob, PrintRequest } = models;
let db, app, product, shipping, payments;
const password = 'Customer-password-123';
async function client(email = 'customer@example.test', admin = false) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/auth/csrf')).body.data.token;
  const send = (method, url, body) => agent[method](url).set('x-csrf-token', csrf).send(body);
  const signup = await send('post', '/api/auth/register', {
    name: 'Test customer',
    email,
    password,
  });
  expect(signup.status).toBe(201);
  if (admin) await User.updateOne({ email }, { $set: { role: 'admin' } });
  return { agent, send, user: signup.body.data };
}
const address = {
  name: 'Test Customer',
  line1: '1 Studio Road',
  line2: '',
  city: 'Durban',
  province: 'KZN',
  postalCode: '4001',
  phone: '0712345678',
  country: 'ZA',
};
const input = (key = crypto.randomUUID()) => ({
  items: [{ product: product.id, variant: product.variants[0].id, quantity: 2 }],
  address,
  shippingMethod: shipping,
  idempotencyKey: key,
  coupon: '',
});
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } });
  await mongoose.connect(db.getUri());
  await Promise.all(Object.values(models).map((m) => m.init()));
});
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
beforeEach(async () => {
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
  await seed();
  product = await Product.findOne();
  shipping = (await Settings.findOne()).shipping[0].id;
  payments = {
    ...stripeProvider(),
    checkout: jest.fn(async (o) => ({
      id: 'cs_' + o.id,
      url: 'https://checkout.stripe.com/test/' + o.id,
    })),
    retrieve: jest.fn(async () => ({ status: 'expired' })),
    refund: jest.fn(async () => ({ status: 'succeeded' })),
  };
  app = createApp({ payments });
});
test('seed is idempotent, hashes admin password and forces first-login change', async () => {
  await seed();
  expect(await User.countDocuments()).toBe(1);
  expect(await Product.countDocuments()).toBe(6);
  const admin = await User.findOne().select('+passwordHash');
  expect(admin.forcePasswordChange).toBe(true);
  expect(await bcrypt.compare(process.env.ADMIN_PASSWORD, admin.passwordHash)).toBe(true);
  expect(admin.passwordHash).not.toBe(process.env.ADMIN_PASSWORD);
});
test('registration rejects role injection; auth cookies are httpOnly; user output excludes credentials', async () => {
  const c = await client();
  expect(c.user.role).toBe('customer');
  expect(c.user.passwordHash).toBeUndefined();
  const bad = await c.send('post', '/api/auth/register', {
    name: 'Attack',
    email: 'attack@example.test',
    password,
    role: 'admin',
  });
  expect(bad.status).toBe(422);
  const login = await c.send('post', '/api/auth/login', {
    email: 'customer@example.test',
    password,
  });
  expect(login.headers['set-cookie'].every((c) => c.includes('HttpOnly'))).toBe(true);
  expect((await c.agent.get('/api/auth/me')).body.data.email).toBe('customer@example.test');
});
test('CSRF, CORS and non-admin authorization block unsafe operations', async () => {
  const c = await client();
  expect((await c.agent.post('/api/auth/logout')).status).toBe(403);
  expect((await c.agent.get('/api/products').set('Origin', 'https://evil.example')).status).toBe(
    403,
  );
  expect((await c.agent.get('/api/admin/users')).status).toBe(403);
  expect((await c.send('post', '/api/admin/products', {})).status).toBe(403);
  expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
});
test('seed admin must change password before accessing dashboard', async () => {
  const agent = request.agent(app);
  const token = (await agent.get('/api/auth/csrf')).body.data.token;
  await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  expect((await agent.get('/api/admin/dashboard')).status).toBe(403);
  expect(
    (
      await agent
        .post('/api/auth/password')
        .set('x-csrf-token', token)
        .send({ currentPassword: process.env.ADMIN_PASSWORD, password: 'Replacement-password-123' })
    ).status,
  ).toBe(200);
  expect((await agent.get('/api/admin/dashboard')).status).toBe(200);
});
test('refresh rotates secrets and detects replay; logout revokes the refresh session', async () => {
  const c = await client();
  const first = await c.send('post', '/api/auth/login', {
    email: 'customer@example.test',
    password,
  });
  const old = first.headers['set-cookie'].find((x) => x.startsWith('refresh=')).split(';')[0];
  expect((await c.send('post', '/api/auth/refresh')).status).toBe(200);
  const attacker = request.agent(app);
  const csrf = (await attacker.get('/api/auth/csrf')).body.data.token;
  expect(
    (
      await attacker
        .post('/api/auth/refresh')
        .set('Cookie', old + '; csrf=' + csrf)
        .set('x-csrf-token', csrf)
    ).status,
  ).toBe(401);
  await c.send('post', '/api/auth/logout');
  expect((await c.agent.get('/api/auth/me')).status).toBe(401);
});
test('reset does not disclose token, survives profile save, invalidates existing access and is single-use', async () => {
  const c = await client();
  const response = await c.send('post', '/api/auth/forgot-password', {
    email: 'customer@example.test',
  });
  expect(response.body.data.token).toBeUndefined();
  const job = await EmailJob.findOne({ subject: /Reset/ });
  const token = job.text.split('/reset-password/')[1];
  const other = await client('other@example.test');
  expect(
    (
      await other.send('post', '/api/auth/reset-password', {
        token,
        password: 'New-secure-password-123',
      })
    ).status,
  ).toBe(200);
  expect((await c.agent.get('/api/auth/me')).status).toBe(401);
  expect((await other.send('post', '/api/auth/reset-password', { token, password })).status).toBe(
    400,
  );
  expect(
    (
      await c.send('post', '/api/auth/login', {
        email: 'customer@example.test',
        password: 'New-secure-password-123',
      })
    ).status,
  ).toBe(200);
});
test('catalogue filters, pagination, product detail and admin CRUD', async () => {
  expect(
    (await request(app).get('/api/products?material=PLA&max=30000')).body.data.products.length,
  ).toBeGreaterThan(0);
  expect((await request(app).get('/api/products?search=not-an-object')).body.data.total).toBe(0);
  expect((await request(app).get('/api/products/' + product.slug)).status).toBe(200);
  const admin = await client('staff@example.test', true);
  const source = product.toObject();
  const { name, slug, description, category, images, variants } = source;
  const created = await admin.send('post', '/api/admin/products', {
    name: name + ' New',
    slug: slug + '-new',
    description,
    category: String(category),
    images,
    variants: variants.map(({ sku, material, colour, size, price, stock }) => ({
      sku,
      material,
      colour,
      size,
      price,
      stock,
    })),
  });
  expect(created.status).toBe(201);
  expect((await admin.send('delete', '/api/admin/products/' + created.body.data._id)).status).toBe(
    200,
  );
  expect((await request(app).get('/api/products/' + slug + '-new')).status).toBe(404);
});
test('cart persists only item identifiers and checkout ignores submitted prices', async () => {
  const c = await client();
  expect((await c.send('put', '/api/cart', { items: input().items })).status).toBe(200);
  expect((await c.agent.get('/api/cart')).body.data.items).toHaveLength(1);
  const body = { ...input(), total: 1, items: input().items.map((i) => ({ ...i, price: 1 })) };
  const result = await c.send('post', '/api/orders', body);
  expect(result.status).toBe(201);
  expect(result.body.data.subtotal).toBe(product.variants[0].price * 2);
  expect(result.body.data.paymentStatus).toBe('pending');
  expect((await Product.findById(product.id)).variants[0].stock).toBe(
    product.variants[0].stock - 2,
  );
});
test('checkout retries are idempotent and insufficient stock does not reserve inventory', async () => {
  const c = await client();
  const body = input();
  const first = await c.send('post', '/api/orders', body);
  const second = await c.send('post', '/api/orders', body);
  expect(first.body.data._id).toBe(second.body.data._id);
  expect(await Order.countDocuments()).toBe(1);
  const tooMany = input();
  tooMany.items[0].quantity = 99;
  expect((await c.send('post', '/api/orders', tooMany)).status).toBe(409);
  expect(await Order.countDocuments()).toBe(1);
});
test('parallel checkout cannot oversell the last unit', async () => {
  await Product.updateOne({ _id: product._id }, { $set: { 'variants.0.stock': 1 } });
  const c = await client();
  const one = input();
  one.items[0].quantity = 1;
  const two = { ...one, idempotencyKey: crypto.randomUUID() };
  const results = await Promise.all([
    c.send('post', '/api/orders', one),
    c.send('post', '/api/orders', two),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect((await Product.findById(product.id)).variants[0].stock).toBe(0);
});
async function paid(c) {
  const created = await c.send('post', '/api/orders', input());
  const order = created.body.data;
  const event = {
    id: 'evt_' + order._id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: order.stripeSessionId,
        metadata: { orderId: order._id },
        payment_status: 'paid',
        payment_intent: 'pi_test',
        amount_total: order.total,
        currency: order.currency.toLowerCase(),
      },
    },
  };
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return { order, payload, signature };
}
test('Stripe signature verification, payment amount validation and replay protection', async () => {
  const c = await client();
  const { order, payload, signature } = await paid(c);
  expect(
    (
      await request(app)
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'invalid')
        .send(payload)
    ).status,
  ).toBe(400);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await request(app)
          .post('/api/webhooks/stripe')
          .set('Content-Type', 'application/json')
          .set('stripe-signature', signature)
          .send(payload)
      ).status,
    ).toBe(200);
  expect((await Order.findById(order._id)).paymentStatus).toBe('paid');
  expect(await EmailJob.countDocuments({ key: 'paid:' + order._id })).toBe(1);
  const other = await paid(c);
  const wrong = JSON.parse(other.payload);
  wrong.data.object.amount_total = 1;
  const bad = JSON.stringify(wrong);
  expect(
    (
      await request(app)
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set(
          'stripe-signature',
          Stripe.webhooks.generateTestHeaderString({
            payload: bad,
            secret: process.env.STRIPE_WEBHOOK_SECRET,
          }),
        )
        .send(bad)
    ).status,
  ).toBe(400);
});
test('unpaid reservations expire and return stock exactly once', async () => {
  const c = await client();
  await c.send('post', '/api/orders', input());
  await Order.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 120000) } });
  await expireReservations(payments);
  await expireReservations(payments);
  expect((await Product.findById(product.id)).variants[0].stock).toBe(product.variants[0].stock);
  expect((await Order.findOne()).paymentStatus).toBe('expired');
});
test('order ownership, admin fulfilment transitions and refunds', async () => {
  const c = await client();
  const other = await client('other@example.test');
  const admin = await client('staff@example.test', true);
  const { order, payload, signature } = await paid(c);
  await request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(payload);
  expect((await other.agent.get('/api/orders/' + order._id)).status).toBe(404);
  expect(
    (await admin.send('put', '/api/admin/orders/' + order._id, { status: 'Completed' })).status,
  ).toBe(409);
  expect(
    (
      await admin.send('put', '/api/admin/orders/' + order._id, {
        status: 'Shipped',
        trackingNumber: 'TRACK123',
      })
    ).status,
  ).toBe(200);
  expect(
    (await admin.send('post', '/api/admin/orders/' + order._id + '/refund')).body.data
      .paymentStatus,
  ).toBe('refunded');
});
test('custom request ownership, quote versioning, decision, messaging and quote checkout', async () => {
  const c = await client();
  const other = await client('other@example.test');
  const admin = await client('staff@example.test', true);
  const result = await c.send('post', '/api/requests', {
    title: 'Custom organiser',
    description: 'Desk organiser for tools',
    material: 'PLA',
    colour: 'Bone',
    dimensions: { x: 100, y: 80, z: 50 },
    quantity: 2,
  });
  expect(result.status).toBe(201);
  const id = result.body.data._id;
  expect((await other.agent.get('/api/requests/' + id)).status).toBe(404);
  expect(
    (await other.send('post', '/api/requests/' + id + '/messages', { text: 'intrusion' })).status,
  ).toBe(404);
  expect(
    (await c.send('post', '/api/requests/' + id + '/messages', { text: 'Rounded edges please' }))
      .status,
  ).toBe(200);
  expect(
    (
      await admin.send('post', '/api/admin/requests/' + id + '/quote', {
        price: 40000,
        leadDays: 5,
        notes: 'Includes finishing',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })
    ).status,
  ).toBe(200);
  expect(
    (await c.send('post', '/api/requests/' + id + '/decision', { accept: true, version: 999 }))
      .status,
  ).toBe(409);
  expect(
    (await c.send('post', '/api/requests/' + id + '/decision', { accept: true, version: 1 }))
      .status,
  ).toBe(200);
  const checkout = await c.send('post', '/api/requests/' + id + '/pay', {
    address,
    shippingMethod: shipping,
    idempotencyKey: crypto.randomUUID(),
  });
  expect(checkout.status).toBe(201);
  expect(checkout.body.data.subtotal).toBe(40000);
  expect((await PrintRequest.findById(id)).order).toBeTruthy();
});
test('malformed models are rejected and monetary rounding uses integer minor units', () => {
  expect(() => validateModel(Buffer.from('<script>bad</script>'), '.stl')).toThrow();
  const stl = Buffer.alloc(134);
  stl.writeUInt32LE(1, 80);
  expect(() => validateModel(stl, '.stl')).not.toThrow();
  expect(totals(10001, 1000, 8500, 1500)).toEqual({
    subtotal: 10001,
    discount: 1000,
    shipping: 8500,
    tax: 1350,
    total: 18851,
  });
});

test('blocking an account invalidates its existing session and forbids new login', async () => {
  const customer = await client();
  const admin = await client('staff@example.test', true);
  expect(
    (await admin.send('put', '/api/admin/users/' + customer.user.id, { blocked: true })).status,
  ).toBe(200);
  expect((await customer.agent.get('/api/auth/me')).status).toBe(401);
  expect(
    (await customer.send('post', '/api/auth/login', { email: 'customer@example.test', password }))
      .status,
  ).toBe(401);
});
test('model uploads fail closed without storage and reviews require a paid purchase', async () => {
  const c = await client();
  const stl = Buffer.alloc(134);
  stl.writeUInt32LE(1, 80);
  const upload = await c.send('post', '/api/uploads/model').attach('file', stl, 'model.stl');
  expect(upload.status).toBe(503);
  expect(
    (
      await c.send('post', '/api/reviews', {
        product: product.id,
        rating: 5,
        text: 'Not purchased',
      })
    ).status,
  ).toBe(403);
});
test('analytics separates revenue currencies and admin cannot edit reserved stock', async () => {
  const c = await client();
  const admin = await client('staff@example.test', true);
  await c.send('post', '/api/orders', input());
  const p = product.toObject();
  const edit = {
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: String(p.category),
    images: [],
    variants: p.variants.map(({ _id, sku, material, colour, size, price, stock }) => ({
      _id: String(_id),
      sku,
      material,
      colour,
      size,
      price,
      stock,
    })),
  };
  expect((await admin.send('put', '/api/admin/products/' + product.id, edit)).status).toBe(409);
  for (const currency of ['ZAR', 'USD'])
    await Order.create({
      user: c.user.id,
      idempotencyKey: crypto.randomUUID(),
      items: [],
      currency,
      total: 10000,
      paymentStatus: 'paid',
      status: 'Processing',
      paidAt: new Date(),
    });
  const dashboard = await admin.agent.get('/api/admin/dashboard');
  expect(dashboard.status).toBe(200);
  expect(dashboard.body.data.monthly.map((m) => m.currency).sort()).toEqual(['USD', 'ZAR']);
});

test('unconfigured payment adapter does not reserve stock or create an order', async () => {
  app.locals.payments.assertReady = () => {
    throw Object.assign(new Error('Payments not configured'), { status: 503 });
  };
  const c = await client();
  expect((await c.send('post', '/api/orders', input())).status).toBe(503);
  expect(await Order.countDocuments()).toBe(0);
  expect((await Product.findById(product.id)).variants[0].stock).toBe(product.variants[0].stock);
});
