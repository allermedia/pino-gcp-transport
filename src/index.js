import { Transform, promises as streamPromises } from 'node:stream';

import abstractTransport from 'pino-abstract-transport';
import SonicBoom from 'sonic-boom';

import {
  SEVERITY_CRITICAL,
  SEVERITY_DEBUG,
  SEVERITY_ERROR,
  SEVERITY_INFO,
  SEVERITY_WARNING,
  SOURCELOCATION_KEY,
  STACK_PATTERN,
} from './constants.js';

export * from './tracing.js';
export * from './constants.js';

/**
 * Transform pino log record to Google Cloud logging
 *
 * logstream -> transform-to-gcp -> stdout
 *
 * @extends {Transform}
 */
export class StructuredTransformation extends Transform {
  /** Log line key names to ignore when extracting properties */
  ignoreKeys = ['hostname', 'pid', 'level', 'time', 'msg'];
  /**

  * @constructor
   * @param {import('stream').TransformOptions} [options] - optional stream options
   * @param {import('types').StructuredTransformationConfig} [config] - optional transform options
   */
  constructor(options, config) {
    super({ ...options, objectMode: true });
    this.ignoreKeys = config?.ignoreKeys || this.ignoreKeys;
  }
  /**
   * @param {string | object} chunk
   * @param {string} _encoding
   * @param {CallableFunction} callback
   */
  _transform(chunk, _encoding, callback) {
    const structured = this.convertToStructured(chunk);
    callback(null, structured);
  }
  /**
   * Convert to structured object
   * @param {string | object} chunk
   * @returns {import('google').StructuredJson}
   */
  convertToStructured(chunk) {
    const line = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
    const severity = this.convertToSeverity(line.level);

    const timestamp = new Date(line.time);

    return {
      message: line.msg,
      ...this.extractProperties(line),
      timestamp: {
        nanos: timestamp.getUTCMilliseconds() * 1e6,
        seconds: Math.floor(timestamp.setUTCMilliseconds(0) / 1000),
      },
      severity,
    };
  }
  /**
   * Convert pino log level to SeverityLevel
   * @param {number} level
   * @returns {string}
   */
  convertToSeverity(level) {
    switch (level) {
      case 30:
        return SEVERITY_INFO;
      case 40:
        return SEVERITY_WARNING;
      case 50:
        return SEVERITY_ERROR;
      case 60:
        return SEVERITY_CRITICAL;
      default:
        return SEVERITY_DEBUG;
    }
  }
  /**
   * Extract properties from log line
   * @param {any} line
   */
  extractProperties(line) {
    const ignoreKeys = this.ignoreKeys;

    /** @type {import('google').StructuredJson} */
    const properties = {};
    for (const [k, v] of Object.entries(line)) {
      if (v === null || v === undefined) continue;

      switch (k) {
        case 'req': {
          if (!line.msg) {
            properties.message = `${v.method} ${v.url}`;
          }

          /** @type {import('google').IHttpRequest} */
          const httpReq = {
            requestMethod: v.method,
            requestUrl: v.url,
            userAgent: v.headers?.['user-agent'],
            protocol: v.headers?.['x-forwarded-proto'],
          };
          properties.httpRequest = httpReq;
          break;
        }
        case 'err': {
          if (!ignoreKeys?.includes(k)) {
            properties[k] = v;
          }

          const stack = v.stack ?? v;

          if (typeof stack !== 'string') {
            break;
          }

          properties.textPayload = stack;

          const line = stack.match(STACK_PATTERN)?.groups;

          if (line) {
            properties[SOURCELOCATION_KEY] = {
              file: line.file,
              line: Number(line.line),
              function: line.function,
            };
          }
          break;
        }
        default: {
          if (ignoreKeys?.includes(k)) break;
          properties[k] = v;
        }
      }
    }

    return properties;
  }
}

/**
 * Compose transport to write google cloud structured log
 * @param {import('types').StructuredTransformationConfig} opts - transport options
 * @param {typeof StructuredTransformation|typeof Transform} [Transformation] - optional structured transformation stream
 * @returns {ReturnType<typeof import('pino-abstract-transport')>}
 */
export default function compose(opts, Transformation = StructuredTransformation) {
  /** @type {import('node:events').EventEmitter[]} */
  const destinations = [new Transformation({ objectMode: true, autoDestroy: true }, opts)];
  if (typeof opts?.destination?.write === 'function') {
    destinations.push(opts.destination);
  } else {
    destinations.push(
      new Transform({
        objectMode: true,
        autoDestroy: true,
        transform(chunk, _encoding, callback) {
          callback(null, JSON.stringify(chunk) + '\n');
        },
      })
    );
    destinations.push(new SonicBoom({ dest: opts?.destination ?? 1, ...opts }));
  }

  return abstractTransport(
    // @ts-ignore
    (source) => {
      destinations.unshift(source);

      // @ts-ignore
      return streamPromises.pipeline(destinations);
    },
    {
      parseLine: true,
    }
  );
}
