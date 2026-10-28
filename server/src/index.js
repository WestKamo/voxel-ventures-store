import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { deliverEmails } from './services/email.js';
import { expireReservations } from './services/orders.js';
await mongoose.connect(env.MONGODB_URI);
const app = createApp();
const server = app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`Voxel API listening on ${env.PORT}`),
);
let working = false;
const timer = setInterval(async () => {
  if (working) return;
  working = true;
  try {
    await expireReservations(app.locals.payments);
    await deliverEmails();
  } catch (err) {
    console.error('Background processing failed', err.message);
  } finally {
    working = false;
  }
}, 30000);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
