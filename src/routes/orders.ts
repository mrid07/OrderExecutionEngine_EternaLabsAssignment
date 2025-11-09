import { FastifyInstance } from 'fastify';
import { orderSchema } from '../domain/types.js';
import { createMarketOrder } from '../services/orderService.js';
import { subscribe } from '../ws/ws.js';
import { getStatuses, clearStatuses } from '../ws/state.js';
import { log } from '../utils/logger.js';

export async function registerOrderRoutes(app: FastifyInstance) {
  // POST: create order → { orderId }
  app.post('/api/orders/execute', async (req, reply) => {
    try {
      const body = await req.body;
      const parsed = orderSchema.safeParse(body);
      if (!parsed.success) {
        log.warn('POST /api/orders/execute invalid body', parsed.error.issues);
        return reply.code(400).send({ error: parsed.error.issues });
      }
      const result = await createMarketOrder(parsed.data);
      log.info('Created order', result.orderId);
      return reply.code(200).send(result);
    } catch (err: any) {
      log.error('POST /api/orders/execute error', err?.message || err);
      return reply.code(500).send({ error: 'internal_error' });
    }
  });
app.get('/api/orders/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { pool } = await import('../db/db.js');
  const o = await pool.query('select * from orders where id=$1', [id]);
  if (o.rowCount === 0) return reply.code(404).send({ error: 'not_found' });
  const h = await pool.query(
    'select status, payload, created_at from order_status_history where order_id=$1 order by id asc',
    [id]
  );
  return { order: o.rows[0], history: h.rows };
});

  // WS: same path (GET) → stream statuses
  app.get('/api/orders/execute', { websocket: true }, (connection, req) => {
    // Normalize: in some versions `connection` is the WS itself; in others it's { socket }
    const ws: any =
      (connection as any)?.socket && typeof (connection as any).socket.send === 'function'
        ? (connection as any).socket
        : (connection as any);

    const { orderId } = (req.query as any) ?? {};
    if (!orderId) {
      try { ws.send(JSON.stringify({ status: 'failed', error: 'orderId missing' })); } catch {}
      try { ws.close?.(); } catch {}
      return;
    }

    log.info(`[WS] open for order ${orderId}`);

    // 1) Subscribe first so we don't miss live events
    const unsubscribe = subscribe(orderId, (msg) => {
      try {
        ws.send(JSON.stringify({ orderId, ...msg }));
        // If terminal, close a tick later to ensure frame delivery
        if (msg.status === 'confirmed' || msg.status === 'failed') {
          setTimeout(() => {
            try { ws.close?.(); } catch {}
            unsubscribe();
            clearStatuses(orderId);
            log.info(`[WS] closed after terminal status for ${orderId}`);
          }, 150);
        }
      } catch (e) {
        log.error(`[WS] send error for ${orderId}`, e);
      }
    });

    // 2) Send initial 'pending'
    try {
      ws.send(JSON.stringify({ orderId, status: 'pending' }));
    } catch (e) {
      log.error(`[WS] initial pending send failed for ${orderId}`, e);
    }

    // 3) Replay any cached statuses (in case worker already published)
    try {
      const buffered = getStatuses(orderId);
      for (const msg of buffered) {
        ws.send(JSON.stringify({ orderId, ...msg }));
      }
      const last = buffered[buffered.length - 1];
      if (last && (last.status === 'confirmed' || last.status === 'failed')) {
        setTimeout(() => {
          try { ws.close?.(); } catch {}
          unsubscribe();
          clearStatuses(orderId);
          log.info(`[WS] closed after buffered terminal for ${orderId}`);
        }, 150);
      }
    } catch (e) {
      log.error(`[WS] replay failed for ${orderId}`, e);
    }

    // Wire close/error handlers
    try {
      ws.on?.('close', () => {
        unsubscribe();
        log.info(`[WS] client closed for ${orderId}`);
      });
      ws.on?.('error', (e: any) => {
        log.error(`[WS] socket error for ${orderId}`, e);
      });
    } catch {}
  });
}
