import { z } from 'zod';
export const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid ID');
export const text = (n = 200) => z.string().trim().min(1).max(n);
export const password = z
  .string()
  .min(12)
  .max(72)
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');
export const email = z.string().trim().email().toLowerCase();
export const address = z.object({
  name: text(100),
  line1: text(),
  line2: z.string().max(200).default(''),
  city: text(100),
  province: text(100),
  postalCode: text(20),
  country: z.literal('ZA').default('ZA'),
  phone: text(30),
});
export const items = z
  .array(z.object({ product: id, variant: id, quantity: z.number().int().min(1).max(99) }))
  .max(30);
export const product = z
  .object({
    name: text(160),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(180),
    description: text(6000),
    category: id,
    images: z
      .array(
        z
          .string()
          .refine(
            (u) => /^upload:[a-f0-9]{24}$/i.test(u) || (/^https:\/\//.test(u) && URL.canParse(u)),
            'Use an HTTPS URL or uploaded image',
          ),
      )
      .max(8)
      .default([]),
    modelUrl: z.string().url().startsWith('https://').optional().or(z.literal('')),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    variants: z
      .array(
        z.object({
          _id: id.optional(),
          sku: text(80),
          material: z.enum(['PLA', 'PETG', 'ABS', 'TPU', 'Resin']),
          colour: text(40),
          size: text(40),
          price: z.number().int().min(1).max(100000000),
          stock: z.number().int().min(0).max(100000),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine(
    (p) => new Set(p.variants.map((v) => v.sku)).size === p.variants.length,
    'SKUs must be unique',
  );
export const request = z.object({
  title: text(160),
  description: text(6000),
  material: z.enum(['PLA', 'PETG', 'ABS', 'TPU', 'Resin']),
  colour: text(40),
  dimensions: z.object({
    x: z.number().positive().max(1000),
    y: z.number().positive().max(1000),
    z: z.number().positive().max(1000),
  }),
  quantity: z.number().int().min(1).max(1000),
  deadline: z
    .string()
    .datetime()
    .refine((d) => Date.parse(d) > Date.now(), 'Deadline must be in the future')
    .optional(),
  file: id.optional(),
});
export const checkout = z.object({
  items: items.min(1),
  address,
  shippingMethod: id,
  coupon: z.string().max(40).default(''),
  idempotencyKey: z.string().uuid(),
});
