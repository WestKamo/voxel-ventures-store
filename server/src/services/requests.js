import { PrintRequest, Upload, User } from '../models/index.js';
import { owner, fail } from '../middleware/core.js';
import { transaction, settings } from './orders.js';
import { enqueueEmail } from './email.js';
export async function create(user, input) {
  if (input.file) {
    const file = await Upload.findOne({
      _id: input.file,
      user: user._id,
      kind: 'model',
      scanned: true,
    });
    if (!file) fail(422, 'A scanned model owned by you is required');
  }
  return PrintRequest.create({
    ...input,
    user: user._id,
    history: [{ status: 'Submitted', at: new Date() }],
  });
}
export async function message(user, id, text) {
  const req = owner(await PrintRequest.findById(id), user);
  if (req.messages.length >= 500) fail(422, 'Message limit reached');
  return PrintRequest.findByIdAndUpdate(
    id,
    { $push: { messages: { author: user._id, name: user.name, text, at: new Date() } } },
    { new: true },
  );
}
export async function quote(id, input) {
  return transaction(async (session) => {
    const req = await PrintRequest.findById(id).session(session);
    if (!req) fail(404, 'Request not found');
    if (req.order || ['Printing', 'Shipped', 'Completed'].includes(req.status))
      fail(409, 'This request cannot be requoted');
    req.quote = {
      ...input,
      currency: (await settings(session)).currency,
      version: (req.quote?.version || 0) + 1,
    };
    req.status = 'Quoted';
    req.history.push({ status: 'Quoted', at: new Date() });
    await req.save({ session });
    const user = await User.findById(req.user).session(session);
    await enqueueEmail(
      'quote:' + req.id + ':' + req.quote.version,
      user.email,
      'Your custom print quote is ready',
      `Review your quote in your Voxel Ventures account. Lead time: ${input.leadDays} working days.`,
      session,
    );
    return req;
  });
}
export async function decide(user, id, input) {
  return transaction(async (session) => {
    const req = owner(await PrintRequest.findById(id).session(session), user);
    if (String(req.user) !== user.id)
      fail(403, 'Only the customer can accept or decline their quote');
    if (
      req.status !== 'Quoted' ||
      req.quote.version !== input.version ||
      req.quote.expiresAt < new Date()
    )
      fail(409, 'Quote has changed or expired. Refresh this page.');
    req.status = input.accept ? 'Accepted' : 'Declined';
    req.history.push({ status: req.status, at: new Date() });
    await req.save({ session });
    return req;
  });
}
