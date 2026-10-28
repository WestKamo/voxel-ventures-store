import { lazy, Suspense, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { api, money, imageSource } from '../lib/api';
import { useShop } from '../stores/store';
import { useSession } from '../lib/session';
import { Alert, Loading, Field, ProductArt } from '../components/UI';
const ModelViewer = lazy(() => import('../components/ModelViewer'));
export default function Product() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useResource('/products/' + slug);
  const settings = useResource('/settings');
  const [variantId, setVariant] = useState('');
  const [image, setImage] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [notice, setNotice] = useState('');
  const [reviewError, setReviewError] = useState('');
  const add = useShop((s) => s.add);
  const { user } = useSession();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm();
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  const p = data.product;
  const variant = p.variants.find((v) => v._id === variantId) || p.variants[0];
  return (
    <section className="section">
      <Link className="underlink" to="/products">
        <ArrowLeft size={16} /> Back to the collection
      </Link>
      <div className="detail-grid">
        <div>
          <div className="detail-visual">
            {p.images[image] ? (
              <img src={imageSource(p.images[image])} alt={p.name} />
            ) : (
              <ProductArt name={p.name} />
            )}
          </div>
          <div className="thumbs">
            {p.images.map((src, i) => (
              <button
                key={src}
                aria-label={'Show image ' + (i + 1)}
                aria-pressed={image === i}
                onClick={() => setImage(i)}
              >
                <img src={imageSource(src)} alt="" />
              </button>
            ))}
          </div>
          {p.modelUrl && (
            <>
              <button onClick={() => setShowModel(!showModel)}>
                {showModel ? 'Close' : 'Explore'} 3D model
              </button>
              {showModel && (
                <Suspense fallback={<Loading />}>
                  <ModelViewer url={p.modelUrl} />
                </Suspense>
              )}
            </>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{p.category?.name} / SMALL BATCH DESIGN</p>
          <h1>{p.name}</h1>
          <p className="price">{money(variant.price, settings.data?.currency)}</p>
          <p className="description">{p.description}</p>
          <Field label="Material / colour / size">
            <select value={variant._id} onChange={(e) => setVariant(e.target.value)}>
              {p.variants.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.material} / {v.colour} / {v.size}
                </option>
              ))}
            </select>
          </Field>
          <p className="stock">
            {variant.stock > 0 ? `${variant.stock} ready to find a home` : 'Currently out of stock'}
          </p>
          <button
            className="button primary full"
            disabled={!variant.stock}
            onClick={() => {
              add(p, variant);
              setNotice('Added to your bag');
            }}
          >
            <ShoppingBag size={18} /> Add to bag
          </button>
          <p role="status">
            {notice} {notice && <Link to="/cart">View bag →</Link>}
          </p>
          <div className="specs">
            <span>Layer by layer, individually printed</span>
            <span>Shipping calculated at checkout</span>
            <Link to="/custom">Need a different size? Request a custom print →</Link>
          </div>
        </div>
      </div>
      <section className="reviews">
        <h2>From the people who own it.</h2>
        {data.reviews.length ? (
          <p>
            ★ {(data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length).toFixed(1)} /
            5 · {data.reviews.length} reviews
          </p>
        ) : (
          <p className="muted">No published reviews yet.</p>
        )}
        {data.reviews.map((r) => (
          <blockquote key={r._id}>
            <strong>
              {r.name} · {'★'.repeat(r.rating)}
            </strong>
            <p>{r.text}</p>
          </blockquote>
        ))}
        {user && (
          <form
            className="panel form"
            onSubmit={handleSubmit(async (values) => {
              try {
                setReviewError('');
                await api('/reviews', {
                  method: 'POST',
                  body: { product: p._id, rating: Number(values.rating), text: values.text },
                });
                reset();
                setNotice('Thank you. Your review is awaiting moderation.');
                reload();
              } catch (e) {
                setReviewError(e.message);
              }
            })}
          >
            <h3>Share your experience</h3>
            <p className="muted">Available to customers who purchased this object.</p>
            <Field label="Rating">
              <select {...register('rating')}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your review">
              <textarea required maxLength={2000} {...register('text')} />
            </Field>
            <Alert>{reviewError}</Alert>
            <button disabled={isSubmitting}>Submit review</button>
          </form>
        )}
      </section>
    </section>
  );
}
