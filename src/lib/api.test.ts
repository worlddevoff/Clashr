import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiJson } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiJson', () => {
  it('preserves the response status on API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const request = apiJson('/api/me');
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 401, message: 'unauthorized' });
  });
});
