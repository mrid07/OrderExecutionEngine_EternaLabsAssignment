import { sleep } from '../utils/sleep.js';

/**
 * A realistic mock for Raydium/Meteora routing:
 * - Adds small network delays when quoting
 * - Randomizes price within a tight band per DEX
 * - Can inject transient errors
 * - Simulates execute latency and slight price drift
 */

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function pick<T>(a: T, b: T, p = 0.5): T {
  return Math.random() < p ? a : b;
}
function mockTxHash() {
  return '0x' + Math.floor(Math.random() * 1e16).toString(16) + Date.now().toString(16);
}

export type Dex = 'raydium' | 'meteora';
export type Quote = { dex: Dex; price: number; fee: number }; // price = outPerIn (tokenOut/tokenIn)
export type ExecutionResult = { txHash: string; executedPrice: number; dex: Dex };

// For tests/customization
export interface MockRouterOptions {
  // % chance (0..1) that a quote call fails transiently
  quoteFailureRate?: number;
  // % chance a swap call fails transiently (network/rpc)
  executeFailureRate?: number;
  // quote latency ranges (ms)
  quoteDelayMs?: [number, number];
  // execute latency ranges (ms)
  executeDelayMs?: [number, number];
  // price drift on execution vs quote, e.g. ±1.5%
  executionDriftPct?: number; // 0.015 -> ±1.5%
}

export class MockDexRouter {
  private opts: Required<MockRouterOptions>;

  constructor(opts: MockRouterOptions = {}) {
    this.opts = {
      quoteFailureRate: opts.quoteFailureRate ?? 0.03,
      executeFailureRate: opts.executeFailureRate ?? 0.05,
      quoteDelayMs: opts.quoteDelayMs ?? [120, 260],
      executeDelayMs: opts.executeDelayMs ?? [1800, 2800],
      executionDriftPct: opts.executionDriftPct ?? 0.015,
    };
  }

  /** Deterministic(ish) base price per pair for stability across runs */
  basePrice(tokenIn: string, tokenOut: string) {
    const seed = (tokenIn + '->' + tokenOut).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    // ~1.00 to 3.50
    return 1.0 + (seed % 250) / 100;
  }

  private async maybeFailTransient(p: number) {
    if (Math.random() < p) {
      const err: any = new Error('Transient network error');
      err.transient = true;
      throw err;
    }
  }

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(randBetween(...this.opts.quoteDelayMs));
    await this.maybeFailTransient(this.opts.quoteFailureRate);

    const base = this.basePrice(tokenIn, tokenOut);
    // Raydium: fee 0.30%, price within ±1.2%
    return { dex: 'raydium', price: base * randBetween(0.988, 1.012), fee: 0.003 };
  }

  async getMeteoraQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(randBetween(...this.opts.quoteDelayMs));
    await this.maybeFailTransient(this.opts.quoteFailureRate);

    const base = this.basePrice(tokenIn, tokenOut);
    // Meteora: fee 0.20%, price within ±1.6%
    return { dex: 'meteora', price: base * randBetween(0.984, 1.016), fee: 0.002 };
  }

  /** Choose the best effective price (after fee) */
  async routeBest(tokenIn: string, tokenOut: string, amount: number) {
    // Occasionally fetch sequentially to simulate staggered responses
    const sequential = pick(true, false, 0.3);
    let r: Quote, m: Quote;

    if (sequential) {
      r = await this.getRaydiumQuote(tokenIn, tokenOut, amount);
      m = await this.getMeteoraQuote(tokenIn, tokenOut, amount);
    } else {
      const [rq, mq] = await Promise.all([
        this.getRaydiumQuote(tokenIn, tokenOut, amount),
        this.getMeteoraQuote(tokenIn, tokenOut, amount),
      ]);
      r = rq; m = mq;
    }

    const effR = r.price * (1 - r.fee);
    const effM = m.price * (1 - m.fee);
    const best = effR >= effM ? r : m;

    return {
      best,
      compared: {
        raydium: { price: r.price, fee: r.fee, effective: effR },
        meteora: { price: m.price, fee: m.fee, effective: effM },
      },
    };
  }

  /**
   * Simulate execution on the selected DEX:
   * - Latency 1.8–2.8s
   * - A bit of price drift vs quoted price
   * - Occasional transient failure
   */
  async executeSwap(
    dex: Dex,
    tokenIn: string,
    tokenOut: string,
    quotedPrice: number
  ): Promise<ExecutionResult> {
    await sleep(randBetween(...this.opts.executeDelayMs));
    await this.maybeFailTransient(this.opts.executeFailureRate);

    // drift ±executionDriftPct around quotedPrice
    const drift = 1 + randBetween(-this.opts.executionDriftPct, this.opts.executionDriftPct);
    const executedPrice = quotedPrice * drift;

    return { txHash: mockTxHash(), executedPrice, dex };
  }
}
