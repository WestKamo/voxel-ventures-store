import { Link } from 'react-router-dom';
import { useShop } from '../stores/store';
import { money } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Heading, Empty, ProductCard } from '../components/UI';
export function Wishlist() {
  const products = useShop((s) => s.wishlist);
  const settings = useResource('/settings');
  return (
    <section className="section">
      <Heading eyebrow="SAVED FOR LATER" title="Your favourites." />
      {products.length ? (
        <div className="product-grid">
          {products.map((p, i) => (
            <ProductCard key={p._id} product={p} index={i} currency={settings.data?.currency} />
          ))}
        </div>
      ) : (
        <Empty title="Make room for a favourite">
          <Link to="/products" className="button primary">
            Explore objects
          </Link>
        </Empty>
      )}
    </section>
  );
}
export default function Cart() {
  const { items, quantity, remove } = useShop();
  const settings = useResource('/settings');
  const total = items.reduce((s, i) => s + i.quantity * i.price, 0);
  return (
    <section className="section">
      <Heading eyebrow="GOOD CHOICES" title="Your bag." />
      {!items.length ? (
        <Empty title="A little empty. Full of possibility.">
          <Link className="button primary" to="/products">
            Find your first object
          </Link>
        </Empty>
      ) : (
        <div className="checkout-grid">
          <div className="cart-items">
            {items.map((i) => (
              <article className="cart-row" key={i.product + i.variant}>
                <div>
                  <Link to={'/products/' + i.slug}>
                    <h3>{i.name}</h3>
                  </Link>
                  <p className="muted">{i.sku}</p>
                  <button className="text-button" onClick={() => remove(i.product, i.variant)}>
                    Remove
                  </button>
                </div>
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="99"
                    aria-label={'Quantity for ' + i.name}
                    value={i.quantity}
                    onChange={(e) => quantity(i.product, i.variant, Number(e.target.value) || 1)}
                  />
                </label>
                <strong>{money(i.price * i.quantity, settings.data?.currency)}</strong>
              </article>
            ))}
          </div>
          <aside className="panel summary">
            <h2>The good stuff.</h2>
            <div className="between">
              <span>Estimated subtotal</span>
              <strong>{money(total, settings.data?.currency)}</strong>
            </div>
            <p className="muted">
              Current prices, stock, shipping and tax are confirmed securely at checkout.
            </p>
            <Link className="button primary full" to="/checkout">
              Continue to checkout →
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
