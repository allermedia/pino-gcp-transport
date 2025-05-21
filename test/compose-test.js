import { Writable } from 'node:stream';
import { randomInt } from 'node:crypto';
import { pino } from 'pino';
import * as ck from 'chronokinesis';

import compose from '../src/index.js';
import { TRACE_ID_KEY } from '../src/constants.js';

describe('compose', () => {
  const msgs = [];
  /** @type {Writable} */
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
  afterEach(ck.reset);

  describe('options', () => {
    it('compose without options pipes to stdout', () => {
      const transport = compose();

      const logger = pino(transport);

      logger.info('foo');

      transport.destroy();
    });

    it('compose with destination stream pipes to destination', () => {
      const transport = compose({ destination, projectId: 'aller.se/aip-auth' });

      const logger = pino(transport);

      logger.info('foo');

      expect(msgs).to.have.length(1);

      transport.destroy();
    });

    it('ignore keys filters log properties', () => {
      const transport = compose({
        ignoreKeys: ['pid', 'hostname', 'level', 'msg', 'bar', 'time'],
        destination,
      });

      const logger = pino(transport);

      logger.info({ bar: 'baz', my: 'prop' }, 'foo');

      expect(msgs[0]).to.deep.equal({
        message: 'foo',
        severity: 'INFO',
        timestamp: { seconds: new Date().setMilliseconds(0) / 1000, nanos: new Date().getUTCMilliseconds() * 1e6 },
        my: 'prop',
      });

      transport.destroy();
    });

    it('no options is ok', () => {
      const transport = compose();
      const logger = pino(transport);

      logger.info({ bar: 'baz' }, 'foo');
    });
  });

  describe('options.projectId', () => {
    const projectId = `aip-auth-dev-${randomInt(10000000)}`;

    it('projectId in combination with trace id logs trace id', () => {
      const transport = compose({
        projectId,
        destination,
      });
      const logger = pino(
        {
          mixin() {
            return {
              [TRACE_ID_KEY]: 'trace-id',
            };
          },
        },
        transport
      );

      logger.info({ bar: 'baz' }, 'foo');

      const msg = msgs.pop();

      expect(msg).to.have.property(TRACE_ID_KEY, `trace-id`);
    });
  });
});
