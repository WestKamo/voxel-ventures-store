const BASE = import.meta.env.VITE_API_URL || '/api';
let csrf;
let refreshing;
export function refreshSession() {
  refreshing ||= api('/auth/refresh', { method: 'POST', retry: false }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
export async function api(path, { method = 'GET', body, retry = true } = {}) {
  if (method !== 'GET' && !csrf) {
    const r = await fetch(BASE + '/auth/csrf', { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Unable to establish a secure session');
    csrf = d.data.token;
  }
  const response = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      return api(path, { method, body, retry: false });
    } catch {
      /* The original authorization error is shown below. */
    }
  }
  if (response.status === 403 && data.error?.message === 'Invalid CSRF token' && retry) {
    csrf = undefined;
    return api(path, { method, body, retry: false });
  }
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data.data;
}
export const money = (cents, currency = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format((cents || 0) / 100);
export const imageSource = (url) =>
  url?.startsWith('upload:') ? BASE + '/images/' + url.slice(7) : url;
