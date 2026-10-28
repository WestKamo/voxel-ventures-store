import nodemailer from 'nodemailer';
import { EmailJob } from '../models/index.js';
import { env } from '../config/env.js';
export const enqueueEmail = (key, to, subject, text, session) =>
  EmailJob.updateOne({ key }, { $setOnInsert: { to, subject, text } }, { upsert: true, session });
export async function deliverEmails() {
  if (!env.SMTP_HOST) return;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  for (let i = 0; i < 10; i++) {
    const job = await EmailJob.findOneAndUpdate(
      {
        sentAt: { $exists: false },
        nextAttempt: { $lte: new Date() },
        $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: new Date() } }],
      },
      { $set: { lockedUntil: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } },
      { new: true },
    );
    if (!job) break;
    try {
      await transport.sendMail({
        from: env.EMAIL_FROM,
        to: job.to,
        subject: job.subject,
        text: job.text,
      });
      job.sentAt = new Date();
    } catch {
      job.nextAttempt = new Date(Date.now() + Math.min(3600000, 2 ** job.attempts * 30000));
    }
    job.lockedUntil = undefined;
    await job.save();
  }
}
