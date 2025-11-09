import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { publish } from '../ws/ws.js';
import { pushStatus } from '../ws/state.js';
import { MockDexRouter } from '../routers/dexRouterMock.js';
import { log } from '../utils/logger.js';

const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // BullMQ requirement for blocking ops:
  maxRetriesPerRequest: null,
  // helps startup in some environments
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
  backoff: { type: 'exponential', delay: 500 }, // 0.5s, 1s, 2s...
  removeOnComplete: true,
  removeOnFail: false,
};

export function startWorker() {
  const worker = new Worker<OrderJobData>(
    env.QUEUE_NAME,
    async (job) => {
      const { orderId, tokenIn, tokenOut, amount, slippageBps } = job.data;

      // synchronous helper: log -> cache -> publish
      const update = (status: string, payload: any = {}) => {
        const msg = { status, ...payload };
        log.info(`[PUB] ${orderId}`, msg);
        pushStatus(orderId, msg);
        publish(orderId, msg);
      };

      // 1) Routing
      update('routing');

      const r = await router.routeBest(tokenIn, tokenOut, amount);
      log.info(`[ROUTE] ${orderId} compare`, r.compared);
      log.info(`[ROUTE] ${orderId} chosen`, r.best);

      update('building', { dex: r.best.dex, quote: r.best });

      // 2) Slippage protection params
      const quotedEffective = r.best.price * (1 - r.best.fee);
      const amountOutQuoted = amount * quotedEffective;
      const minOutFactor = 1 - slippageBps / 10_000;
      const minOut = amountOutQuoted * minOutFactor;

      update('submitted', { dex: r.best.dex, minOutFactor });

      // 3) Execute (can drift or transient-fail)
      try {
        const exec = await router.executeSwap(r.best.dex, tokenIn, tokenOut, r.best.price);

        const executedEffective = exec.executedPrice * (1 - r.best.fee);
        const amountOutExecuted = amount * executedEffective;

        if (amountOutExecuted < minOut) {
          const errMsg = `Slippage exceeded: expected >= ${minOut.toFixed(6)}, got ${amountOutExecuted.toFixed(6)}`;
          log.warn(`[SLIPPAGE] ${orderId} ${errMsg}`);
          update('failed', { error: errMsg, dex: r.best.dex });
          return; // no retry on slippage breach
        }

        update('confirmed', {
          txHash: exec.txHash,
          executedPrice: exec.executedPrice,
          dex: r.best.dex,
          amountOut: Number(amountOutExecuted.toFixed(6)),
        });
      } catch (e: any) {
        if (e?.transient) {
          // let BullMQ retry
          log.warn(`[RETRY] ${orderId} transient error: ${e.message}`);
          throw e;
        }
        // non-transient: mark failed (no retry)
        log.error(`[EXEC-ERROR] ${orderId} ${e?.message || e}`);
        update('failed', { error: e?.message || 'execution_error', dex: r.best.dex });
        return;
      }
    },
    { connection, concurrency: env.CONCURRENCY }
  );

  // If retries exhaust or a job fails outside our try/catch
  worker.on('failed', (job, err) => {
    if (!job) return;
    const { orderId } = job.data as OrderJobData;
    const msg = err?.message ?? 'unknown';
    log.error(`[WORKER-FAILED] ${orderId} ${msg}`);
    // also push to buffers & publish so any connected WS is notified
    const payload = { status: 'failed', error: msg };
    pushStatus(orderId, payload);
    publish(orderId, payload);
  });

  return worker;
}
