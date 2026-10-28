import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User, Session } from '../models/index.js';
import { env } from '../config/env.js';
import { ok, fail, cookieOptions, csrfToken } from '../middleware/core.js';
import * as service from '../services/auth.js';
import { enqueueEmail } from '../services/email.js';
export const csrf = (req, res) => ok(res, { token: csrfToken(req, res) });
export const register = async (req, res) => ok(res, await service.register(req.body, res), 201);
export const login = async (req, res) => ok(res, await service.login(req.body, res));
export const refresh = async (req, res) => ok(res, await service.refresh(req, res));
export const me = (req, res) => ok(res, service.publicUser(req.user));
export const logout = async (req, res) => {
  await Session.deleteMany({ hash: service.hash(req.cookies.refresh || '') });
  res.clearCookie('access', cookieOptions);
  res.clearCookie('refresh', cookieOptions);
  ok(res, { message: 'Signed out' });
};
export const password = async (req, res) => {
  const user = await service.changePassword(req.user, req.body.currentPassword, req.body.password);
  ok(res, await service.issue(user, res));
};
export const forgot = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetHash = service.hash(token);
    user.resetExpires = new Date(Date.now() + 1800000);
    await user.save();
    await enqueueEmail(
      'reset:' + user.resetHash,
      user.email,
      'Reset your Voxel Ventures password',
      `Reset your password within 30 minutes: ${env.CLIENT_URL}/reset-password/${token}`,
    );
  }
  ok(res, { message: 'If this account exists, a reset link will be emailed.' });
};
export const reset = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({
        resetHash: service.hash(req.body.token),
        resetExpires: { $gt: new Date() },
      }).session(session);
      if (!user) fail(400, 'Reset link is invalid or expired');
      user.passwordHash = await bcrypt.hash(req.body.password, 12);
      user.resetHash = undefined;
      user.resetExpires = undefined;
      user.forcePasswordChange = false;
      user.tokenVersion++;
      await user.save({ session });
      await Session.deleteMany({ user: user._id }, { session });
    });
  } finally {
    await session.endSession();
  }
  ok(res, { message: 'Password changed. Please sign in.' });
};
export const profile = async (req, res) => {
  req.user.name = req.body.name;
  req.user.addresses = req.body.addresses;
  await req.user.save();
  ok(res, service.publicUser(req.user));
};
export const wishlist = async (req, res) => {
  req.user.wishlist = req.body.products;
  await req.user.save();
  ok(res, req.user.wishlist);
};
