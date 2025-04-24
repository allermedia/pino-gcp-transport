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
