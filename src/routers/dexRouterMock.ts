import { sleep } from '../utils/sleep.js';

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function mockTxHash() {
  return '0x' + Math.floor(Math.random() * 1e16).toString(16) + Date.now().toString(16);
}

export type Quote = { dex: 'raydium' | 'meteora'; price: number; fee: number };
export type ExecutionResult = { txHash: string; executedPrice: number; dex: Quote['dex'] };

export class MockDexRouter {
  basePrice(tokenIn: string, tokenOut: string) {
    const seed = (tokenIn + tokenOut).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return 1 + (seed % 100) / 50; // ~1.0 to 3.0
  }

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(200);
    const base = this.basePrice(tokenIn, tokenOut);
    return { dex: 'raydium', price: base * randBetween(0.98, 1.02), fee: 0.003 };
  }

  async getMeteoraQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(200);
    const base = this.basePrice(tokenIn, tokenOut);
    return { dex: 'meteora', price: base * randBetween(0.97, 1.03), fee: 0.002 };
  }

  async routeBest(tokenIn: string, tokenOut: string, amount: number) {
    const [r, m] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteoraQuote(tokenIn, tokenOut, amount),
    ]);
    const effR = r.price * (1 - r.fee);
    const effM = m.price * (1 - m.fee);
    return effR >= effM ? r : m;
  }

  async executeSwap(dex: Quote['dex'], tokenIn: string, tokenOut: string, amount: number): Promise<ExecutionResult> {
    await sleep(2000 + Math.random() * 1000);
    const base = this.basePrice(tokenIn, tokenOut);
    const executedPrice = base * randBetween(0.98, 1.02);
    return { txHash: mockTxHash(), executedPrice, dex };
  }
}
