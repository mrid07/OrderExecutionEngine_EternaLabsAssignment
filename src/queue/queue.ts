import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { publish } from '../ws/ws.js';
import { MockDexRouter } from '../routers/dexRouterMock.js';
import { log } from '../utils/logger.js';

const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const orderQueue = new Queue(env.QUEUE_NAME, { connection });

const router = new MockDexRouter();

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippageBps: number;
}

export const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 500 },
  removeOnComplete: true,
  removeOnFail: false,
};

export function startWorker() {
  const worker = new Worker<OrderJobData>(
    env.QUEUE_NAME,
    async (job) => {
      const { orderId, tokenIn, tokenOut, amount, slippageBps } = job.data;
      const update = (status: string, payload: any = {}) =>
        publish(orderId, { status, ...payload });

      await update('routing');

      const best = await router.routeBest(tokenIn, tokenOut, amount);
      log.info(`Order ${orderId} routed to: ${best.dex}`);

      await update('building', { dex: best.dex, quote: best });
      await update('submitted', { dex: best.dex, minOutFactor: 1 - slippageBps / 10_000 });

      const exec = await router.executeSwap(best.dex, tokenIn, tokenOut, amount);
      await update('confirmed', { txHash: exec.txHash, executedPrice: exec.executedPrice, dex: best.dex });
    },
    { connection, concurrency: env.CONCURRENCY }
  );

  worker.on('failed', (job, err) => {
    if (!job) return;
    publish(job.data.orderId, { status: 'failed', error: err?.message ?? 'unknown' });
    log.error(`Order ${job.data.orderId} failed`, err);
  });

  return worker;
}
