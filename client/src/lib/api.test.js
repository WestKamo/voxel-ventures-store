import { afterEach, expect, it, vi } from 'vitest';
import { refreshSession } from './api';
afterEach(() => vi.unstubAllGlobals());
it('deduplicates concurrent refresh calls so a valid token is not replayed', async () => {
  const fetch = vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ data: url.endsWith('/csrf') ? { token: 'test-token' } : { id: 'user' } }),
  }));
  vi.stubGlobal('fetch', fetch);
  const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
  expect(a).toEqual({ id: 'user' });
  expect(b).toEqual(a);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
});
