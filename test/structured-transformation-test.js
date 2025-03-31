import { Writable, pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

import abstractTransport from 'pino-abstract-transport';
import { pino } from 'pino';
import * as ck from 'chronokinesis';

import { StructuredTransformation } from '../src/index.js';
import { attachTraceIdHandler, getLogTrace } from '../src/tracing.js';
import { SPAN_ID_KEY, TRACE_ID_KEY, STACK_PATTERN } from '../src/constants.js';

describe('StructuredTransformation', () => {
  afterEach(ck.reset);

  const msgs = [];
  let destination;
  beforeEach(() => {
    ck.freeze();

    msgs.splice(0);
    destination = new Writable({
      autoDestroy: true,
      objectMode: true,
      write(chunk, _encoding, callback) {
        msgs.push(chunk);
        callback();
      },
    });
  });

  it('transform string to object and writes to destination', () => {
    const transport = abstractTransport(
      (source) => {
        pipeline(source, new StructuredTransformation(), destination, () => {});
      },
      { parse: 'lines' }
    );

    const logger = pino(transport);

    logger.info({ bar: 'baz' }, 'foo');

    expect(msgs[0]).to.deep.equal({
      message: 'foo',
      severity: 'INFO',
      timestamp: new Date(),
      bar: 'baz',
    });
  });

  it('forwards mixin of trace id to destination', async () => {
    await attachTraceIdHandler(() => {
      const transport = abstractTransport(
        (source) => {
          pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
        },
        {
          parse: 'lines',
        }
      );

      const logger = pino(
        {
          mixin() {
            return {
              ...getLogTrace('aller-auth-1'),
            };
          },
        },
        transport
      );

      logger.info({ bar: 'baz' }, 'foo');

      expect(msgs[0]).to.deep.equal({
        message: 'foo',
        severity: 'INFO',
        timestamp: new Date(),
        bar: 'baz',
        [TRACE_ID_KEY]: 'projects/aller-auth-1/traces/abc-123',
      });
    }, 'abc-123');
  });

  it('forwards mixin of span id to destination', async () => {
    await attachTraceIdHandler(
      () => {
        const transport = abstractTransport(
          (source) => {
            pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
          },
          {
            parse: 'lines',
          }
        );

        const logger = pino(
          {
            level: 'trace',
            mixin() {
              return {
                ...getLogTrace('aller-auth-1'),
              };
            },
          },
          transport
        );

        logger.debug({ bar: 'baz' }, 'foo');

        expect(msgs[0]).to.deep.equal({
          message: 'foo',
          severity: 'DEBUG',
          timestamp: new Date(),
          bar: 'baz',
          [TRACE_ID_KEY]: 'projects/aller-auth-1/traces/abc-123',
          [SPAN_ID_KEY]: '54321',
        });
      },
      'abc-123',
      '54321'
    );
  });

  it('maps level to severity', () => {
    const transport = abstractTransport(
      (source) => {
        pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
      },
      {
        parse: 'lines',
      }
    );

    const logger = pino({ level: 'trace' }, transport);

    logger.trace('foo');
    expect(msgs.pop(), 'trace').to.have.property('severity', 'DEBUG');

    logger.debug('foo');
    expect(msgs.pop(), 'debug').to.have.property('severity', 'DEBUG');

    logger.warn('foo');
    expect(msgs.pop(), 'warn').to.have.property('severity', 'WARNING');

    logger.error('foo');
    expect(msgs.pop(), 'error').to.have.property('severity', 'ERROR');

    logger.fatal('foo');
    expect(msgs.pop(), 'fatal').to.have.property('severity', 'CRITICAL');
  });

  it('stack trace parsing groups stack to sourceLocation', () => {
    const stack =
      'Error: unexpected\n' +
      '    at file:///lib/app/pino-gcp-transport/test/middleware-test.js:62:20\n' +
      '    at Layer.handle [as handle_request] (/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js:95:5)\n' +
      '    at next (/lib/app/pino-gcp-transport/node_modules/express/lib/router/route.js:149:13)\n' +
      '    at Route.dispatch (/lib/app/pino-gcp-transport/node_modules/express/lib/router/route.js:119:3)\n' +
      '    at Layer.handle [as handle_request] (/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js:95:5)\n' +
      '    at /lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:284:15\n' +
      '    at Function.process_params (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:346:12)\n' +
      '    at next (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:280:10)\n' +
      '    at file:///lib/app/pino-gcp-transport/src/tracing.js:106:7\n' +
      '    at AsyncLocalStorage.run (node:async_hooks:346:14)\n' +
      '    at tracingMiddleware (file:///lib/app/pino-gcp-transport/src/tracing.js:103:11)\n' +
      '    at Layer.handle [as handle_request] (/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js:95:5)\n' +
      '    at trim_prefix (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:328:13)\n' +
      '    at /lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:286:9\n' +
      '    at Function.process_params (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:346:12)\n' +
      '    at next (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:280:10)\n' +
      '    at expressInit (/lib/app/pino-gcp-transport/node_modules/express/lib/middleware/init.js:40:5)\n' +
      '    at Layer.handle [as handle_request] (/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js:95:5)\n' +
      '    at trim_prefix (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:328:13)\n' +
      '    at /lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:286:9\n' +
      '    at Function.process_params (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:346:12)\n' +
      '    at next (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:280:10)\n' +
      '    at query (/lib/app/pino-gcp-transport/node_modules/express/lib/middleware/query.js:45:5)\n' +
      '    at Layer.handle [as handle_request] (/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js:95:5)\n' +
      '    at trim_prefix (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:328:13)\n' +
      '    at /lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:286:9\n' +
      '    at Function.process_params (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:346:12)\n' +
      '    at next (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:280:10)\n' +
      '    at Function.handle (/lib/app/pino-gcp-transport/node_modules/express/lib/router/index.js:175:3)\n' +
      '    at Function.handle (/lib/app/pino-gcp-transport/node_modules/express/lib/application.js:181:10)\n' +
      '    at Server.app (/lib/app/pino-gcp-transport/node_modules/express/lib/express.js:39:9)\n' +
      '    at Server.emit (node:events:524:28)\n' +
      '    at parserOnIncoming (node:_http_server:1141:12)\n' +
      '    at HTTPParser.parserOnHeadersComplete (node:_http_common:118:17)';

    const stackToSourceLocationPattern = new RegExp(STACK_PATTERN, 'mg');

    const stackMatch = [];
    stack.replace(stackToSourceLocationPattern, (...args) => {
      stackMatch.push(args.pop());
    });

    expect(stackMatch.length).to.equal(stack.split('\n').length - 1);

    expect(stackMatch[0].file, stackMatch[0].file).to.match(/^file:.+test\/middleware-test\.js$/);
    expect(stackMatch[0].line, stackMatch[0].file).to.equal('62');

    expect(stackMatch[28].file, stackMatch[28].file).to.match(/^\/.+pino-gcp-transport\/node_modules\/express\/lib\/router\/index.js$/);
    expect(stackMatch[28].line, stackMatch[28].file).to.equal('175');
    expect(stackMatch[28].function, stackMatch[28].file).to.equal('Function.handle');
  });

  it('maps error stack to source location', () => {
    const transport = abstractTransport(
      (source) => {
        pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
      },
      {
        parse: 'lines',
      }
    );

    const logger = pino({ level: 'trace' }, transport);

    logger.error(new Error('foo'));

    const logMsg = msgs.pop();

    expect(logMsg).to.have.property('logging.googleapis.com/sourceLocation');
    expect(logMsg['logging.googleapis.com/sourceLocation'])
      .to.have.property('file')
      .that.equal(`file://${fileURLToPath(import.meta.url)}`);
    expect(logMsg['logging.googleapis.com/sourceLocation']).to.have.property('line').that.is.a('number');
    expect(logMsg['logging.googleapis.com/sourceLocation']).to.have.property('function', 'Context.<anonymous>');
  });

  it('maps error stack with function to source location', () => {
    const transport = abstractTransport(
      (source) => {
        pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
      },
      {
        parse: 'lines',
      }
    );

    const logger = pino({ level: 'trace' }, transport);

    logger.error({
      err: {
        stack: 'Error: unexpected\nat expressInit (/lib/app/pino-gcp-transport/node_modules/express/lib/middleware/init.js:40:5)\n',
      },
    });

    let logMsg = msgs.pop();
    expect(logMsg).to.have.property('logging.googleapis.com/sourceLocation');
    expect(logMsg['logging.googleapis.com/sourceLocation']).to.deep.equal({
      file: '/lib/app/pino-gcp-transport/node_modules/express/lib/middleware/init.js',
      line: 40,
      function: 'expressInit',
    });

    logger.error({
      err: {
        stack:
          'Error: unexpected\n    at Layer.handle [as handle_request] (/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js:95:5)\n',
      },
    });

    logMsg = msgs.pop();
    expect(logMsg).to.have.property('logging.googleapis.com/sourceLocation');
    expect(logMsg['logging.googleapis.com/sourceLocation']).to.deep.equal({
      file: '/lib/app/pino-gcp-transport/node_modules/express/lib/router/layer.js',
      line: 95,
      function: 'Layer.handle',
    });

    logger.error({
      err: {
        stack: 'Error: unexpected\n    at parserOnIncoming (node:_http_server:1141:12)\n',
      },
    });

    logMsg = msgs.pop();
    expect(logMsg).to.have.property('logging.googleapis.com/sourceLocation');
    expect(logMsg['logging.googleapis.com/sourceLocation']).to.deep.equal({
      file: 'node:_http_server',
      line: 1141,
      function: 'parserOnIncoming',
    });
  });

  it('ignores error stack parsing if no stack', () => {
    const transport = abstractTransport(
      (source) => {
        pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
      },
      {
        parse: 'lines',
      }
    );

    const logger = pino({ level: 'trace' }, transport);

    logger.error({ err: {} });

    const logMsg = msgs.pop();

    expect(logMsg).to.not.have.property('logging.googleapis.com/sourceLocation');
  });

  it('ignores error if malformatted stack parsing', () => {
    const transport = abstractTransport(
      (source) => {
        pipeline(source, new StructuredTransformation(null, { projectId: 'aller-auth-1' }), destination, () => {});
      },
      {
        parse: 'lines',
      }
    );

    const logger = pino({ level: 'trace' }, transport);

    logger.error({
      err: {
        stack: 'Error: unexpected\n    at Layer.handle [as handle_request]\n',
      },
    });

    const logMsg = msgs.pop();
    expect(logMsg).to.not.have.property('logging.googleapis.com/sourceLocation');
  });
});
