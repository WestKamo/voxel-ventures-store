import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, Session } from '../models/index.js';
import { env } from '../config/env.js';
import { cookieOptions, fail } from '../middleware/core.js';
export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  forcePasswordChange: u.forcePasswordChange,
  addresses: u.addresses,
  wishlist: u.wishlist,
});
export async function issue(user, res, family = crypto.randomUUID()) {
  const refresh = crypto.randomBytes(48).toString('hex');
  await Session.create({
    user: user._id,
    hash: hash(refresh),
    family,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie(
    'access',
    jwt.sign({ version: user.tokenVersion }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: '15m',
      issuer: 'voxel',
      audience: 'voxel-client',
    }),
    { ...cookieOptions, maxAge: 900000 },
  );
  res.cookie('refresh', refresh, { ...cookieOptions, maxAge: 7 * 86400000 });
  return publicUser(user);
}
export async function register(data, res) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({ name: data.name, email: data.email, passwordHash });
  return issue(user, res);
}
export async function login(data, res) {
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  if (!user || user.blocked || !(await bcrypt.compare(data.password, user.passwordHash)))
    fail(401, 'Invalid email or password');
  return issue(user, res);
}
export async function refresh(req, res) {
  const old = await Session.findOneAndUpdate(
    { hash: hash(req.cookies.refresh || ''), revoked: false, expiresAt: { $gt: new Date() } },
    { $set: { revoked: true } },
    { new: false },
  );
  if (!old) {
    const used = await Session.findOne({ hash: hash(req.cookies.refresh || '') });
    if (used) await Session.updateMany({ family: used.family }, { $set: { revoked: true } });
    fail(401, 'Session expired');
  }
  const user = await User.findById(old.user);
  if (!user || user.blocked) fail(401, 'Session expired');
  return issue(user, res, old.family);
}
export async function changePassword(user, current, password) {
  const stored = await User.findById(user._id).select('+passwordHash');
  if (!(await bcrypt.compare(current, stored.passwordHash)))
    fail(401, 'Current password is incorrect');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      stored.passwordHash = await bcrypt.hash(password, 12);
      stored.forcePasswordChange = false;
      stored.tokenVersion++;
      await stored.save({ session });
      await Session.deleteMany({ user: user._id }, { session });
    });
  } finally {
    await session.endSession();
  }
  return stored;
}
