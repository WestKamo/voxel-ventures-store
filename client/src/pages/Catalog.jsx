import { useSearchParams } from 'react-router-dom';
import { useResource } from '../lib/hooks';
import { Heading, ProductCard, Loading, Alert, Empty, Field } from '../components/UI';
export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const { data, error, loading } = useResource('/products?' + params);
  const categories = useResource('/categories');
  const settings = useResource('/settings');
  const set = (key, value) => {
    const p = new URLSearchParams(params);
    value ? p.set(key, value) : p.delete(key);
    if (key !== 'page') p.delete('page');
    setParams(p);
  };
  return (
    <section className="section">
      <Heading eyebrow="THE OBJECT LIBRARY" title="The collection.">
        Useful. Playful. A little unexpected. Find your next favourite object.
      </Heading>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          set('search', new FormData(e.currentTarget).get('search'));
        }}
      >
        <Field label="Search">
          <input
            name="search"
            defaultValue={params.get('search') || ''}
            placeholder="Find your next object"
          />
        </Field>
        <button className="button">Search</button>
        <Field label="Category">
          <select
            value={params.get('category') || ''}
            onChange={(e) => set('category', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Material">
          <select
            value={params.get('material') || ''}
            onChange={(e) => set('material', e.target.value)}
          >
            <option value="">All materials</option>
            {['PLA', 'PETG', 'ABS', 'TPU', 'Resin'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Colour">
          <select
            value={params.get('colour') || ''}
            onChange={(e) => set('colour', e.target.value)}
          >
            <option value="">All colours</option>
            {['Graphite', 'Bone', 'Lime', 'Terracotta', 'Lilac'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Minimum price">
          <input
            type="number"
            min="0"
            placeholder="Any"
            value={params.get('min') ? Number(params.get('min')) / 100 : ''}
            onChange={(e) =>
              set('min', e.target.value ? String(Math.round(Number(e.target.value) * 100)) : '')
            }
          />
        </Field>
        <Field label="Maximum price">
          <input
            type="number"
            min="0"
            placeholder="Any"
            value={params.get('max') ? Number(params.get('max')) / 100 : ''}
            onChange={(e) =>
              set('max', e.target.value ? String(Math.round(Number(e.target.value) * 100)) : '')
            }
          />
        </Field>
        <Field label="Sort">
          <select
            value={params.get('sort') || 'newest'}
            onChange={(e) => set('sort', e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="price">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name</option>
          </select>
        </Field>
      </form>
      <Alert>{error}</Alert>
      {loading ? (
        <Loading />
      ) : data?.products.length ? (
        <>
          <p className="muted">{data.total} objects to make your space yours</p>
          <div className="product-grid">
            {data.products.map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} currency={settings.data?.currency} />
            ))}
          </div>
          <div className="pagination">
            <button disabled={data.page <= 1} onClick={() => set('page', String(data.page - 1))}>
              Previous
            </button>
            <span>
              Page {data.page} of {data.pages}
            </span>
            <button
              disabled={data.page >= data.pages}
              onClick={() => set('page', String(data.page + 1))}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <Empty title="No objects match yet">
          <button onClick={() => setParams({})}>Clear filters</button>
        </Empty>
      )}
    </section>
  );
}
