import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { publish } from '../ws/ws.js';
import { pushStatus } from '../ws/state.js';
import { MockDexRouter } from '../routers/dexRouterMock.js';
import { log } from '../utils/logger.js';
import { pool } from '../db/db.js';

const connection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// 🔹 Rate limit to ~100 jobs/min
export const orderQueue = new Queue(env.QUEUE_NAME, {
  connection,
  limiter: { max: 100, duration: 60_000 },
});

const router = new MockDexRouter();

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippageBps: number;
}

// 🔹 Retries with exponential backoff (≤3 attempts total)
export const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 500 },
  removeOnComplete: true,
  removeOnFail: false,
};

// Persist + publish helper
async function persistAndPublish(orderId: string, status: string, payload: any = {}) {
  const msg = { status, ...payload };

  // Update DB (status history + current status)
  await pool.query('INSERT INTO order_status_history(order_id, status, payload) VALUES ($1,$2,$3)',
    [orderId, status, payload]);
  await pool.query('UPDATE orders SET status=$2 WHERE id=$1', [orderId, status]);

  // Notify WS
  pushStatus(orderId, msg);
  publish(orderId, msg);
  log.info(`[PUB] ${orderId}`, msg);
}

export function startWorker() {
  const worker = new Worker<OrderJobData>(
    env.QUEUE_NAME,
    async (job) => {
      const { orderId, tokenIn, tokenOut, amount, slippageBps } = job.data;

      // 1) Routing
      await persistAndPublish(orderId, 'routing');

      const r = await router.routeBest(tokenIn, tokenOut, amount);
      log.info(`[ROUTE] ${orderId} compare`, r.compared);
      log.info(`[ROUTE] ${orderId} chosen`, r.best);

      await persistAndPublish(orderId, 'building', { dex: r.best.dex, quote: r.best });

      // 2) Slippage parameters
      const quotedEffective = r.best.price * (1 - r.best.fee);
      const amountOutQuoted = amount * quotedEffective;
      const minOutFactor = 1 - slippageBps / 10_000;
      const minOut = amountOutQuoted * minOutFactor;

      await persistAndPublish(orderId, 'submitted', { dex: r.best.dex, minOutFactor });

      // 3) Execute (may drift / transient fail)
      try {
        const exec = await router.executeSwap(r.best.dex, tokenIn, tokenOut, r.best.price);

        const executedEffective = exec.executedPrice * (1 - r.best.fee);
        const amountOutExecuted = amount * executedEffective;

        if (amountOutExecuted < minOut) {
          const errMsg = `Slippage exceeded: expected >= ${minOut.toFixed(6)}, got ${amountOutExecuted.toFixed(6)}`;
          log.warn(`[SLIPPAGE] ${orderId} ${errMsg}`);

          // Persist failure reason on orders table
          await pool.query(
            'UPDATE orders SET status=$2, failure_reason=$3 WHERE id=$1',
            [orderId, 'failed', errMsg]
          );
          await pool.query(
            'INSERT INTO order_status_history(order_id,status,payload) VALUES ($1,$2,$3)',
            [orderId, 'failed', { error: errMsg, dex: r.best.dex }]
          );

          pushStatus(orderId, { status: 'failed', error: errMsg, dex: r.best.dex });
          publish(orderId, { status: 'failed', error: errMsg, dex: r.best.dex });
          return; // no retry on slippage breach
        }

        await persistAndPublish(orderId, 'confirmed', {
          txHash: exec.txHash,
          executedPrice: exec.executedPrice,
          dex: r.best.dex,
          amountOut: Number(amountOutExecuted.toFixed(6)),
        });
      } catch (e: any) {
        if (e?.transient) {
          // transient -> let BullMQ retry
          log.warn(`[RETRY] ${orderId} transient error: ${e.message}`);
          throw e;
        }
        // non-transient: persist and fail
        const msg = e?.message || 'execution_error';
        log.error(`[EXEC-ERROR] ${orderId} ${msg}`);

        await pool.query(
          'UPDATE orders SET status=$2, failure_reason=$3 WHERE id=$1',
          [orderId, 'failed', msg]
        );
        await pool.query(
          'INSERT INTO order_status_history(order_id,status,payload) VALUES ($1,$2,$3)',
          [orderId, 'failed', { error: msg, dex: r.best.dex }]
        );

        pushStatus(orderId, { status: 'failed', error: msg, dex: r.best.dex });
        publish(orderId, { status: 'failed', error: msg, dex: r.best.dex });
        return;
      }
    },
    { connection, concurrency: env.CONCURRENCY } // 🔹 up to 10 concurrent jobs
  );

  // If retries exhausted / processor threw on final attempt
  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { orderId } = job.data as OrderJobData;
    const msg = err?.message ?? 'unknown';
    log.error(`[WORKER-FAILED] ${orderId} ${msg}`);

    await pool.query(
      'UPDATE orders SET status=$2, failure_reason=$3 WHERE id=$1',
      [orderId, 'failed', msg]
    );
    await pool.query(
      'INSERT INTO order_status_history(order_id,status,payload) VALUES ($1,$2,$3)',
      [orderId, 'failed', { error: msg }]
    );

    pushStatus(orderId, { status: 'failed', error: msg });
    publish(orderId, { status: 'failed', error: msg });
  });

  return worker;
}
