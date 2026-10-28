import {
  Product,
  Category,
  Cart,
  Order,
  Review,
  PrintRequest,
  Settings,
  User,
  Coupon,
} from '../models/index.js';
import { ok, fail, owner } from '../middleware/core.js';
import * as orders from '../services/orders.js';
import * as requests from '../services/requests.js';
import * as uploads from '../services/uploads.js';
export const catalog = async (req, res) => {
  const q = req.query;
  const page = Math.max(1, Math.min(10000, Number(q.page) || 1));
  const filter = { active: true };
  if (q.search) {
    const escaped = String(q.search)
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }
  if (q.category && /^[a-f0-9]{24}$/i.test(q.category)) filter.category = q.category;
  if (q.featured === 'true') filter.featured = true;
  const variant = {};
  if (q.material) variant.material = String(q.material);
  if (q.colour) variant.colour = String(q.colour);
  if (q.min || q.max)
    variant.price = {
      ...(Number.isFinite(Number(q.min)) ? { $gte: Math.max(0, Number(q.min)) } : {}),
      ...(q.max && Number.isFinite(Number(q.max)) ? { $lte: Number(q.max) } : {}),
    };
  if (Object.keys(variant).length) filter.variants = { $elemMatch: variant };
  const sort = {
    newest: { createdAt: -1 },
    price: { 'variants.price': 1 },
    'price-desc': { 'variants.price': -1 },
    name: { name: 1 },
  }[q.sort] || { createdAt: -1 };
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category')
      .sort(sort)
      .skip((page - 1) * 12)
      .limit(12),
    Product.countDocuments(filter),
  ]);
  ok(res, { products, total, page, pages: Math.ceil(total / 12) });
};
export const product = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, active: true }).populate(
    'category',
  );
  if (!product) fail(404, 'Product not found');
  const reviews = await Review.find({ product: product._id, approved: true })
    .sort({ createdAt: -1 })
    .limit(100);
  ok(res, { product, reviews });
};
export const categories = async (req, res) => ok(res, await Category.find().sort({ name: 1 }));
export const settings = async (req, res) => ok(res, await orders.settings());
export const cart = async (req, res) =>
  ok(res, (await Cart.findOne({ user: req.user._id })) || { items: [] });
export const saveCart = async (req, res) => {
  for (const i of req.body.items) {
    const p = await Product.findOne({ _id: i.product, active: true });
    if (!p?.variants.id(i.variant)) fail(422, 'Invalid cart item');
  }
  ok(
    res,
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: req.body.items } },
      { upsert: true, new: true },
    ),
  );
};
export const estimate = async (req, res) => ok(res, await orders.calculate(req.body));
export const checkout = async (req, res) =>
  ok(res, await orders.createOrder(req.user, req.body, req.app.locals.payments), 201);
export const listOrders = async (req, res) =>
  ok(
    res,
    await Order.find(
      req.user.role === 'admin' && req.query.all === 'true' ? {} : { user: req.user._id },
    )
      .sort({ createdAt: -1 })
      .limit(200),
  );
export const order = async (req, res) =>
  ok(res, owner(await Order.findById(req.params.id), req.user));
export const updateOrder = async (req, res) =>
  ok(res, await orders.updateOrder(req.params.id, req.body));
export const refund = async (req, res) =>
  ok(res, await orders.refundOrder(req.params.id, req.app.locals.payments));
export const listRequests = async (req, res) =>
  ok(
    res,
    await PrintRequest.find(
      req.user.role === 'admin' && req.query.all === 'true' ? {} : { user: req.user._id },
    )
      .sort({ createdAt: -1 })
      .limit(200),
  );
export const request = async (req, res) =>
  ok(res, owner(await PrintRequest.findById(req.params.id), req.user));
export const createRequest = async (req, res) =>
  ok(res, await requests.create(req.user, req.body), 201);
export const message = async (req, res) =>
  ok(res, await requests.message(req.user, req.params.id, req.body.text));
export const quote = async (req, res) => ok(res, await requests.quote(req.params.id, req.body));
export const decide = async (req, res) =>
  ok(res, await requests.decide(req.user, req.params.id, req.body));
export const payQuote = async (req, res) =>
  ok(res, await orders.quoteOrder(req.user, req.params.id, req.body, req.app.locals.payments), 201);
export const upload = async (req, res) =>
  ok(res, await uploads.upload(req.user, req.file, req.params.kind), 201);
export const download = async (req, res) =>
  ok(res, await uploads.download(req.user, req.params.id));
export const image = async (req, res) => res.redirect(await uploads.imageUrl(req.params.id));
export const review = async (req, res) => {
  if (
    !(await Order.exists({
      user: req.user._id,
      paymentStatus: 'paid',
      'items.product': req.body.product,
    }))
  )
    fail(403, 'Reviews are available after purchase');
  ok(
    res,
    await Review.findOneAndUpdate(
      { user: req.user._id, product: req.body.product },
      {
        $set: {
          rating: req.body.rating,
          text: req.body.text,
          name: req.user.name,
          approved: false,
        },
      },
      { upsert: true, new: true },
    ),
  );
};
export const dashboard = async (req, res) => {
  const [summary, top, monthly, lowStock, queue] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: '$currency', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', units: { $sum: '$items.quantity' } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
            currency: '$currency',
          },
          revenue: { $sum: '$total' },
        },
      },
      {
        $project: {
          _id: { $concat: ['$_id.month', ' / ', '$_id.currency'] },
          currency: '$_id.currency',
          revenue: 1,
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 24 },
      { $sort: { _id: 1 } },
    ]),
    Product.find({ active: true, 'variants.stock': { $lt: 5 } }).limit(25),
    PrintRequest.find({ status: { $in: ['Submitted', 'Quoted', 'Accepted', 'Printing'] } })
      .sort({ deadline: 1 })
      .limit(50),
  ]);
  ok(res, { summary, top, monthly, lowStock, queue });
};
export const adminProducts = async (req, res) =>
  ok(res, await Product.find().populate('category').sort({ createdAt: -1 }).limit(200));
export const saveProduct = async (req, res) => {
  if (!(await Category.exists({ _id: req.body.category }))) fail(422, 'Invalid category');
  if (req.params.id) {
    const saved = await orders.transaction(async (session) => {
      const existing = await Product.findById(req.params.id).session(session);
      if (!existing) fail(404, 'Product not found');
      if (
        await Order.exists({ paymentStatus: 'pending', 'items.product': existing._id }).session(
          session,
        )
      )
        fail(409, 'Product has active checkout reservations; retry after checkout expires');
      existing.set(req.body);
      await existing.save({ session });
      return existing;
    });
    ok(res, saved);
  } else ok(res, await Product.create(req.body), 201);
};
export const deleteProduct = async (req, res) => {
  const p = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: { active: false } },
    { new: true },
  );
  if (!p) fail(404, 'Product not found');
  ok(res, p);
};
export const createCategory = async (req, res) => ok(res, await Category.create(req.body), 201);
export const users = async (req, res) =>
  ok(res, await User.find().select('name email role blocked createdAt').limit(200));
export const updateUser = async (req, res) => {
  if (req.params.id === req.user.id) fail(409, 'You cannot block your own account');
  const u = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { blocked: req.body.blocked }, $inc: { tokenVersion: 1 } },
    { new: true },
  );
  if (!u) fail(404, 'User not found');
  ok(res, { id: u.id, blocked: u.blocked });
};
export const reviews = async (req, res) =>
  ok(res, await Review.find().sort({ createdAt: -1 }).limit(200));
export const moderate = async (req, res) =>
  ok(
    res,
    await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { approved: req.body.approved } },
      { new: true },
    ),
  );
export const coupons = async (req, res) => ok(res, await Coupon.find().sort({ createdAt: -1 }));
export const saveCoupon = async (req, res) =>
  ok(
    res,
    await Coupon.findOneAndUpdate(
      { code: req.body.code.toUpperCase() },
      { $set: req.body },
      { upsert: true, new: true, runValidators: true },
    ),
  );
export const saveSettings = async (req, res) => {
  const current = await orders.settings();
  if (req.body.currency !== current.currency && (await Order.exists({ paymentStatus: 'pending' })))
    fail(409, 'Wait for pending checkouts before changing currency');
  current.set(req.body);
  await current.save();
  ok(res, current);
};
