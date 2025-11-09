import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: undefined, // don't include pid/hostname
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', singleLine: false },
      }
    : undefined,
});

export const log = {
  info: (msg: string, obj?: any) => logger.info(obj ?? {}, msg),
  warn: (msg: string, obj?: any) => logger.warn(obj ?? {}, msg),
  error: (msg: string, obj?: any) => logger.error(obj ?? {}, msg),
  child: (bindings: Record<string, any>) => logger.child(bindings),
};
