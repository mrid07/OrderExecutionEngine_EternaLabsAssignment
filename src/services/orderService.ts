import crypto from 'node:crypto';
import { orderQueue, defaultJobOpts } from '../queue/queue.js';
import { NewOrderInput } from '../domain/types.js';

export async function createMarketOrder(input: NewOrderInput) {
  const id = crypto.randomUUID();

  await orderQueue.add(
    'execute',
    {
      orderId: id,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amount: input.amount,
      slippageBps: input.slippageBps,
    },
    defaultJobOpts
  );

  return { orderId: id };
}
