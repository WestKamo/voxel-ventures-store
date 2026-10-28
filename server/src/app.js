import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { rateLimit } from 'express-rate-limit';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { csrf, errors, wrap, ok, HttpError } from './middleware/core.js';
import router from './routes/index.js';
import { stripeProvider } from './services/payments.js';
import { webhook } from './services/orders.js';
export function createApp({ payments = stripeProvider() } = {}) {
  const app = express();
  app.locals.payments = payments;
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        cb(
          origin && !env.CORS_ORIGINS.split(',').includes(origin)
            ? new HttpError(403, 'Origin not permitted')
            : null,
          true,
        );
      },
      credentials: true,
    }),
  );
  if (env.NODE_ENV !== 'test') app.use(morgan(':method :status :response-time ms'));
  app.get('/health', (req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' }),
  );
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    wrap(async (req, res) => {
      await webhook(payments.event(req.body, req.get('stripe-signature')));
      ok(res, { received: true });
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: env.NODE_ENV === 'test' ? 10000 : 200,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(csrf);
  app.use('/api', router);
  app.use((req, res, next) => next(new HttpError(404, 'Route not found')));
  app.use(errors);
  return app;
}
