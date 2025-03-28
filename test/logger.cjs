'use strict';

const pino = require('pino');
const transport = require('../lib/index.cjs');
const { TRACE_ID_KEY, getTraceId, attachTraceIdHandler } = require('../lib/index.cjs');

const logger = pino(
  {
    level: 'trace',
    mixin() {
      return {
        [TRACE_ID_KEY]: getTraceId(),
      };
    },
  },
  // transport({ destination: './logs/test.log', projectId: 'aller-project-1', sync: true, append: false })
  transport({ destination: 1, projectId: 'aller-project-1', sync: true })
);

attachTraceIdHandler(
  () => {
    logger.debug('foo');
    logger.info('bar');
    logger.warn('baz');
    logger.error(new Error('expected'), 'error');
    logger.fatal(new Error('expected'), 'critical');
  },
  'trace-1',
  'span-2'
);
