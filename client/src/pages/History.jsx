import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useResource } from '../lib/hooks';
import { api, money } from '../lib/api';
import { useShop } from '../stores/store';
import { useSession } from '../lib/session';
import { Heading, Loading, Alert, Empty, Timeline, Field } from '../components/UI';
export function History({ kind = 'orders' }) {
  const { data, error, loading } = useResource('/' + kind);
  return (
    <section className="section">
      <Heading
        eyebrow="YOUR VOXEL JOURNEY"
        title={kind === 'orders' ? 'Your orders.' : 'Your custom projects.'}
      />
      <Alert>{error}</Alert>
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="Your next chapter starts here">
          <Link className="button primary" to={kind === 'orders' ? '/products' : '/custom'}>
            {kind === 'orders' ? 'Explore objects' : 'Start a project'}
          </Link>
        </Empty>
      ) : (
        <div className="records">
          {data.map((item) => (
            <Link className="record" key={item._id} to={'/' + kind + '/' + item._id}>
              <div>
                <h3>{item.title || 'Order ' + item._id.slice(-8).toUpperCase()}</h3>
                <p className="muted">{new Date(item.createdAt).toLocaleDateString('en-ZA')}</p>
              </div>
              <span className="badge">{item.status}</span>
              <strong>{item.total ? money(item.total, item.currency) : 'View project'} →</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
export function OrderDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useResource('/orders/' + id);
  const clear = useShop((s) => s.clear);
  useEffect(() => {
    if (
      data?.paymentStatus === 'paid' &&
      new URLSearchParams(window.location.search).has('checkout')
    )
      clear();
  }, [data?.paymentStatus, clear]);
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  return (
    <section className="section">
      <Heading
        eyebrow={'ORDER / ' + id.slice(-8).toUpperCase()}
        title={
          data.paymentStatus === 'paid'
            ? 'It’s taking shape.'
            : data.paymentStatus === 'pending'
              ? 'Awaiting payment confirmation.'
              : data.paymentStatus === 'refunded'
                ? 'Payment refunded.'
                : 'Checkout expired.'
        }
      />
      <div className="checkout-grid">
        <div className="panel">
          <h2>{data.status}</h2>
          <p>Payment: {data.paymentStatus}</p>
          {data.trackingNumber && (
            <p>
              Tracking number: <strong>{data.trackingNumber}</strong>
            </p>
          )}
          <Timeline history={data.history} />
          <button onClick={reload}>Refresh status</button>
          {data.paymentStatus === 'pending' && data.checkoutUrl && (
            <a className="button primary" href={data.checkoutUrl}>
              Resume secure payment
            </a>
          )}
        </div>
        <div className="panel">
          <h2>Your objects</h2>
          {data.items.map((i, n) => (
            <p key={n}>
              {i.name} × {i.quantity}
            </p>
          ))}
          <dl>
            {['subtotal', 'discount', 'shipping', 'tax', 'total'].map((k) => (
              <div className="between" key={k}>
                <dt>{k}</dt>
                <dd>{money(data[k], data.currency)}</dd>
              </div>
            ))}
          </dl>
          <h3>Delivery</h3>
          <p>
            {data.address.name}
            <br />
            {data.address.line1}
            <br />
            {data.address.city}, {data.address.postalCode}
          </p>
        </div>
      </div>
    </section>
  );
}
export function RequestDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useResource('/requests/' + id);
  const settings = useResource('/settings');
  const { user } = useSession();
  const [actionError, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();
  const quoteForm = useForm();
  const act = async (fn) => {
    try {
      setError('');
      await fn();
      reload();
    } catch (e) {
      setError(e.message);
    }
  };
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  return (
    <section className="section">
      <Heading eyebrow="YOUR CUSTOM PROJECT" title={data.title} />
      <Alert>{actionError}</Alert>
      <div className="checkout-grid">
        <div>
          <div className="panel">
            <span className="badge">{data.status}</span>
            <p className="description">{data.description}</p>
            <p>
              {data.material} / {data.colour} / {data.dimensions.x} × {data.dimensions.y} ×{' '}
              {data.dimensions.z} mm / {data.quantity} units
            </p>
            {data.file && (
              <button
                onClick={() =>
                  act(async () => {
                    const result = await api('/uploads/' + data.file + '/download');
                    window.open(result.url, '_blank', 'noopener,noreferrer');
                  })
                }
              >
                Download private model
              </button>
            )}
            <Timeline history={data.history} />
          </div>
          <div className="panel thread">
            <h2>Studio conversation</h2>
            {data.messages.map((m, i) => (
              <div className={'message ' + (m.author === user.id ? 'mine' : '')} key={i}>
                <strong>{m.name}</strong>
                <p>{m.text}</p>
                <small>{new Date(m.at).toLocaleString('en-ZA')}</small>
              </div>
            ))}
            {!data.messages.length && (
              <p className="muted">Ask a question or add a detail for the studio.</p>
            )}
            <form
              onSubmit={handleSubmit((values) =>
                act(async () => {
                  await api('/requests/' + id + '/messages', { method: 'POST', body: values });
                  reset();
                }),
              )}
            >
              <Field label="Message">
                <textarea maxLength={3000} required {...register('text')} />
              </Field>
              <button disabled={isSubmitting}>Send message</button>
            </form>
          </div>
        </div>
        <aside>
          <div className="panel">
            <h2>Your quote</h2>
            {data.quote?.price ? (
              <>
                <p className="price">
                  {money(data.quote.price, data.quote.currency || settings.data?.currency)}
                </p>
                <p>
                  For all {data.quantity} units · {data.quote.leadDays} working days
                </p>
                <p>{data.quote.notes}</p>
                <small>
                  Valid until {new Date(data.quote.expiresAt).toLocaleDateString('en-ZA')}. Shipping
                  and configured tax are additional.
                </small>
                {data.status === 'Quoted' && data.user === user.id && (
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() =>
                        act(() =>
                          api('/requests/' + id + '/decision', {
                            method: 'POST',
                            body: { accept: true, version: data.quote.version },
                          }),
                        )
                      }
                    >
                      Accept quote
                    </button>
                    <button
                      onClick={() =>
                        act(() =>
                          api('/requests/' + id + '/decision', {
                            method: 'POST',
                            body: { accept: false, version: data.quote.version },
                          }),
                        )
                      }
                    >
                      Decline
                    </button>
                  </div>
                )}
                {data.status === 'Accepted' && data.user === user.id && !data.order && (
                  <Link className="button primary" to={'/checkout/custom/' + id}>
                    Continue to payment
                  </Link>
                )}
                {data.order && (
                  <Link className="button" to={'/orders/' + data.order}>
                    View payment & order
                  </Link>
                )}
              </>
            ) : (
              <p>The studio is reviewing your idea. Your quote will appear here.</p>
            )}
          </div>
          {user.role === 'admin' && !data.order && (
            <form
              className="panel form"
              onSubmit={quoteForm.handleSubmit((values) =>
                act(() =>
                  api('/admin/requests/' + id + '/quote', {
                    method: 'POST',
                    body: {
                      price: Math.round(Number(values.price) * 100),
                      leadDays: Number(values.leadDays),
                      notes: values.notes,
                      expiresAt: new Date(values.expiresAt + 'T23:59:00').toISOString(),
                    },
                  }),
                ),
              )}
            >
              <h3>Prepare a quote</h3>
              <Field label="Total quote price">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  {...quoteForm.register('price')}
                />
              </Field>
              <Field label="Lead time (working days)">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  {...quoteForm.register('leadDays')}
                />
              </Field>
              <Field label="Valid until">
                <input type="date" required {...quoteForm.register('expiresAt')} />
              </Field>
              <Field label="Notes">
                <textarea {...quoteForm.register('notes')} />
              </Field>
              <button disabled={quoteForm.formState.isSubmitting}>Send quote</button>
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}
