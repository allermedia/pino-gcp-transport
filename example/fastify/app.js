import { fileURLToPath } from 'node:url';

import config from 'exp-config';
import fastify from 'fastify';
import { fastifyHook, getTraceHeadersAsObject, getLogTrace } from '@aller/pino-gcp-transport';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

import logger from '../logger.js';

const app = fastify({
  logger: {
    level: config.logging?.level || 'debug',
    mixin() {
      return { ...getLogTrace(config.projectId) };
    },
  },
  logInstance: logger,
});

app.addHook('onRequest', fastifyHook());

app.get('/', (request, reply) => {
  request.log.info('hello world');
  reply.send({ hello: 'world' });
});

app.get('/downstream', async (request, reply) => {
  logger.debug('foo');
  const res = await fetch('https://example.com', {
    method: 'GET',
    headers: {
      ...getTraceHeadersAsObject(request.query.flags ? Number(request.query.flags) : undefined),
    },
  });

  logger.info({ ok: res.ok }, 'bar');

  reply.send({});
});

app.get('/log/request', (request, reply) => {
  logger.info(request, 'foo');
  reply.send({});
});

app.get('/log/error', (request, reply) => {
  logger.error(new Error(request.query.message ?? 'expected'));
  reply.send({});
});

if (isMainModule) {
  app.listen({ port: process.env.PORT ? Number(process.env.PORT) : 3000 }, (_err, address) => {
    logger.debug('app listening to %d', address.port);
  });
}

export { app };
