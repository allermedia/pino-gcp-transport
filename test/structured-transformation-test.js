import { Writable, pipeline } from 'node:stream';

import abstractTransport from 'pino-abstract-transport';
import { pino } from 'pino';
import * as ck from 'chronokinesis';

import { StructuredTransformation } from '../src/index.js';
import { attachTraceIdHandler, getLogTrace } from '../src/tracing.js';
import { SPAN_ID_KEY, TRACE_ID_KEY } from '../src/constants.js';

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
});
