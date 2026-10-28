import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import sharp from 'sharp';
import { unzipSync } from 'fflate';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { Upload } from '../models/index.js';
import { fail, owner } from '../middleware/core.js';
const client = () =>
  new S3Client({
    region: env.S3_REGION || 'us-east-1',
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials: env.S3_ACCESS_KEY_ID
      ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
export function validateModel(buffer, extension) {
  if (extension === '.stl') {
    if (buffer.length >= 84 && 84 + buffer.readUInt32LE(80) * 50 === buffer.length) return;
    const t = buffer.toString('utf8');
    if (
      /^\s*solid\b/.test(t) &&
      /facet\s+normal/.test(t) &&
      /endsolid/.test(t) &&
      !/[^\x09\x0a\x0d\x20-\x7e]/.test(t)
    )
      return;
  }
  if (extension === '.obj') {
    const t = buffer.toString('utf8');
    if (
      /^v\s+[-+.\d]/m.test(t) &&
      /^f\s+\d/m.test(t) &&
      !/^\s*(call|csh|mtllib)\b/m.test(t) &&
      !/[^\x09\x0a\x0d\x20-\x7e]/.test(t)
    )
      return;
  }
  if (extension === '.3mf') {
    let total = 0;
    try {
      const files = unzipSync(buffer, {
        filter: (f) => {
          total += f.originalSize;
          if (
            total > 50 * 1024 * 1024 ||
            f.originalSize > 20 * 1024 * 1024 ||
            f.name.includes('..')
          )
            throw new Error('Archive limits exceeded');
          return /\.model$|\[Content_Types\]\.xml$/.test(f.name);
        },
      });
      const models = Object.entries(files).filter(([n]) => n.endsWith('.model'));
      if (
        models.length &&
        models.every(([, b]) => {
          const t = new TextDecoder().decode(b);
          return (
            t.includes('<model') &&
            !/<!DOCTYPE|<!ENTITY|https?:/i.test(t.replace(/xmlns[^=]*="[^"]*"/g, ''))
          );
        })
      )
        return;
    } catch {
      fail(422, 'Invalid or oversized 3MF archive');
    }
  }
  fail(422, 'Invalid model content. Use a standalone STL, OBJ, or 3MF file.');
}
export async function scan(buffer) {
  if (!env.CLAMAV_HOST) fail(503, 'Model uploads require the malware scanner to be configured');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: env.CLAMAV_HOST,
      port: Number(env.CLAMAV_PORT || 3310),
    });
    let response = '';
    socket.setTimeout(20000);
    socket.on('timeout', () => socket.destroy(new Error('Scanner timeout')));
    socket.on('error', () =>
      reject(Object.assign(new Error('Malware scanner unavailable'), { status: 503 })),
    );
    socket.on('data', (chunk) => {
      response += chunk.toString();
      if (response.includes('\0')) socket.end();
    });
    socket.on('end', () =>
      response.includes('stream: OK')
        ? resolve()
        : reject(Object.assign(new Error('File did not pass malware scanning'), { status: 422 })),
    );
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let i = 0; i < buffer.length; i += 65536) {
        const part = buffer.subarray(i, i + 65536);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(part.length);
        socket.write(size);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
export async function upload(user, file, kind) {
  if (!file) fail(422, 'Choose a file');
  if (!env.S3_BUCKET) fail(503, 'File storage is not configured');
  let body = file.buffer;
  let ext = path.extname(file.originalname).toLowerCase();
  let type = 'application/octet-stream';
  if (kind === 'image') {
    if (user.role !== 'admin') fail(403, 'Administrator access required');
    try {
      body = await sharp(body, { limitInputPixels: 25000000 })
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      fail(422, 'Invalid image');
    }
    ext = '.webp';
    type = 'image/webp';
  } else {
    if (!['.stl', '.obj', '.3mf'].includes(ext)) fail(422, 'Unsupported model extension');
    validateModel(body, ext);
    await scan(body);
  }
  const key = (kind === 'image' ? 'products/' : 'private/') + crypto.randomUUID() + ext;
  await client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: type,
      ContentDisposition: kind === 'model' ? 'attachment' : undefined,
    }),
  );
  return Upload.create({
    user: user._id,
    key,
    name: path.basename(file.originalname).slice(0, 180),
    kind,
    size: body.length,
    scanned: true,
  });
}
export async function download(user, id) {
  const upload = owner(await Upload.findById(id), user);
  return {
    url: await getSignedUrl(
      client(),
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: upload.key,
        ResponseContentDisposition: 'attachment; filename="model' + path.extname(upload.key) + '"',
      }),
      { expiresIn: 300 },
    ),
  };
}
export async function imageUrl(id) {
  const upload = await Upload.findOne({ _id: id, kind: 'image' });
  if (!upload) fail(404, 'Image not found');
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: upload.key }), {
    expiresIn: 900,
  });
}
