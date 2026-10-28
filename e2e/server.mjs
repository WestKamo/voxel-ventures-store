import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost/test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.JWT_SECRET = 'e2e-access-secret-at-least-32-characters';
process.env.CSRF_SECRET = 'e2e-csrf-secret-at-least-32-characters';
process.env.ADMIN_EMAIL = 'admin@voxel.test';
process.env.ADMIN_PASSWORD = 'Initial-admin-password';
const db = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } });
await mongoose.connect(db.getUri());
const { seed } = await import('../server/src/seed.js');
await seed();
const { createApp } = await import('../server/src/app.js');
const { Order, User, Settings } = await import('../server/src/models/index.js');
const user = await User.findOne();
await Order.create({
  user: user._id,
  idempotencyKey: 'e2e-paid-order',
  items: [{ name: 'Admin workflow fixture', quantity: 1, price: 10000 }],
  address: { name: 'Fixture Customer', line1: '1 Test Road', city: 'Durban' },
  subtotal: 10000,
  discount: 0,
  shipping: 0,
  tax: 0,
  total: 10000,
  currency: 'ZAR',
  paymentStatus: 'paid',
  status: 'Processing',
  paidAt: new Date(),
  history: [{ status: 'Processing', at: new Date() }],
});
// Test-only provider is injected here, never selected by a production environment flag.
const app = createApp({
  payments: {
    checkout: async (order) => ({
      id: 'cs_e2e_' + order.id,
      url: 'http://localhost:5173/orders/' + order.id,
    }),
    event() {
      throw new Error('No test webhook');
    },
    retrieve: async () => ({ status: 'expired' }),
    refund: async () => ({ status: 'succeeded' }),
  },
});
const server = app.listen(5000);
console.log('E2E API ready');
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      await db.stop();
      process.exit(0);
    }),
  );
