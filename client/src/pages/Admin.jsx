import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useResource } from '../lib/hooks';
import { api, money } from '../lib/api';
import { Heading, Field, Alert, Loading, Empty } from '../components/UI';
const sections = [
  'dashboard',
  'products',
  'orders',
  'requests',
  'users',
  'reviews',
  'coupons',
  'settings',
];
export default function Admin() {
  const { section = 'dashboard' } = useParams();
  const paths = {
    dashboard: '/admin/dashboard',
    products: '/admin/products',
    orders: '/orders?all=true',
    requests: '/requests?all=true',
    users: '/admin/users',
    reviews: '/admin/reviews',
    coupons: '/admin/coupons',
    settings: '/settings',
  };
  const resource = useResource(paths[section] || paths.dashboard);
  const settings = useResource('/settings');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const act = async (path, method, body) => {
    setError('');
    setNotice('');
    try {
      const result = await api(path, { method, body });
      resource.reload();
      settings.reload();
      setNotice('Saved successfully');
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };
  const safe = (...args) => act(...args).catch(() => {});
  const currency = settings.data?.currency;
  const data = resource.data;
  return (
    <section className="section admin">
      <Heading eyebrow="THE WORKSHOP / ADMIN" title="Make good things happen." />
      <nav className="admin-tabs" aria-label="Admin sections">
        {sections.map((s) => (
          <NavLink key={s} to={'/admin/' + s}>
            {s === 'requests' ? 'Print queue' : s}
          </NavLink>
        ))}
      </nav>
      <Alert>{error || resource.error}</Alert>
      <p role="status">{notice}</p>
      {resource.loading ? (
        <Loading />
      ) : (
        data && (
          <>
            {section === 'dashboard' && (
              <>
                <div className="stats">
                  <div className="panel">
                    <p>Revenue from paid orders</p>
                    <h2>
                      {data.summary.map((s) => money(s.revenue, s._id)).join(' / ') ||
                        money(0, currency)}
                    </h2>
                  </div>
                  <div className="panel">
                    <p>Paid orders</p>
                    <h2>{data.summary.reduce((n, s) => n + s.orders, 0)}</h2>
                  </div>
                  <div className="panel">
                    <p>Active custom projects</p>
                    <h2>{data.queue.length}</h2>
                  </div>
                </div>
                <div className="two-columns">
                  <div className="panel">
                    <h2>Monthly sales</h2>
                    {data.monthly.length ? (
                      <div className="chart" role="img" aria-label="Monthly revenue chart">
                        {data.monthly.map((m) => (
                          <div key={m._id}>
                            <span>{m._id}</span>
                            <div className="bar-track">
                              <div
                                style={{
                                  width:
                                    Math.max(
                                      2,
                                      (m.revenue /
                                        Math.max(...data.monthly.map((x) => x.revenue))) *
                                        100,
                                    ) + '%',
                                }}
                              />
                            </div>
                            <strong>{money(m.revenue, m.currency)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No paid sales yet.</p>
                    )}
                  </div>
                  <div className="panel">
                    <h2>Top objects</h2>
                    {data.top.map((p) => (
                      <p className="between" key={p._id}>
                        <span>{p._id}</span>
                        <strong>{p.units} sold</strong>
                      </p>
                    ))}
                    {!data.top.length && <p>Best sellers appear after the first paid orders.</p>}
                  </div>
                </div>
                <div className="panel">
                  <h2>Stock needs attention</h2>
                  {data.lowStock.map((p) => (
                    <p key={p._id}>
                      {p.name}:{' '}
                      {p.variants
                        .filter((v) => v.stock < 5)
                        .map((v) => v.sku + ' (' + v.stock + ')')
                        .join(', ')}
                    </p>
                  ))}
                  {!data.lowStock.length && (
                    <p>All active variants have at least five available units.</p>
                  )}
                </div>
              </>
            )}
            {section === 'products' && (
              <>
                <div className="actions">
                  <button className="primary" onClick={() => setEditing({})}>
                    Add product
                  </button>
                  <CategoryEditor act={act} />
                </div>
                {editing && (
                  <ProductEditor
                    key={editing._id || 'new'}
                    product={editing}
                    onClose={() => setEditing(null)}
                    act={act}
                  />
                )}
                <div className="records">
                  {data.map((p) => (
                    <div className="record" key={p._id}>
                      <div>
                        <h3>{p.name}</h3>
                        <p>
                          {p.variants.length} variants · {p.active ? 'Active' : 'Archived'}
                        </p>
                      </div>
                      <div className="actions">
                        <button onClick={() => setEditing(p)}>Edit</button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm('Archive this product? Existing orders are retained.')
                            )
                              safe('/admin/products/' + p._id, 'DELETE');
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {section === 'orders' && (
              <div className="records">
                {data.map((o) => (
                  <OrderEditor key={o._id} order={o} act={act} />
                ))}
              </div>
            )}
            {section === 'requests' && (
              <div className="queue">
                {[
                  'Submitted',
                  'Quoted',
                  'Accepted',
                  'Printing',
                  'Shipped',
                  'Completed',
                  'Declined',
                ].map((status) => (
                  <div className="queue-column" key={status}>
                    <h3>{status}</h3>
                    {data
                      .filter((r) => r.status === status)
                      .map((r) => (
                        <Link className="queue-card" key={r._id} to={'/requests/' + r._id}>
                          <strong>{r.title}</strong>
                          <p>
                            {r.material} · {r.quantity} units
                          </p>
                          {r.deadline && (
                            <small>
                              Requested by {new Date(r.deadline).toLocaleDateString('en-ZA')}
                            </small>
                          )}
                        </Link>
                      ))}
                  </div>
                ))}
              </div>
            )}
            {section === 'users' &&
              data.map((u) => (
                <div className="record" key={u._id}>
                  <div>
                    <h3>{u.name}</h3>
                    <p>
                      {u.email} · {u.role}
                    </p>
                  </div>
                  <button
                    onClick={() => safe('/admin/users/' + u._id, 'PUT', { blocked: !u.blocked })}
                  >
                    {u.blocked ? 'Unblock' : 'Block'} account
                  </button>
                </div>
              ))}
            {section === 'reviews' &&
              data.map((r) => (
                <div className="panel" key={r._id}>
                  <h3>
                    {r.name} · {r.rating}/5
                  </h3>
                  <p>{r.text}</p>
                  <button
                    onClick={() =>
                      safe('/admin/reviews/' + r._id, 'PUT', { approved: !r.approved })
                    }
                  >
                    {r.approved ? 'Hide review' : 'Publish review'}
                  </button>
                </div>
              ))}
            {section === 'coupons' && (
              <>
                <CouponEditor act={act} />
                {data.map((c) => (
                  <div className="record" key={c._id}>
                    <div>
                      <h3>{c.code}</h3>
                      <p>
                        {c.percent}% off · minimum {money(c.minimum, currency)} ·{' '}
                        {c.active ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        safe('/admin/coupons', 'PUT', {
                          code: c.code,
                          percent: c.percent,
                          minimum: c.minimum,
                          expiresAt: c.expiresAt,
                          active: !c.active,
                        })
                      }
                    >
                      {c.active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                ))}
              </>
            )}
            {section === 'settings' && (
              <SettingsEditor key={data.updatedAt} data={data} act={act} />
            )}{' '}
            {Array.isArray(data) && !data.length && <Empty title="Nothing to manage yet" />}
          </>
        )
      )}
    </section>
  );
}
function CategoryEditor({ act }) {
  const [name, setName] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await act('/admin/categories', 'POST', {
            name,
            slug: name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, ''),
          });
          setName('');
        } catch {}
      }}
    >
      <input
        aria-label="New category"
        placeholder="New category"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button>Add category</button>
    </form>
  );
}
function ProductEditor({ product, onClose, act }) {
  const categories = useResource('/categories');
  const [error, setError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      name: product.name || '',
      slug: product.slug || '',
      description: product.description || '',
      category: product.category?._id || '',
      images: product.images?.join('\n') || '',
      modelUrl: product.modelUrl || '',
      featured: product.featured || false,
      active: product.active ?? true,
      variants: product.variants?.map((v) => ({ ...v, price: v.price / 100 })) || [
        { sku: '', material: 'PLA', colour: 'Graphite', size: 'Standard', price: 100, stock: 10 },
      ],
    },
  });
  const variants = useFieldArray({ control, name: 'variants' });
  return (
    <form
      className="panel form"
      onSubmit={handleSubmit(async (values) => {
        try {
          setError('');
          await act(
            '/admin/products' + (product._id ? '/' + product._id : ''),
            product._id ? 'PUT' : 'POST',
            {
              ...values,
              images: values.images
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
              variants: values.variants.map(
                ({ _id, sku, material, colour, size, price, stock }) => ({
                  ...(_id ? { _id } : {}),
                  sku,
                  material,
                  colour,
                  size,
                  price: Math.round(Number(price) * 100),
                  stock: Number(stock),
                }),
              ),
            },
          );
          onClose();
        } catch (e) {
          setError(e.message);
        }
      })}
    >
      <div className="between">
        <h2>{product._id ? 'Edit object' : 'Create an object'}</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="form-grid">
        <Field label="Name">
          <input required {...register('name')} />
        </Field>
        <Field label="URL slug">
          <input required pattern="[a-z0-9-]+" {...register('slug')} />
        </Field>
        <Field label="Category">
          <select required {...register('category')}>
            <option value="">Choose category</option>
            {categories.data?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Public model URL (optional)">
          <input type="url" {...register('modelUrl')} />
        </Field>
      </div>
      <Field label="Description">
        <textarea required rows={4} {...register('description')} />
      </Field>
      <Field label="Images (one URL or upload reference per line)">
        <textarea rows={3} {...register('images')} />
      </Field>
      <Field label="Upload product images">
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            try {
              setError('');
              for (const file of Array.from(e.target.files)) {
                const body = new FormData();
                body.append('file', file);
                const uploaded = await api('/uploads/image', { method: 'POST', body });
                const value = getValues('images');
                setValue('images', (value ? value + '\n' : '') + 'upload:' + uploaded._id);
              }
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      </Field>
      <div className="actions">
        <label>
          <input type="checkbox" {...register('featured')} /> Featured
        </label>
        <label>
          <input type="checkbox" {...register('active')} /> Active
        </label>
      </div>
      <h3>Variants — prices in currency units</h3>
      {variants.fields.map((field, i) => (
        <fieldset key={field.id}>
          <legend>Variant {i + 1}</legend>
          <div className="form-grid">
            {['sku', 'colour', 'size', 'price', 'stock'].map((k) => (
              <Field label={k} key={k}>
                <input
                  required
                  type={['price', 'stock'].includes(k) ? 'number' : 'text'}
                  min="0"
                  step={k === 'price' ? '0.01' : '1'}
                  {...register('variants.' + i + '.' + k)}
                />
              </Field>
            ))}
            <Field label="Material">
              <select {...register('variants.' + i + '.material')}>
                {['PLA', 'PETG', 'ABS', 'TPU', 'Resin'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            disabled={variants.fields.length === 1}
            onClick={() => variants.remove(i)}
          >
            Remove variant
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          variants.append({
            sku: '',
            material: 'PLA',
            colour: 'Graphite',
            size: 'Standard',
            price: 100,
            stock: 0,
          })
        }
      >
        Add variant
      </button>
      <Alert>{error}</Alert>
      <button className="primary" disabled={isSubmitting}>
        Save product
      </button>
    </form>
  );
}
function OrderEditor({ order, act }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      status: ['Processing', 'Printing', 'Shipped', 'Completed'].includes(order.status)
        ? order.status
        : 'Processing',
      trackingNumber: order.trackingNumber || '',
    },
  });
  return (
    <form
      className="panel form"
      onSubmit={handleSubmit((v) => act('/admin/orders/' + order._id, 'PUT', v).catch(() => {}))}
    >
      <div className="between">
        <h3>
          <Link to={'/orders/' + order._id}>Order {order._id.slice(-8)}</Link>
        </h3>
        <span>
          {money(order.total, order.currency)} · {order.paymentStatus}
        </span>
      </div>
      <p>{order.items.map((i) => i.name + ' × ' + i.quantity).join(', ')}</p>
      <div className="form-grid">
        <Field label="Order status">
          <select {...register('status')}>
            {['Processing', 'Printing', 'Shipped', 'Completed'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Tracking number">
          <input {...register('trackingNumber')} />
        </Field>
      </div>
      <div className="actions">
        <button disabled={order.paymentStatus !== 'paid' || isSubmitting}>Update order</button>
        <button
          type="button"
          disabled={order.paymentStatus !== 'paid'}
          onClick={() => {
            if (window.confirm('Issue a full refund for this order?'))
              act('/admin/orders/' + order._id + '/refund', 'POST').catch(() => {});
          }}
        >
          Issue full refund
        </button>
      </div>
    </form>
  );
}
function CouponEditor({ act }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();
  return (
    <form
      className="panel form"
      onSubmit={handleSubmit(async (v) => {
        try {
          await act('/admin/coupons', 'PUT', {
            code: v.code,
            percent: Number(v.percent),
            minimum: Math.round(Number(v.minimum) * 100),
            expiresAt: new Date(v.expiresAt + 'T23:59:00').toISOString(),
            active: true,
          });
          reset();
        } catch {}
      })}
    >
      <h2>Create or replace a coupon</h2>
      <div className="form-grid">
        {[
          ['code', 'Code', 'text'],
          ['percent', 'Percentage off', 'number'],
          ['minimum', 'Minimum spend', 'number'],
          ['expiresAt', 'Expires', 'date'],
        ].map(([key, label, type]) => (
          <Field key={key} label={label}>
            <input required type={type} {...register(key)} />
          </Field>
        ))}
      </div>
      <button disabled={isSubmitting}>Save coupon</button>
    </form>
  );
}
function SettingsEditor({ data, act }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      currency: data.currency,
      tax: Number(data.taxBasisPoints) / 100,
      contactEmail: data.contactEmail,
      whatsapp: data.whatsapp,
      shipping: data.shipping.map((s) => ({ ...s, price: s.price / 100 })),
    },
  });
  const shipping = useFieldArray({ control, name: 'shipping' });
  return (
    <form
      className="panel form"
      onSubmit={handleSubmit((v) =>
        act('/admin/settings', 'PUT', {
          currency: v.currency,
          taxBasisPoints: Math.round(Number(v.tax) * 100),
          contactEmail: v.contactEmail,
          whatsapp: v.whatsapp,
          shipping: v.shipping.map((s) => ({ ...s, price: Math.round(Number(s.price) * 100) })),
        }).catch(() => {}),
      )}
    >
      <h2>Store settings</h2>
      <p className="muted">
        Changing currency does not convert existing product prices. Review catalogue pricing before
        reopening sales.
      </p>
      <div className="form-grid">
        {[
          ['currency', 'Currency code'],
          ['tax', 'Tax percentage'],
          ['contactEmail', 'Contact email'],
          ['whatsapp', 'WhatsApp number (digits with country code)'],
        ].map(([k, label]) => (
          <Field key={k} label={label}>
            <input {...register(k)} />
          </Field>
        ))}
      </div>
      <h3>Shipping methods</h3>
      {shipping.fields.map((s, i) => (
        <div className="form-grid" key={s.id}>
          <Field label="Method name">
            <input required {...register('shipping.' + i + '.name')} />
          </Field>
          <Field label="Price">
            <input
              type="number"
              min="0"
              step="0.01"
              required
              {...register('shipping.' + i + '.price')}
            />
          </Field>
          <button
            type="button"
            disabled={shipping.fields.length === 1}
            onClick={() => shipping.remove(i)}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => shipping.append({ name: '', price: 0 })}>
        Add shipping method
      </button>
      <button className="primary" disabled={isSubmitting}>
        Save settings
      </button>
    </form>
  );
}
