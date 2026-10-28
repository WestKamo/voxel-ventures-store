import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, Link } from 'react-router-dom';
import { useResource } from '../lib/hooks';
import { api, money } from '../lib/api';
import { useShop } from '../stores/store';
import { useSession } from '../lib/session';
import AddressFields from '../components/AddressFields';
import { Heading, Field, Alert, Loading, Empty } from '../components/UI';
export default function Checkout() {
  const { requestId } = useParams();
  const items = useShop((s) => s.items);
  const { user } = useSession();
  const settings = useResource('/settings');
  const [error, setError] = useState('');
  const [estimate, setEstimate] = useState(null);
  const key = useRef({ value: crypto.randomUUID(), fingerprint: '' });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { address: { country: 'ZA' } } });
  if (settings.loading) return <Loading />;
  if (settings.error) return <Alert>{settings.error}</Alert>;
  if (!requestId && !items.length)
    return (
      <Empty title="Your bag is empty">
        <Link to="/products">Browse the collection</Link>
      </Empty>
    );
  const payload = (values) => {
    const body = {
      ...values,
      ...(!requestId
        ? { items: items.map(({ product, variant, quantity }) => ({ product, variant, quantity })) }
        : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (key.current.fingerprint !== fingerprint)
      key.current = { value: crypto.randomUUID(), fingerprint };
    return { ...body, idempotencyKey: key.current.value };
  };
  return (
    <section className="section">
      <Heading
        eyebrow="ONE STEP CLOSER"
        title={requestId ? 'Bring your idea to life.' : 'Make it yours.'}
      >
        Payment is completed securely with Stripe. Your order is confirmed only when payment is
        verified.
      </Heading>
      <form
        className="checkout-grid"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          try {
            const order = await api(requestId ? '/requests/' + requestId + '/pay' : '/orders', {
              method: 'POST',
              body: payload(values),
            });
            window.location.assign(order.checkoutUrl);
          } catch (e) {
            setError(e.message);
          }
        })}
      >
        <div className="panel form">
          <h2>Where should it go?</h2>
          {user.addresses?.length > 0 && (
            <Field label="Saved address">
              <select
                defaultValue=""
                onChange={(e) => {
                  const address = user.addresses[Number(e.target.value)];
                  if (address)
                    for (const [k, v] of Object.entries(address))
                      if (k !== '_id') setValue('address.' + k, v);
                }}
              >
                <option value="">Enter a new address</option>
                {user.addresses.map((a, i) => (
                  <option key={i} value={i}>
                    {a.name} — {a.line1}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <AddressFields register={register} errors={errors.address} />
          <Field label="Shipping method">
            <select required {...register('shippingMethod', { required: true })}>
              {settings.data.shipping.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} — {money(s.price, settings.data.currency)}
                </option>
              ))}
            </select>
          </Field>
          {!requestId && (
            <Field label="Discount code">
              <input {...register('coupon')} maxLength={30} />
            </Field>
          )}
        </div>
        <aside className="panel summary">
          <h2>Order summary</h2>
          {items.length > 0 &&
            !requestId &&
            items.map((i) => (
              <div className="between" key={i.variant}>
                <span>
                  {i.name} × {i.quantity}
                </span>
                <span>{money(i.price * i.quantity, settings.data.currency)}</span>
              </div>
            ))}
          {!requestId && (
            <button
              type="button"
              onClick={handleSubmit(async (values) => {
                try {
                  setError('');
                  setEstimate(
                    await api('/orders/estimate', { method: 'POST', body: payload(values) }),
                  );
                } catch (e) {
                  setError(e.message);
                }
              })}
            >
              Calculate final total
            </button>
          )}
          {estimate && (
            <dl>
              {['subtotal', 'discount', 'shipping', 'tax', 'total'].map((k) => (
                <div className="between" key={k}>
                  <dt>{k}</dt>
                  <dd>{money(estimate[k], estimate.currency)}</dd>
                </div>
              ))}
            </dl>
          )}
          {requestId && (
            <p>
              Your accepted quote plus the selected shipping charge and configured tax will be shown
              on the secure payment page before payment.
            </p>
          )}
          <Alert>{error}</Alert>
          <button className="button primary full" disabled={isSubmitting}>
            {isSubmitting ? 'Preparing secure checkout…' : 'Continue to payment →'}
          </button>
          <p className="muted">
            A 35-minute stock reservation protects your order. An unpaid checkout is not a confirmed
            purchase.
          </p>
        </aside>
      </form>
    </section>
  );
}
