import { Writable } from 'node:stream';

import express from 'express';
import request from 'supertest';
import nock from 'nock';
import pino from 'pino';

import compose from '../src/index.js';
import { middleware, getTraceHeadersAsObject, getLogTrace } from '../src/tracing.js';

describe('middleware', () => {
  /** @type {express.Application} */
  let app;
  /** @type {pino.Logger} */
  let logger;

  const logMessages = [];
  before(() => {
    const destination = new Writable({
      autoDestroy: true,
      objectMode: true,
      write(chunk, _encoding, callback) {
        logMessages.push(chunk);
        callback();
      },
    });

    logger = pino(
      {
        level: 'trace',
        mixin() {
          return { ...getLogTrace('aller-project-1') };
        },
      },
      compose({ projectId: 'aller-project-1', destination })
    );

    app = express();
    app.use(middleware());

    app.get('/downstream', async (req, res, next) => {
      try {
        logger.debug('foo');
        await fetch('https://example.local', {
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
  });

  after(() => {
    nock.cleanAll();
  });

  describe('trace headers', () => {
    it('request without trace headers forwards new trace headers to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').expect(200);

      const { headers } = await downstreamCall;

      expect(headers).to.have.property('traceparent');
      expect(headers).to.have.property('x-cloud-trace-context');
    });

    it('request with legacy X-Cloud-Trace-Context header forwards trace headers to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('X-Cloud-Trace-Context', 'traceid/spanid;op=0').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('x-cloud-trace-context')
        .that.match(/^traceid\/[0-9a-f]{16};op=0$/);

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-00$/);
    });

    it('request with legacy sampled X-Cloud-Trace-Context header forwards trace headers to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('X-Cloud-Trace-Context', 'sampledtraceid/spanid;op=1').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('x-cloud-trace-context')
        .that.match(/^sampledtraceid\/[0-9a-f]{16};op=1$/);

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-sampledtraceid-[0-9a-f]{16}-01$/);
    });

    it('request with legacy X-Cloud-Trace-Context without op flags sets op flags to 0', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('X-Cloud-Trace-Context', 'sampledtraceid/spanid').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('x-cloud-trace-context')
        .that.match(/^sampledtraceid\/[0-9a-f]{16};op=0$/);

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-sampledtraceid-[0-9a-f]{16}-00$/);
    });

    it('request with legacy X-Cloud-Trace-Context with malformed flags sets op flags to 0', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('X-Cloud-Trace-Context', 'sampledtraceid/spanid;pop=malformed').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('x-cloud-trace-context')
        .that.match(/^sampledtraceid\/[0-9a-f]{16};op=0$/);

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-sampledtraceid-[0-9a-f]{16}-00$/);
    });

    it('request with legacy X-Cloud-Trace-Context with NaN op sets flags to 0', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('X-Cloud-Trace-Context', 'sampledtraceid/spanid;op=malformed').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('x-cloud-trace-context')
        .that.match(/^sampledtraceid\/[0-9a-f]{16};op=0$/);

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-sampledtraceid-[0-9a-f]{16}-00$/);
    });

    it('request with traceparent header forwards trace headers to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('traceparent', '00-traceid-spanid-00').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-00/);
    });

    it('settings trace flags to 1 forwards trace headers with flags to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('traceparent', '00-traceid-spanid-00').query({ flags: '1' }).expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-01/);
    });

    it('sampled traceparent forwards sampled to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('traceparent', '00-sampledtraceid-spanid-01').expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-sampledtraceid-[0-9a-f]{16}-01/);
    });

    it('settings trace flags to 16 forwards trace headers with flags to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('traceparent', '00-traceid-spanid-00').query({ flags: 17 }).expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-11/);
    });

    it('settings trace flags above 255 uses default trace flags to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await request(app).get('/downstream').set('traceparent', '00-traceid-spanid-00').query({ flags: '256' }).expect(200);

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-00/);
    });
  });

  describe('logging', () => {
    it('logs calls with trace keys', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app).get('/downstream').set('traceparent', '00-traceid-spanid-00').query({ flags: '256' }).expect(200);

      const msg = logMessages.pop();

      expect(msg).to.deep.include({ message: 'foo', 'logging.googleapis.com/trace': 'projects/aller-project-1/traces/traceid' });
    });

    it('logs calls with trace keys regardless of trace header casing', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app).get('/downstream').set('TraceParent', '00-traceid-spanid-00').query({ flags: '256' }).expect(200);

      const msg = logMessages.pop();

      expect(msg).to.deep.include({ message: 'foo', 'logging.googleapis.com/trace': 'projects/aller-project-1/traces/traceid' });
    });

    it('logging request maps request to logging httpRequest', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app)
        .get('/log/request')
        .set('x-forwarded-proto', 'https')
        .set('x-forwarded-host', 'aller.local')
        .set('user-agent', 'curl')
        .set('traceparent', '00-traceid-spanid-00')
        .expect(200);

      const logMsg = logMessages.pop();

      /** @type {import('../types/transformation.js').IHttpRequest} */
      const logReq = logMsg.httpRequest;

      expect(logReq).to.deep.equal({
        requestMethod: 'GET',
        protocol: 'https',
        requestUrl: '/log/request',
        userAgent: 'curl',
      });
    });

    it('logging request maps request method POST to logging httpRequest', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app).post('/log/request').expect(200);

      const logMsg = logMessages.pop();

      /** @type {import('../types/transformation.js').IHttpRequest} */
      const logReq = logMsg.httpRequest;

      expect(logReq).to.have.property('requestMethod', 'POST');
    });

    it('logging request without message composes message from request', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app).post('/log/request').expect(200);

      expect(logMessages.pop()).to.have.property('message', 'POST /log/request');
    });

    it('logging error maps error message to message', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app).get('/log/error').query({ message: 'unexpected' }).expect(200);

      const logMsg = logMessages.pop();

      expect(logMsg).to.have.property('message', 'unexpected');
    });

    it('logging error maps error stack sourceLocation', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await request(app).get('/log/error').query({ message: 'unexpected' }).expect(200);

      const logMsg = logMessages.pop();

      expect(logMsg).to.have.property('logging.googleapis.com/sourceLocation');
      expect(logMsg['logging.googleapis.com/sourceLocation']).to.have.property('file').that.is.ok;
      expect(logMsg['logging.googleapis.com/sourceLocation']).to.have.property('line').that.is.a('number');
    });
  });
});
