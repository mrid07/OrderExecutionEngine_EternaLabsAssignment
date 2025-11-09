import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';              // <-- add
import { env } from './config/env.js';
import { registerOrderRoutes } from './routes/orders.js';
import { startWorker } from './queue/queue.js';
import { log } from './utils/logger.js';

async function main() {
  startWorker();

  const app = Fastify({ logger: false });
  await app.register(websocket);
  await app.register(cors, { origin: true });  // <-- allow all origins (ok for dev)
  await registerOrderRoutes(app);

  await app.listen({ host: '0.0.0.0', port: env.PORT });
  log.info(`Server listening on http://localhost:${env.PORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
