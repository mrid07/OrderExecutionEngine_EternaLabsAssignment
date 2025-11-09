import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testServer.js';

describe('GET /api/orders/:id 404', () => {
  it('returns not_found for unknown order', async () => {
    const res = await api.get('/api/orders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
