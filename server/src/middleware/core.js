import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env, production } from '../config/env.js';
import { User } from '../models/index.js';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success)
    return res.status(422).json({
      success: false,
      error: { message: 'Please check the submitted fields', fields: result.error.flatten() },
    });
  req.body = result.data;
  next();
};
export const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: env.COOKIE_SAME_SITE,
  path: '/',
};
const sign = (value) => crypto.createHmac('sha256', env.CSRF_SECRET).update(value).digest('hex');
export const csrfToken = (req, res) => {
  const nonce = crypto.randomBytes(24).toString('hex');
  const token = nonce + '.' + sign(nonce);
  res.cookie('csrf', token, { ...cookieOptions, maxAge: 86400000 });
  return token;
};
export function csrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !env.CORS_ORIGINS.split(',').includes(origin))
    return next(new HttpError(403, 'Origin not permitted'));
  const token = req.get('x-csrf-token');
  const [nonce, mac] = String(token || '').split('.');
  if (
    !token ||
    token !== req.cookies.csrf ||
    !mac ||
    !/^[a-f0-9]{64}$/.test(mac) ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sign(nonce)))
  )
    return next(new HttpError(403, 'Invalid CSRF token'));
  next();
}
export const auth = wrap(async (req, res, next) => {
  try {
    const decoded = jwt.verify(req.cookies.access || '', env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'voxel',
      audience: 'voxel-client',
    });
    req.user = await User.findById(decoded.sub);
    if (!req.user || req.user.blocked || req.user.tokenVersion !== decoded.version)
      fail(401, 'Please sign in');
  } catch {
    fail(401, 'Please sign in');
  }
  next();
});
export const changedPassword = (req, res, next) =>
  req.user.forcePasswordChange
    ? next(new HttpError(403, 'Change your password before continuing'))
    : next();
export const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : next(new HttpError(403, 'Administrator access required'));
export const owner = (record, user) => {
  if (!record) fail(404, 'Not found');
  if (String(record.user) !== String(user._id) && user.role !== 'admin') fail(404, 'Not found');
  return record;
};
export function errors(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  if (err.name === 'CastError') status = 400;
  if (err.code === 11000) status = 409;
  if (err.name === 'ValidationError' || err.name === 'StrictModeError') status = 422;
  if (err.code === 'LIMIT_FILE_SIZE') status = 413;
  if (err.name === 'MulterError') status = 400;
  if (status === 500) console.error('Request failed', err.name, err.message);
  res.status(status).json({
    success: false,
    error: {
      message:
        status === 500
          ? 'Something went wrong. Please try again.'
          : err.code === 11000
            ? 'That record already exists'
            : err.message,
    },
  });
}
