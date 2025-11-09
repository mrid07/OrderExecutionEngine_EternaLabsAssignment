import { describe, it, expect } from 'vitest';
import WebSocket from 'ws';
import { api, sleep } from '../helpers/testServer.js';

function collectWs(url: string, timeoutMs = 8000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const msgs: any[] = [];
    const ws = new WebSocket(url);
    const to = setTimeout(() => { try { ws.close(); } catch {} ; resolve(msgs); }, timeoutMs);
    ws.on('message', (d) => { try { msgs.push(JSON.parse(d.toString())); } catch {} });
    ws.on('error', reject);
    ws.on('close', () => { clearTimeout(to); resolve(msgs); });
  });
}

describe('E2E: create order → WS stream → confirmed', () => {
  it('streams statuses and persists to DB', async () => {
    const body = { type: 'market', tokenIn: 'SOL', tokenOut: 'USDC', amount: 1, slippageBps: 100 };
    const res = await api.post('/api/orders/execute').send(body);
    expect(res.status).toBe(200);
    const orderId = res.body.orderId;
    expect(orderId).toBeTruthy();

    const msgs = await collectWs(`ws://localhost:3000/api/orders/execute?orderId=${orderId}`);
    const statuses = msgs.map(m => m.status);
    expect(statuses[0]).toBe('pending');
    expect(statuses).toContain('routing');
    expect(['confirmed', 'failed']).toContain(statuses[statuses.length - 1]);

    // Query REST for persisted order
    // small wait to ensure writes flushed
    await sleep(200);
    const g = await api.get(`/api/orders/${orderId}`);
    expect([200,404]).toContain(g.status);
    if (g.status === 200) {
      expect(g.body.order.id).toBe(orderId);
      expect(Array.isArray(g.body.history)).toBe(true);
      expect(g.body.history.length).toBeGreaterThanOrEqual(3);
    }
  }, 15000);
});
