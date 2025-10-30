import { Writable } from 'node:stream';

import fastify from 'fastify';
import nock from 'nock';
import pino from 'pino';

import compose, { fastifyHook, getTraceHeadersAsObject, getLogTrace } from '@aller/pino-gcp-transport';

describe('fastify', () => {
  /** @type {fastify.Application} */
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

    app = fastify();
    app.addHook('onRequest', fastifyHook());

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

    app.route({
      method: ['GET', 'POST'],
      url: '/log/request',
      handler: (req, res) => {
        logger.info(req);
        res.send({});
      },
    });

    app.get('/log/error', (req, res) => {
      logger.error(new Error(req.query.message ?? 'expected'));
      res.send({});
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

      await app.inject({ method: 'GET', path: '/downstream' });

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

      await app.inject().get('/downstream').headers({ 'X-Cloud-Trace-Context': 'traceid/spanid;op=0' });

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('x-cloud-trace-context')
        .that.match(/^traceid\/[0-9a-f]{16};op=0$/);

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-00$/);
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

      await app.inject().get('/downstream').headers({ traceparent: '00-traceid-spanid-00' });

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-00/);
    });

    it('request with double traceparents header forwards the first trace header to downstream calls', async () => {
      const downstreamCall = new Promise((resolve) =>
        nock('https://example.local')
          .get('/')
          .reply(function reply() {
            resolve({ headers: this.req.headers });
            return [200, {}];
          })
      );

      await app
        .inject()
        .get('/downstream')
        .headers({ traceparent: ['00-traceid1-spanid1-00', '00-traceid2-spanid2-00'] });

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid1-[0-9a-f]{16}-00/);
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

      await app.inject().get('/downstream').headers({ traceparent: '00-traceid-spanid-00' }).query({ flags: '1' });

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-01/);
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

      await app.inject().get('/downstream').headers({ traceparent: '00-traceid-spanid-00' }).query({ flags: 17 });

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

      await app.inject().get('/downstream').headers({ traceparent: '00-traceid-spanid-00' }).query({ flags: '256' });

      const { headers } = await downstreamCall;

      expect(headers)
        .to.have.property('traceparent')
        .that.match(/00-traceid-[0-9a-f]{16}-00/);
    });
  });

  describe('logging', () => {
    it('logs calls with trace keys', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app.inject().get('/downstream').headers({ traceparent: '00-traceid-spanid-00' }).query({ flags: '256' });

      const msg = logMessages.pop();

      expect(msg).to.deep.include({ message: 'foo', 'logging.googleapis.com/trace': 'projects/aller-project-1/traces/traceid' });
    });

    it('logs calls with trace keys disregaring trace header casing', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app.inject().get('/downstream').headers({ TracePArent: '00-traceid-spanid-00' }).query({ flags: '256' });

      const msg = logMessages.pop();

      expect(msg).to.deep.include({ message: 'foo', 'logging.googleapis.com/trace': 'projects/aller-project-1/traces/traceid' });
    });

    it('multiple trace headers logs first header', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app
        .inject()
        .get('/log/request')
        .headers({
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'aller.local',
          'user-agent': 'curl',
          traceparent: ['00-traceid1-spanid1-00', '00-traceid2-spanid2-00'],
        });

      const logMsg = logMessages.pop();

      expect(logMsg).to.have.property('logging.googleapis.com/trace', 'projects/aller-project-1/traces/traceid1');
    });

    it('logging request maps request to logging httpRequest', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app.inject().get('/log/request').headers({
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'aller.local',
        'user-agent': 'curl',
        traceparent: '00-traceid-spanid-00',
      });

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

      await app.inject().post('/log/request');

      const logMsg = logMessages.pop();

      /** @type {import('../types/transformation.js').IHttpRequest} */
      const logReq = logMsg.httpRequest;

      expect(logReq).to.have.property('requestMethod', 'POST');
    });

    it('logging request without message composes message from request', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app.inject().post('/log/request');

      expect(logMessages.pop()).to.have.property('message', 'POST /log/request');
    });

    it('logging error maps error message to message', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app.inject().get('/log/error').query({ message: 'unexpected' });

      const logMsg = logMessages.pop();

      expect(logMsg).to.have.property('message', 'unexpected');
    });

    it('logging error maps error stack sourceLocation', async () => {
      nock('https://example.local').get('/').reply(200, {});

      await app.inject().get('/log/error').query({ message: 'unexpected' });

      const logMsg = logMessages.pop();

      expect(logMsg).to.have.property('logging.googleapis.com/sourceLocation');
      expect(logMsg['logging.googleapis.com/sourceLocation']).to.have.property('file').that.is.ok;
      expect(logMsg['logging.googleapis.com/sourceLocation']).to.have.property('line').that.is.a('number');
    });
  });
});
