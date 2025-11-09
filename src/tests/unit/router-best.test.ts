import { describe, it, expect } from 'vitest';
import { MockDexRouter } from '../../routers/dexRouterMock.js';

describe('MockDexRouter.routeBest()', () => {
  it('returns both compared venues and a best pick', async () => {
    const r = new MockDexRouter({ quoteFailureRate: 0, executeFailureRate: 0 });
    const out = await r.routeBest('SOL', 'USDC', 1);
    expect(out.best).toBeTruthy();
    expect(out.compared).toBeTruthy();
    const effR = out.compared.raydium.effective;
    const effM = out.compared.meteora.effective;
    const effBest = out.best.price * (1 - out.best.fee);
    expect(effBest).toBeCloseTo(Math.max(effR, effM), 6);
  });

  it('executeSwap drifts within configured bounds', async () => {
    const r = new MockDexRouter({ executeFailureRate: 0, executionDriftPct: 0.01, executeDelayMs: [1,5] });
    const quoted = 2.0;
    const run = await r.executeSwap('raydium', 'SOL', 'USDC', quoted);
    // 1% drift → executedPrice within 0.99..1.01 * quoted
    expect(run.executedPrice).toBeGreaterThanOrEqual(quoted * 0.99);
    expect(run.executedPrice).toBeLessThanOrEqual(quoted * 1.01);
  });
});
