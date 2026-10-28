import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, Layers, ScanLine, PackageCheck } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { ProductCard, Alert, Loading } from '../components/UI';
export default function Home() {
  const { data, error, loading } = useResource('/products?featured=true');
  const categories = useResource('/categories');
  const settings = useResource('/settings');
  const reduced = useReducedMotion();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> INDEPENDENT 3D PRINT STUDIO / SOUTH AFRICA
          </p>
          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Ideas take
            <br />
            <em>shape.</em>
          </motion.h1>
          <p className="hero-description">
            Objects with a little more imagination.
            <br />
            Thoughtfully designed. Precisely printed. Uniquely yours.
          </p>
          <div className="actions">
            <Link className="button primary" to="/products">
              Explore the collection <ArrowUpRight size={19} />
            </Link>
            <Link className="button ghost" to="/custom">
              Start a custom print <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-foot">
            <span>01 / MADE LAYER BY LAYER</span>
            <span>NOT MASS PRODUCED.</span>
          </div>
        </div>
        <div className="hero-sculpture" aria-label="Isometric layered cube sculpture" role="img">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <motion.div
            className="voxel-stack"
            animate={reduced ? {} : { y: [0, -14, 0], rotate: [-8, -3, -8] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="voxel-slice" style={{ '--i': i }} />
            ))}
          </motion.div>
          <div className="spec-tag tag-top">
            <ScanLine size={17} />
            <span>
              IDEA → OBJECT
              <br />
              <strong>Limitless by design.</strong>
            </span>
          </div>
          <div className="spec-tag tag-bottom">
            <span className="status-dot" /> BUILDING POSSIBILITIES
          </div>
          <span className="coordinate">X 29.85 / Y 31.02 / Z ∞</span>
        </div>
      </section>
      <div className="ticker">
        <span>DESIGNED TO BE DIFFERENT</span>
        <span>✳</span>
        <span>PRINTED WITH PURPOSE</span>
        <span>✳</span>
        <span>MADE FOR YOUR WORLD</span>
        <span>✳</span>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE OBJECT LIBRARY / 001</p>
            <h2>Everyday. Reimagined.</h2>
          </div>
          <Link className="underlink" to="/products">
            View all objects <ArrowUpRight size={18} />
          </Link>
        </div>
        <Alert>{error}</Alert>
        {loading ? (
          <Loading />
        ) : (
          <div className="product-grid">
            {data?.products.slice(0, 3).map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} currency={settings.data?.currency} />
            ))}
          </div>
        )}
        <div className="category-strip">
          {categories.data?.map((c, i) => (
            <Link key={c._id} to={'/products?category=' + c._id}>
              <span>0{i + 1}</span>
              {c.name}
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      </section>
      <section className="custom-banner section">
        <div>
          <p className="eyebrow">YOUR IMAGINATION. OUR PRINT BED.</p>
          <h2>
            Can’t find it?
            <br />
            <em>Let’s make it.</em>
          </h2>
          <p>
            From a sketch on a napkin to a ready-to-print model.
            <br />
            Your next idea deserves to exist.
          </p>
          <Link to="/custom" className="button primary">
            Enter the custom studio <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="process-list">
          {[
            [Layers, '01', 'Share the spark', 'Upload a model or tell us what you imagine.'],
            [
              ScanLine,
              '02',
              'Fine-tune the details',
              'Choose your material, colour, and dimensions.',
            ],
            [
              PackageCheck,
              '03',
              'Watch it take shape',
              'Approve your quote. We print, finish, and ship.',
            ],
          ].map(([Icon, n, title, text]) => (
            <div key={n}>
              <Icon />
              <span className="process-number">{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="section faq">
        <div>
          <p className="eyebrow">A LITTLE CLARITY</p>
          <h2>Curious by nature?</h2>
          <p className="muted">Good questions make better objects.</p>
        </div>
        <div>
          {[
            [
              'Do I need a 3D model?',
              'No. Describe your idea, dimensions, and intended use. We will review feasibility and send a quote before any payment.',
            ],
            [
              'Which material should I choose?',
              'PLA suits decorative and indoor objects. PETG adds toughness and moisture resistance. TPU is flexible. Our material guide helps you decide.',
            ],
            [
              'How long does a custom print take?',
              'Your quote includes a lead time. Production begins after payment confirmation; shipping time is additional.',
            ],
            [
              'Can I order a batch?',
              'Absolutely. Add the quantity to your custom request and we will quote the whole batch.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="section community">
        <p className="eyebrow">MADE FOR REAL PEOPLE</p>
        <h2>Your object. Your story.</h2>
        <p>
          Customer reviews appear on product pages after purchase and moderation.
          <br />
          Be part of the first chapter.
        </p>
      </section>
    </>
  );
}
