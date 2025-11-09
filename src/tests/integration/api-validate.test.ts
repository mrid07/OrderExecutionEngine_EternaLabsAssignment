import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testServer.js';

describe('POST /api/orders/execute validation', () => {
  it('rejects invalid body', async () => {
    const res = await api.post('/api/orders/execute').send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });
});
