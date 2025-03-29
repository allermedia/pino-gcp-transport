# pino-gcp-transport

Convert stdout logging to structured json suitable for google cloud logging.

[![Build](https://github.com/allermedia/pino-gcp-transport/actions/workflows/build.yaml/badge.svg)](https://github.com/allermedia/pino-gcp-transport/actions/workflows/build.yaml)

## Configure

### Logging

- `destination`: optional integer or string, integer `1` = stdout which is default, if a string is used the destination will be considered a log file, e.g. `./logs/test.log`
- `append`: optional boolean, set to false if you want test logging to be reset between test runs, passed to [`sonic-boom`](https://www.npmjs.com/package/sonic-boom)
- `[key]`: any other options that can be passed to [`sonic-boom`](https://www.npmjs.com/package/sonic-boom)

### The projectId

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

## Setup example

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
