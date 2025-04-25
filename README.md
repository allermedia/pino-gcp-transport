# pino-gcp-transport

Convert pino stdout logging to structured json suitable for google cloud logging.

[![Build](https://github.com/allermedia/pino-gcp-transport/actions/workflows/build.yaml/badge.svg)](https://github.com/allermedia/pino-gcp-transport/actions/workflows/build.yaml)

## Api

Exported as ESM and commonjs.

- [`compose()`](#composeoptions-transformation--structuredtransformation) Compose transport to get google structured log
- [`middleware()`](#middleware) Express middleware to collect tracing
- [`fastifyHook()`](#fastifyhook) Fastify hook to collect tracing
- [`getTraceHeadersAsObject()`](#gettraceheadersasobjectflags--0) Get collected tracing headers as object to forward to downstream calls
- [`logger.js`](#logger-example) Logger example
- [Examples](/example/README.md) Middleware and logging examples

### `compose([options[, Transformation = StructuredTransformation]])`

Compose transport to get structured log. Default and named export.

**Arguments**:

- `options`: optional structured transport options
  - `ignoreKeys`: optional list of pino ignore keys, filters what log line keys are sent to `jsonPayload`, defaults to `['hostname', 'pid', 'level', 'time', 'msg']`
  - `destination`: optional integer or string, integer `1` = stdout which is default, if a string is used the destination will be considered a log file, e.g. `./logs/test.log`
  - `append`: optional boolean, set to false if you want file test logging to be reset between test runs, passed to [`sonic-boom`](https://www.npmjs.com/package/sonic-boom)
  - `[key]`: any other options that can be passed to [`sonic-boom`](https://www.npmjs.com/package/sonic-boom)
- `Transformation`: optional transformation stream type, defaults to builtin `StructuredTransformation` stream type, will be called with new. Can be used to override with extended StructuredTransformation type

```javascript
import pino from 'pino';
import compose, { getLogTrace } from '@aller/pino-gcp-transport';

export const logger = pino(
  {
    mixin() {
      return { ...getLogTrace(process.env.MYAPP_projectId) };
    },
  },
  compose({
    ignoreKeys: ['message', 'hostname', 'pid', 'level', 'time', 'msg'],
  })
);
```

### `middleware()`

Function to create express middleware that collects Opentelemetry headers if any.

```javascript
import express from 'express';
import { middleware } from '@aller/pino-gcp-transport';

const app = express();

app.use(middleware());
```

### `fastifyHook()`

Function to create fastify hook that collects Opentelemetry headers if any.

```javascript
import fastify from 'fastify';
import { fastifyHook } from '@aller/pino-gcp-transport';

const app = fastify();

app.addHook('onRequest', fastifyHook());
```

### `getLogTrace(projectId)`

Used in mixin to get trace context logging params. Named export.

**Arguments**:

- `projectId`: required string [google project id](#the-projectid)

**Returns**

Object with structured log keys `logging.googleapis.com/trace` and `logging.googleapis.com/spanId`.

```javascript
import { getLogTrace } from '@aller/pino-gcp-transport';
import pino from 'pino';

export const logger = pino({
  mixin() {
    return { ...getLogTrace(process.env.MYAPP_projectId) };
  },
});
```

### `getTraceHeaders([flags = 0])`

Used to forward tracing to donwstream calls. Named export.

**Arguments**:

- `flags`: optional positive integer, below 256, tracing flag, 0 = not sampled, 1 = sampled

**Returns**

Map with trace headers `traceparent` and legacy `x-cloud-trace-context`.

```javascript
import pino from 'pino';
import compose, { getTraceHeaders, getLogTrace } from '@aller/pino-gcp-transport';

export const logger = pino(
  {
    mixin() {
      return { ...getLogTrace(process.env.MYAPP_projectId) };
    },
  },
  compose()
);

await fetch('http://localhost:11434/get', {
  headers: Object.fromEntries(getTraceHeaders()),
}).catch((err) => {
  logger.error(err);
});
```

### `getTraceHeadersAsObject([flags = 0])`

Same as [`getTraceHeaders`](#gettraceheadersflags--0) but returns object.

## Setup example

### Express middleware

```javascript
import pino from 'pino';
import express from 'express';
import request from 'supertest';

import compose, { middleware, getLogTrace, getTraceHeadersAsObject } from '@aller/pino-gcp-transport';

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
    // pass your tracing headers to a downstream service
    await request('https://example.com')
      .get('/')
      .set(getTraceHeadersAsObject(req.query.flags ? Number(req.query.flags) : undefined));
    res.send({});
  } catch (err) {
    next(err);
  }
});

app.use('/log/request', (req, res) => {
  logger.info(req);
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
await request(app).get('/log/request').expect(200);
```

### Fastify hook

```javascript
import pino from 'pino';
import fastify from 'fastify';

import compose, { fastifyHook, getLogTrace, getTraceHeadersAsObject } from '@aller/pino-gcp-transport';

const logOptions = {
  level: 'trace',
  mixin() {
    return { ...getLogTrace('aller-project-1') };
  },
};

const logger = pino(logOptions, compose());

const app = fastify({
  logger: logOptions,
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

// For testing
await app.inject().get('/log/request');
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

## The projectId

To be able to log trace the google project id needs to be passed to the mixin function `getLogTrace(projectId)`. Undefined is returned if called without project id.

The project id is used to format the log parameter `logging.googleapis.com/trace` formatted as `projects/${projectId.trim()}/traces/${traceId}`

If deploying with terraform you can pick the id from your project resource, e.g:

```terraform
locals {
  env_pfx = "MYAPP_"
}

resource "google_cloud_run_v2_service" "myapp" {
  template {
    containers {
      image = "gcr.io/cloudrun/hello"

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }
      env {
        name  = "ENV_PREFIX"
        value = local.env_pfx
      }
      env {
        name  = "INTERPRET_CHAR_AS_DOT"
        value = "_"
      }

      # The google project eventually picked up by exp-config as config.projectId, or just use as process.env.MYAPP_projectId
      env {
        name  = "${local.env_pfx}projectId"
        value = google_project.default.project_id
      }
```
