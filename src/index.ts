import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerOrderRoutes } from './routes/orders.js';
import { startWorker } from './queue/queue.js';
import { migrate } from './db/db.js';

async function main() {
  // 1) Migrate DB
  try {
    await migrate();
  } catch (e: any) {
    console.error('[MIGRATE] Error:', e?.message || e);
    // Optional: exit if migrations fail
    // process.exit(1);
  }

  // 2) Start worker (BullMQ)
  startWorker();
  console.log('[WORKER] Started');

  // 3) Start API
  const app = Fastify({ logger: false });
  app.addHook('onRequest', async (req, _reply) => {
    // lightweight access log
    const { method, url, ip } = req;
    // you can add userId etc. later
    // log.info('http_request', { method, url, ip });
  }); 

  await app.register(websocket);
  await app.register(cors, { origin: true });
  await registerOrderRoutes(app);

  await app.listen({ host: '0.0.0.0', port: env.PORT });
  console.log(`Server listening on http://localhost:${env.PORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
