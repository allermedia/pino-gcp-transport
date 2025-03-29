import { fileURLToPath } from 'node:url';

import express from 'express';
import { middleware, getTraceHeadersAsObject } from '@aller/pino-gcp-transport';

import logger from './logger.js';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

const app = express();

app.use(middleware());

app.get('/downstream', async (req, res, next) => {
  try {
    logger.debug('foo');
    await fetch('https://example.com', {
      method: 'GET',
      headers: {
        ...getTraceHeadersAsObject(req.query.flags ? Number(req.query.flags) : undefined),
      },
    });
    res.send({});
  } catch (err) {
    next(err);
  }
});

app.use('/log/request', (req, res) => {
  logger.info(req, 'foo');
  res.send({});
});

app.get('/log/error', (req, res) => {
  logger.error(new Error(req.query.message ?? 'expected'));
  res.send({});
});

app.use((err, _req, res, next) => {
  if (!(err instanceof Error)) return next();

  logger.error(err);
  res.status(500).send({ message: err.message });
});

if (isMainModule) {
  const server = app.listen(process.env.PORT ? Number(process.env.PORT) : 3000, () => {
    logger.debug('app listening to %d', server.address().port);
  });
}

export { app };
