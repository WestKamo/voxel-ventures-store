import { z } from 'zod';
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(5000),
    MONGODB_URI: z.string().min(1),
    CLIENT_URL: z.string().url(),
    CORS_ORIGINS: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).default('lax'),
    TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0),
    CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('ZAR'),
    UPLOAD_MAX_MB: z.coerce.number().min(1).max(50).default(20),
  })
  .passthrough();
export const env = schema.parse(process.env);
export const production = env.NODE_ENV === 'production';
