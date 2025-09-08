import pino from 'pino';
export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard', colorize: true } }
    : undefined,
});
