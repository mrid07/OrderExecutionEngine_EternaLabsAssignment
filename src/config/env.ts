import * as dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
  REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),
  QUEUE_NAME: process.env.QUEUE_NAME ?? 'orders',
  CONCURRENCY: Number(process.env.CONCURRENCY ?? 10),
};
