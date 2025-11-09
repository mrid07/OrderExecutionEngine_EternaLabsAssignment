import { FastifyInstance } from 'fastify';
import { orderSchema } from '../domain/types.js';
import { createMarketOrder } from '../services/orderService.js';
import { subscribe } from '../ws/ws.js';
import { log } from '../utils/logger.js';
import { URL } from 'node:url';

function safeSend(ws: any, obj: any) {
  try {
    if (!ws) return;
    // ws from @fastify/websocket is 'ws' lib instance
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  } catch (e: any) {
    log.error('[WS] safeSend error', { err: e?.message });
  }
}

export async function registerOrderRoutes(app: FastifyInstance) {
  // POST -> returns { orderId }
  app.post('/api/orders/execute', async (req, reply) => {
    const body = await req.body;
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues });
    }
    const result = await createMarketOrder(parsed.data);
    return reply.code(200).send(result);
  });

  // WS on SAME PATH (GET) for status streaming
  app.get('/api/orders/execute', { websocket: true }, (connection, req) => {
    try {
      const fullUrl = `http://localhost${req.url}`;
      const url = new URL(fullUrl);
      const orderId = url.searchParams.get('orderId') ?? '';
      const ws = connection.socket;

      log.info('[WS] connect', { orderId });

      if (!orderId) {
        safeSend(ws, { status: 'failed', error: 'orderId missing' });
        setTimeout(() => ws?.close(1008, 'orderId missing'), 30);
        return;
      }

      // immediate pending
      safeSend(ws, { orderId, status: 'pending' });

      const unsubscribe = subscribe(orderId, (msg) => {
        // send every lifecycle update, but NEVER throw
        safeSend(ws, { orderId, ...msg });

        // on terminal status, close gracefully after a brief delay
        if (msg.status === 'confirmed' || msg.status === 'failed') {
          log.info('[WS] terminal status, closing soon', { orderId, status: msg.status });
          unsubscribe();
          setTimeout(() => {
            try { ws?.close(1000, 'done'); } catch {}
          }, 30);
        }
      });

      // heartbeat (prevents some proxies from dropping connection)
      const pingTimer = setInterval(() => {
        try {
          // @fastify/websocket exposes ws with ping()
          if (ws && ws.readyState === ws.OPEN && typeof ws.ping === 'function') {
            ws.ping();
          }
        } catch {}
      }, 15000);

      ws.on('close', (code: number, reason: Buffer) => {
        clearInterval(pingTimer);
        unsubscribe();
        log.info('[WS] client closed', { orderId, code, reason: reason?.toString?.() });
      });

      ws.on('error', (err: any) => {
        log.error('[WS] socket error', { orderId, err: err?.message });
      });
    } catch (err: any) {
      log.error('[WS] handler error', { err: err?.message });
      try { connection.socket.close(1011, 'server error'); } catch {}
    }
  });
}
