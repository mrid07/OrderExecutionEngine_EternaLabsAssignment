import type { Quote } from '../routers/dexRouterMock.js';

export const effectivePrice = (q: Quote) => q.price * (1 - q.fee);
export const quotedOut = (amountIn: number, q: Quote) => amountIn * effectivePrice(q);
export const minOutWithSlippage = (quotedOutAmount: number, slippageBps: number) =>
  quotedOutAmount * (1 - slippageBps / 10_000);
export const executedOut = (amountIn: number, executedPrice: number, fee: number) =>
  amountIn * executedPrice * (1 - fee);
