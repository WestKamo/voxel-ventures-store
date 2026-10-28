import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Upload, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { Heading, Field, Alert, Loading } from '../components/UI';
const ModelViewer = lazy(() => import('../components/ModelViewer'));
export default function Custom() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      material: 'PLA',
      colour: 'Graphite',
      quantity: 1,
      dimensions: { x: 100, y: 100, z: 100 },
    },
  });
  return (
    <section className="section">
      <Heading eyebrow="THE CUSTOM STUDIO" title="Something only you could imagine.">
        Upload your model or describe an idea. We’ll review the details and send a clear, personal
        quote.
      </Heading>
      <form
        className="custom-grid"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          try {
            let uploaded;
            if (file) {
              const form = new FormData();
              form.append('file', file);
              uploaded = await api('/uploads/model', { method: 'POST', body: form });
            }
            const request = await api('/requests', {
              method: 'POST',
              body: {
                ...values,
                deadline: values.deadline
                  ? new Date(values.deadline + 'T12:00:00').toISOString()
                  : undefined,
                file: uploaded?._id,
              },
            });
            navigate('/requests/' + request._id);
          } catch (e) {
            setError(e.message);
          }
        })}
      >
        <div>
          <label className="dropzone">
            <Upload size={36} />
            <h2>Drop an idea into the real world.</h2>
            <p>Choose STL, OBJ or 3MF · up to 20 MB</p>
            <input
              aria-label="3D model file"
              type="file"
              accept=".stl,.obj,.3mf"
              onChange={(e) => {
                const f = e.target.files[0];
                if (!f) return;
                if (f.size > 20 * 1024 * 1024 || !/\.(stl|obj|3mf)$/i.test(f.name)) {
                  setError('Choose an STL, OBJ or 3MF file under 20 MB');
                  e.target.value = '';
                  return;
                }
                setError('');
                setFile(f);
              }}
            />
          </label>
          {file && (
            <>
              <p>
                {file.name}{' '}
                <button type="button" className="text-button" onClick={() => setFile(null)}>
                  Remove
                </button>
              </p>
              <Suspense fallback={<Loading />}>
                <ModelViewer file={file} />
              </Suspense>
            </>
          )}
          <p className="muted">
            No file? No problem. Tell us what you need. Files remain private and are scanned before
            storage.
          </p>
        </div>
        <div className="panel form">
          <Field label="Give your project a name" error={errors.title}>
            <input {...register('title', { required: 'Name your project', maxLength: 160 })} />
          </Field>
          <Field label="Describe your idea and intended use" error={errors.description}>
            <textarea
              rows={5}
              {...register('description', { required: 'Tell us about your idea', maxLength: 6000 })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Material">
              <select {...register('material')}>
                {['PLA', 'PETG', 'ABS', 'TPU', 'Resin'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Colour">
              <input {...register('colour', { required: true, maxLength: 40 })} />
            </Field>
            {['x', 'y', 'z'].map((axis, i) => (
              <Field key={axis} label={['Width', 'Depth', 'Height'][i] + ' (mm)'}>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  {...register('dimensions.' + axis, {
                    valueAsNumber: true,
                    required: true,
                    min: 1,
                    max: 1000,
                  })}
                />
              </Field>
            ))}
            <Field label="Quantity">
              <input
                type="number"
                min="1"
                max="1000"
                {...register('quantity', {
                  valueAsNumber: true,
                  required: true,
                  min: 1,
                  max: 1000,
                })}
              />
            </Field>
            <Field label="Preferred deadline (optional)">
              <input
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                {...register('deadline')}
              />
            </Field>
          </div>
          <Alert>{error}</Alert>
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Sending your idea…' : 'Request a quote'} <ArrowUpRight size={18} />
          </button>
          <small>No payment now. Your quote includes price and lead time.</small>
        </div>
      </form>
    </section>
  );
}
