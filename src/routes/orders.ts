import { FastifyInstance } from 'fastify';
import { orderSchema } from '../domain/types.js';
import { createMarketOrder } from '../services/orderService.js';
import { subscribe } from '../ws/ws.js';

export async function registerOrderRoutes(app: FastifyInstance) {
  app.post('/api/orders/execute', async (req, reply) => {
    const body = await req.body;
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues });
    }
    const result = await createMarketOrder(parsed.data);
    return reply.code(200).send(result);
  });

  app.get('/api/orders/execute', { websocket: true }, (connection, req) => {
    const { orderId } = (req.query as any) ?? {};
    if (!orderId) {
      connection.socket.send(JSON.stringify({ status: 'failed', error: 'orderId missing' }));
      connection.socket.close();
      return;
    }
    const unsubscribe = subscribe(orderId, (msg) => {
      connection.socket.send(JSON.stringify({ orderId, ...msg }));
      if (msg.status === 'confirmed' || msg.status === 'failed') {
        unsubscribe();
        connection.socket.close();
      }
    });

    connection.socket.send(JSON.stringify({ orderId, status: 'pending' }));

    connection.socket.on('close', () => {
      unsubscribe();
    });
  });
}
