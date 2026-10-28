import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Box, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Alert, Field } from '../components/UI';
export default function Auth({ mode = 'login' }) {
  const { token } = useParams();
  const { setUser } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();
  const signup = mode === 'register';
  const forgot = mode === 'forgot-password';
  const reset = mode === 'reset-password';
  const title = signup
    ? 'Make yourself at home.'
    : forgot
      ? 'Let’s get you back in.'
      : reset
        ? 'A fresh start.'
        : 'Welcome back.';
  return (
    <section className="auth-grid">
      <div className="auth-story">
        <Box size={48} />
        <p className="eyebrow">A SPACE FOR YOUR IDEAS</p>
        <h1>
          Good things
          <br />
          start with
          <br />
          <em>one layer.</em>
        </h1>
        <p>Your next creation is closer than you think.</p>
      </div>
      <form
        className="form auth-form"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          try {
            const result = await api('/auth/' + mode, {
              method: 'POST',
              body: reset ? { password: values.password, token } : values,
            });
            if (forgot || reset) setMessage(result.message);
            else {
              setUser(result);
              navigate(
                result.forcePasswordChange
                  ? '/account/security'
                  : result.role === 'admin'
                    ? '/admin'
                    : '/account',
              );
            }
          } catch (e) {
            setError(e.message);
          }
        })}
      >
        <p className="eyebrow">VOXEL VENTURES / YOUR ACCOUNT</p>
        <h2>{title}</h2>
        {signup && (
          <Field label="Full name" error={errors.name}>
            <input
              autoComplete="name"
              {...register('name', { required: 'Enter your name', maxLength: 100 })}
            />
          </Field>
        )}
        {!reset && (
          <Field label="Email address" error={errors.email}>
            <input
              type="email"
              autoComplete="email"
              {...register('email', { required: 'Enter your email' })}
            />
          </Field>
        )}
        {!forgot && (
          <Field label={reset ? 'New password' : 'Password'} error={errors.password}>
            <input
              type="password"
              autoComplete={signup || reset ? 'new-password' : 'current-password'}
              {...register('password', {
                required: 'Enter your password',
                minLength:
                  signup || reset ? { value: 12, message: 'Use at least 12 characters' } : 1,
                maxLength: 72,
              })}
            />
          </Field>
        )}
        <Alert>{error}</Alert>
        {message ? (
          <p role="status">
            {message} <Link to="/login">Sign in</Link>
          </p>
        ) : (
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting
              ? 'One moment…'
              : signup
                ? 'Create account'
                : forgot
                  ? 'Send reset link'
                  : reset
                    ? 'Set new password'
                    : 'Sign in'}{' '}
            <ArrowUpRight size={18} />
          </button>
        )}
        {mode === 'login' && (
          <>
            <Link to="/forgot-password">Forgot your password?</Link>
            <p className="muted">
              New around here? <Link to="/register">Create an account</Link>
            </p>
          </>
        )}
        {signup && (
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}
      </form>
    </section>
  );
}
