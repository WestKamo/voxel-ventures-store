import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import * as a from '../controllers/auth.js';
import * as s from '../controllers/store.js';
import * as v from './schemas.js';
import { wrap, auth, admin, changedPassword, validate } from '../middleware/core.js';
import { env } from '../config/env.js';
const router = Router();
const route = (method, path, handler, ...middleware) =>
  router[method](path, ...middleware, wrap(handler));
const signed = [auth, changedPassword];
const staff = [...signed, admin];
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
router.use('/auth', authLimit);
route('get', '/auth/csrf', a.csrf);
route(
  'post',
  '/auth/register',
  a.register,
  validate(z.object({ name: v.text(100), email: v.email, password: v.password }).strict()),
);
route(
  'post',
  '/auth/login',
  a.login,
  validate(z.object({ email: v.email, password: z.string().min(1).max(72) })),
);
route('post', '/auth/refresh', a.refresh);
route('post', '/auth/logout', a.logout);
route('get', '/auth/me', a.me, auth);
route('post', '/auth/forgot-password', a.forgot, validate(z.object({ email: v.email })));
route(
  'post',
  '/auth/reset-password',
  a.reset,
  validate(z.object({ token: v.text(100), password: v.password })),
);
route(
  'post',
  '/auth/password',
  a.password,
  auth,
  validate(z.object({ currentPassword: z.string().min(1).max(72), password: v.password })),
);
route(
  'put',
  '/auth/profile',
  a.profile,
  ...signed,
  validate(z.object({ name: v.text(100), addresses: z.array(v.address).max(10) })),
);
route(
  'put',
  '/auth/wishlist',
  a.wishlist,
  ...signed,
  validate(z.object({ products: z.array(v.id).max(100) })),
);
route('get', '/products', s.catalog);
route('get', '/products/:slug', s.product);
route('get', '/categories', s.categories);
route('get', '/settings', s.settings);
route('get', '/images/:id', s.image);
route('get', '/cart', s.cart, ...signed);
route('put', '/cart', s.saveCart, ...signed, validate(z.object({ items: v.items })));
route('post', '/orders/estimate', s.estimate, ...signed, validate(v.checkout));
route('post', '/orders', s.checkout, ...signed, validate(v.checkout));
route('get', '/orders', s.listOrders, ...signed);
route('get', '/orders/:id', s.order, ...signed);
route('get', '/requests', s.listRequests, ...signed);
route('post', '/requests', s.createRequest, ...signed, validate(v.request));
route('get', '/requests/:id', s.request, ...signed);
route(
  'post',
  '/requests/:id/messages',
  s.message,
  ...signed,
  validate(z.object({ text: v.text(3000) })),
);
route(
  'post',
  '/requests/:id/decision',
  s.decide,
  ...signed,
  validate(z.object({ accept: z.boolean(), version: z.number().int().positive() })),
);
route(
  'post',
  '/requests/:id/pay',
  s.payQuote,
  ...signed,
  validate(
    z.object({ address: v.address, shippingMethod: v.id, idempotencyKey: z.string().uuid() }),
  ),
);
route(
  'post',
  '/reviews',
  s.review,
  ...signed,
  validate(z.object({ product: v.id, rating: z.number().int().min(1).max(5), text: v.text(2000) })),
);
const uploadLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1, fields: 0 },
});
route(
  'post',
  '/uploads/:kind',
  s.upload,
  ...signed,
  uploadLimit,
  (req, res, next) => (['image', 'model'].includes(req.params.kind) ? next() : res.sendStatus(404)),
  upload.single('file'),
);
route('get', '/uploads/:id/download', s.download, ...signed);
router.use('/admin', ...staff);
route('get', '/admin/dashboard', s.dashboard);
route('get', '/admin/products', s.adminProducts);
route('post', '/admin/products', s.saveProduct, validate(v.product));
route('put', '/admin/products/:id', s.saveProduct, validate(v.product));
route('delete', '/admin/products/:id', s.deleteProduct);
route(
  'post',
  '/admin/categories',
  s.createCategory,
  validate(
    z.object({
      name: v.text(80),
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(100),
    }),
  ),
);
route(
  'put',
  '/admin/orders/:id',
  s.updateOrder,
  validate(
    z.object({
      status: z.enum(['Processing', 'Printing', 'Shipped', 'Completed']),
      trackingNumber: z.string().max(100).optional(),
    }),
  ),
);
route('post', '/admin/orders/:id/refund', s.refund);
route(
  'post',
  '/admin/requests/:id/quote',
  s.quote,
  validate(
    z.object({
      price: z.number().int().positive().max(100000000),
      leadDays: z.number().int().min(1).max(365),
      notes: z.string().max(3000).default(''),
      expiresAt: z
        .string()
        .datetime()
        .refine((d) => Date.parse(d) > Date.now()),
    }),
  ),
);
route('get', '/admin/users', s.users);
route('put', '/admin/users/:id', s.updateUser, validate(z.object({ blocked: z.boolean() })));
route('get', '/admin/reviews', s.reviews);
route('put', '/admin/reviews/:id', s.moderate, validate(z.object({ approved: z.boolean() })));
route('get', '/admin/coupons', s.coupons);
route(
  'put',
  '/admin/coupons',
  s.saveCoupon,
  validate(
    z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9-]{3,30}$/)
        .transform((s) => s.toUpperCase()),
      percent: z.number().int().min(1).max(80),
      minimum: z.number().int().min(0),
      expiresAt: z.string().datetime(),
      active: z.boolean(),
    }),
  ),
);
route(
  'put',
  '/admin/settings',
  s.saveSettings,
  validate(
    z.object({
      currency: z.string().regex(/^[A-Z]{3}$/),
      taxBasisPoints: z.number().int().min(0).max(5000),
      shipping: z
        .array(
          z.object({
            _id: v.id.optional(),
            name: v.text(80),
            price: z.number().int().min(0).max(100000),
          }),
        )
        .min(1)
        .max(10),
      contactEmail: v.email,
      whatsapp: z.string().regex(/^$|^[0-9]{8,15}$/),
    }),
  ),
);
export default router;
