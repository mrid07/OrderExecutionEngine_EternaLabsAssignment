import { describe, it, expect } from 'vitest';
import { effectivePrice, quotedOut, minOutWithSlippage, executedOut } from '../../utils/pricing.js';
// src/tests/unit/pricing.test.ts

describe('pricing utils', () => {
  it('computes effective price after fee', () => {
    const q = { dex: 'raydium', price: 2.0, fee: 0.003 } as any;
    expect(effectivePrice(q)).toBeCloseTo(1.994, 6);
  });

  it('computes quotedOut and minOut with slippage', () => {
    const q = { dex: 'meteora', price: 1.8, fee: 0.002 } as any;
    const quoted = quotedOut(10, q); // 10 * 1.8 * (1 - 0.002) = 17.964
    expect(quoted).toBeCloseTo(17.964, 6);
    const minOut = minOutWithSlippage(quoted, 100); // 1% slippage
    expect(minOut).toBeCloseTo(17.78436, 6);
  });

  it('computes executedOut', () => {
    const out = executedOut(5, 2.05, 0.003);
    // 5 * 2.05 = 10.25; 10.25 * 0.997 = 10.21925
    expect(out).toBeCloseTo(10.21925, 6);
  });
});
