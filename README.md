# pino-gcp-transport

Convert stdout logging to structured json suitable for google cloud logging

## Setup example

```javascript
import pino from 'pino';
import express from 'express';
import request from 'supertest';

import compose, { getLogTrace, middleware, getTraceHeadersAsObject } from '@aller/pino-gcp-transport';

const logger = pino(
  {
    level: 'trace',
    mixin() {
      return { ...getLogTrace('aller-project-1') };
    },
  },
  compose()
);

const app = express();
app.use(middleware());

app.get('/downstream', async (req, res, next) => {
  try {
    logger.debug('foo');
    await request('https://example.com')
      .get('/')
      .set(getTraceHeadersAsObject(req.query.flags ? Number(req.query.flags) : undefined));
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

// For testing
await request(app).get('/downstream').expect(200);
```

## Logger example

```js
import config from 'exp-config';
import { pino } from 'pino';

import { getLogTrace } from '@aller/pino-gcp-transport';

const destination = config.logging?.target === 'file' ? `./logs/${config.envName}.log` : 1;

const targets = [];
if (config.logging.prettify) {
  targets.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: "yyyy-mm-dd'T'HH:MM:ss.l",
      destination,
      append: false,
    },
  });
} else {
  targets.push({
    target: '@aller/pino-gcp-transport',
    options: {
      destination,
      append: false,
    },
  });
}

const transport = pino.transport({ targets });

export default pino(
  {
    level: config.logging?.level || 'debug',
    mixin() {
      return { ...getLogTrace(config.projectId) };
    },
  },
  transport
);
```
