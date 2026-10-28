import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useSession } from '../lib/session';
import { api } from '../lib/api';
import { Heading, Field, Alert } from '../components/UI';
import AddressFields from '../components/AddressFields';
export default function Account({ security = false }) {
  const { user, setUser } = useSession();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: security ? {} : { name: user.name, addresses: user.addresses || [] },
  });
  const addresses = useFieldArray({ control, name: 'addresses' });
  return (
    <section className="section">
      <Heading
        eyebrow="YOUR WORKSPACE"
        title={security ? 'Keep your account secure.' : 'Hello, ' + user.name.split(' ')[0] + '.'}
      />
      {user.forcePasswordChange && (
        <Alert>
          Please replace your initial password before using the store or admin workspace.
        </Alert>
      )}
      <div className="account-tabs">
        <Link to="/account">Profile & addresses</Link>
        <Link to="/account/security">Password</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/requests">Custom projects</Link>
      </div>
      <form
        className="panel form"
        onSubmit={handleSubmit(async (values) => {
          try {
            setError('');
            const result = await api(security ? '/auth/password' : '/auth/profile', {
              method: security ? 'POST' : 'PUT',
              body: values,
            });
            setUser(result);
            setMessage('Saved successfully');
            if (security) reset();
          } catch (e) {
            setError(e.message);
          }
        })}
      >
        {security ? (
          <>
            <Field label="Current password">
              <input
                type="password"
                autoComplete="current-password"
                {...register('currentPassword', { required: true })}
              />
            </Field>
            <Field label="New password (at least 12 characters)" error={errors.password}>
              <input
                type="password"
                autoComplete="new-password"
                {...register('password', {
                  required: true,
                  minLength: { value: 12, message: 'Use at least 12 characters' },
                  maxLength: 72,
                })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Full name">
              <input {...register('name', { required: true, maxLength: 100 })} />
            </Field>
            <p className="muted">{user.email}</p>
            <h2>Your address book</h2>
            {addresses.fields.map((field, i) => (
              <fieldset key={field.id}>
                <legend>Address {i + 1}</legend>
                <AddressFields
                  register={register}
                  prefix={'addresses.' + i + '.'}
                  errors={errors.addresses?.[i]}
                />
                <button type="button" onClick={() => addresses.remove(i)}>
                  Remove address
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={addresses.fields.length >= 10}
              onClick={() =>
                addresses.append({
                  name: user.name,
                  line1: '',
                  line2: '',
                  city: '',
                  province: '',
                  postalCode: '',
                  phone: '',
                  country: 'ZA',
                })
              }
            >
              Add an address
            </button>
          </>
        )}
        <Alert>{error}</Alert>
        <p role="status">{message}</p>
        <button className="primary" disabled={isSubmitting}>
          Save changes
        </button>
      </form>
    </section>
  );
}
