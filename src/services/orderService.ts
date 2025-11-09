import crypto from 'node:crypto';
import { orderQueue, defaultJobOpts } from '../queue/queue.js';
import { NewOrderInput } from '../domain/types.js';
import { pool } from '../db/db.js';

export async function createMarketOrder(input: NewOrderInput) {
  const id = crypto.randomUUID();

  // Persist the new order with initial status 'pending'
  await pool.query(
    `INSERT INTO orders (id, status, token_in, token_out, amount, slippage_bps)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, 'pending', input.tokenIn, input.tokenOut, input.amount, input.slippageBps]
  );

  // Enqueue job
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
