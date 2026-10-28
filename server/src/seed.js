import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { env } from './config/env.js';
import { User, Category, Product, Coupon, Settings } from './models/index.js';
export async function seed() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD)
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before seeding');
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (!existing)
    await User.create({
      name: 'Store administrator',
      email,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
      role: 'admin',
      forcePasswordChange: true,
    });
  else if (existing.role !== 'admin')
    throw new Error(
      'Seed email belongs to a non-admin account; refusing automatic privilege escalation',
    );
  const categories = [];
  for (const [name, slug] of [
    ['Living objects', 'living-objects'],
    ['Desk essentials', 'desk-essentials'],
    ['Play & collect', 'play-collect'],
  ])
    categories.push(
      await Category.findOneAndUpdate(
        { slug },
        { $setOnInsert: { name, slug } },
        { upsert: true, new: true },
      ),
    );
  const objects = [
    [
      'Contour planter',
      'contour-planter',
      0,
      24900,
      'An architectural little home for your favourite plant. A layered silhouette with a removable inner tray. Decorative indoor use.',
    ],
    [
      'Orbit desk dock',
      'orbit-desk-dock',
      1,
      18900,
      'A quieter desk starts here. Keep your everyday essentials together in a sculptural, compact organiser.',
    ],
    [
      'Ripple vessel',
      'ripple-vessel',
      0,
      32900,
      'Soft curves, visible layers, and a warm presence. A decorative vessel for dried stems and considered spaces. Not watertight.',
    ],
    [
      'Voxel companion',
      'voxel-companion',
      2,
      14900,
      'A geometric character with a playful point of view. A small display object for shelves, desks, and thoughtful gifts.',
    ],
    [
      'Arc phone stand',
      'arc-phone-stand',
      1,
      17900,
      'A simple resting place for your screen. Designed for everyday desk use with a sculptural arched profile.',
    ],
    [
      'Modular cable nest',
      'modular-cable-nest',
      1,
      9900,
      'Bring a little order to everyday cables. A compact, practical object with a satisfyingly layered finish.',
    ],
  ];
  for (const [name, slug, category, price, description] of objects)
    await Product.updateOne(
      { slug },
      {
        $setOnInsert: {
          name,
          slug,
          description,
          category: categories[category]._id,
          featured: true,
          images: [],
          active: true,
          variants: [
            {
              sku: slug.toUpperCase() + '-G',
              material: 'PLA',
              colour: 'Graphite',
              size: 'Standard',
              price,
              stock: 15,
            },
            {
              sku: slug.toUpperCase() + '-B',
              material: 'PLA',
              colour: 'Bone',
              size: 'Standard',
              price: price + 2000,
              stock: 10,
            },
            {
              sku: slug.toUpperCase() + '-L',
              material: 'PETG',
              colour: 'Lime',
              size: 'Large',
              price: price + 7000,
              stock: 6,
            },
          ],
        },
      },
      { upsert: true },
    );
  for (const [code, percent, minimum] of [
    ['WELCOME10', 10, 0],
    ['STUDIO15', 15, 100000],
    ['LAYER20', 20, 200000],
  ])
    await Coupon.updateOne(
      { code },
      {
        $setOnInsert: {
          code,
          percent,
          minimum,
          active: true,
          expiresAt: new Date(Date.now() + 365 * 86400000),
        },
      },
      { upsert: true },
    );
  await Settings.updateOne(
    { key: 'store' },
    {
      $setOnInsert: {
        key: 'store',
        currency: env.CURRENCY,
        taxBasisPoints: 0,
        shipping: [
          { name: 'Standard courier', price: 8500 },
          { name: 'Studio collection', price: 0 },
        ],
        contactEmail: email,
        whatsapp: '',
      },
    },
    { upsert: true },
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mongoose.connect(env.MONGODB_URI);
  try {
    await seed();
    console.log('Seed complete. Existing records and passwords were preserved.');
  } finally {
    await mongoose.disconnect();
  }
}
