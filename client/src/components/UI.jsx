import { Component } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, Box } from 'lucide-react';
import { useShop } from '../stores/store';
import { money, imageSource } from '../lib/api';
export function Alert({ children }) {
  return children ? (
    <div role="alert" className="alert">
      {children}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="pulse" /> Building your view…
    </div>
  );
}
export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <Box size={36} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="error">{error.message || error}</small>}
    </label>
  );
}
export function Heading({ eyebrow, title, children }) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
export function ProductArt({ index = 0, name = '' }) {
  return (
    <div
      className={'product-art art-' + (index % 4)}
      role="img"
      aria-label={name || 'Layered geometric object'}
    >
      <div className="printed-object">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <span className="art-caption">FORM / FUNCTION / POSSIBILITY</span>
    </div>
  );
}
export function ProductCard({ product, index = 0, currency = 'ZAR' }) {
  const wish = useShop((s) => s.wish);
  const selected = useShop((s) => s.wishlist.some((p) => p._id === product._id));
  return (
    <article className="product-card">
      <Link to={'/products/' + product.slug} className="product-visual">
        {product.images?.[0] ? (
          <img src={imageSource(product.images[0])} alt={product.name} loading="lazy" />
        ) : (
          <ProductArt index={index} name={product.name} />
        )}
      </Link>
      <button
        className="wish"
        aria-label={(selected ? 'Remove from' : 'Add to') + ' wishlist: ' + product.name}
        aria-pressed={selected}
        onClick={() => wish(product)}
      >
        <Heart size={18} fill={selected ? 'currentColor' : 'none'} />
      </button>
      <div className="product-info">
        <p className="eyebrow">{product.category?.name || 'Printed to inspire'}</p>
        <Link to={'/products/' + product.slug}>
          <h3>
            {product.name}
            <ArrowUpRight size={18} />
          </h3>
        </Link>
        <div className="between">
          <span className="muted">
            {product.variants?.[0]?.material} · {product.variants?.length} options
          </span>
          <strong>{money(Math.min(...product.variants.map((v) => v.price)), currency)}</strong>
        </div>
      </div>
    </article>
  );
}
export function Timeline({ history = [] }) {
  return (
    <ol className="timeline">
      {history.map((h, i) => (
        <li key={i}>
          <strong>{h.status}</strong>
          <time>{new Date(h.at).toLocaleString('en-ZA')}</time>
        </li>
      ))}
    </ol>
  );
}
export class ErrorBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty">
        <h2>This view could not load</h2>
        <p>Your account and orders are unaffected. Try refreshing the page.</p>
        <button onClick={() => window.location.reload()}>Reload page</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
