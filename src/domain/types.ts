import { z } from 'zod';

export const orderSchema = z.object({
  type: z.literal('market'),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amount: z.number().positive(),
  slippageBps: z.number().int().min(1).max(1000).default(100)
});

export type NewOrderInput = z.infer<typeof orderSchema>;
