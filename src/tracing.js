import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

import { TRACE_ID_KEY, SPAN_ID_KEY, SAMPLED_TRACE_KEY } from './constants.js';

const store = new AsyncLocalStorage();

/** Recommended trace header in format "00-traceid-spanid-01" */
export const TRACEPARENT_HEADER_KEY = 'traceparent';

/** Legacy header in format "traceid/spanid;op=0" */
export const X_HEADER_KEY = 'x-cloud-trace-context';

export const TRACING_FLAGS_KEY = 'tracingFlags';

export function getTraceId() {
  return store.getStore()?.get(TRACE_ID_KEY);
}

export function getSpanId() {
  return store.getStore()?.get(SPAN_ID_KEY);
}

export function getTracingFlags() {
  return store.getStore()?.get(TRACING_FLAGS_KEY);
}

/**
 * Get trace headers to forward downstream
 * @param {number} [flags] 1 = trace is sampled seems to be the only flag that is supported
 */
export function getTraceHeaders(flags) {
  const flagn = normalizeTracingFlags(flags ?? getTracingFlags());
  /** @type {Map<string, string>} */
  const headers = new Map();

  const traceId = store.getStore()?.get(TRACE_ID_KEY);
  if (traceId) {
    const spanId = store.getStore().get(SPAN_ID_KEY);
    headers.set(X_HEADER_KEY, `${traceId}/${spanId};op=${flagn & 1}`);
    headers.set(TRACEPARENT_HEADER_KEY, formatTraceparent(traceId, spanId, flagn));
  }

  return headers;
}

/**
 * Get trace headers as object
 * @param {number} [flags] optional trace flags
 * @returns {Record<string, string>}
 */
export function getTraceHeadersAsObject(flags) {
  return Object.fromEntries(getTraceHeaders(flags));
}

/**
 * Get tracing for logger suitable for mixin
 * @param {string} projectId google project id required to build the logging trace id key
 * @returns {Record<string, any>|undefined} object with trace logging parameters
 */
export function getLogTrace(projectId) {
  if (typeof projectId !== 'string') return;

  const traceId = store.getStore()?.get(TRACE_ID_KEY);
  if (!traceId) return;

  return {
    [TRACE_ID_KEY]: `projects/${projectId.trim()}/traces/${traceId}`,
    [SPAN_ID_KEY]: store.getStore().get(SPAN_ID_KEY),
    [SAMPLED_TRACE_KEY]: (store.getStore().get(TRACING_FLAGS_KEY) & 1) === 1,
  };
}

/**
 * Express trace id from header
 * @param {import('express').Request|import('fastify').FastifyRequest} req
 */
export function getTraceIdFromHeader(req) {
  let traceHeader;
  const spanId = createSpanId();
  let flags = 0;

  if ((traceHeader = req.headers[TRACEPARENT_HEADER_KEY])) {
    // @ts-ignore
    const [, traceId, , flagsStr] = traceHeader.split('-');
    flags = parseInt(flagsStr, 16);

    return { traceId, spanId, flags, fromHeader: TRACEPARENT_HEADER_KEY, headerValue: traceHeader };
  } else if ((traceHeader = req.headers[X_HEADER_KEY])) {
    // @ts-ignore
    const [traceId, spanOp] = traceHeader.split('/');
    if (spanOp) {
      const [, flagsStr] = spanOp.split(';op=');
      const flagsNo = flagsStr ? parseInt(flagsStr, 16) : 0;
      if (!isNaN(flagsNo)) flags = flagsNo;
    }
    return { traceId, spanId, flags, fromHeader: X_HEADER_KEY, headerValue: traceHeader };
  }

  return { traceId: createTraceId(), spanId, flags, fromHeader: X_HEADER_KEY };
}

/**
 * Create express tracing middleware
 */
export function middleware() {
  /**
   * Express middleware to extract trace header
   * @param {import('express').Request} req
   * @param {import('express').Response} _res
   * @param {import('express').NextFunction} next
   */
  return function tracingMiddleware(req, _res, next) {
    storeTracing(getTraceIdFromHeader(req), next);
  };
}

/**
 * Create fastify hook
 */
export function fastifyHook() {
  /**
   * Fastify middleware to extract trace header
   * @param {import('fastify').FastifyRequest} request
   * @param {import('fastify').FastifyReply} _reply
   * @param {import('fastify').DoneFuncWithErrOrRes} done
   */
  return function tracingMiddleware(request, _reply, done) {
    storeTracing(getTraceIdFromHeader(request), done);
  };
}

/**
 * Store tracing information
 * @param {{traceId:string, spanId:string, flags?:number}} tracing
 * @param {CallableFunction} callback
 */
export function storeTracing({ traceId, spanId, flags = 0 }, callback) {
  store.run(new Map(), () => {
    store.getStore().set(TRACE_ID_KEY, traceId);
    store.getStore().set(SPAN_ID_KEY, spanId);
    store.getStore().set(TRACING_FLAGS_KEY, flags);
    callback();
  });
}

/**
 * Attach trace and span id handler
 * @param {(...args:any[]) => Promise<any>} handler
 * @param {string} traceId
 * @param {string} spanId
 * @param {number} [flags] tracing flags
 */
export function attachTraceIdHandler(handler, traceId, spanId, flags = 0) {
  return new SpanContext(traceId, spanId, flags).runInCurrentSpanContext(handler);
}

/**
 * Create span context
 */
export class SpanContext {
  /**
   * @param {string} [traceId] parent trace id if any
   * @param {string} [spanId] parent span id if any
   * @param {number} [flags] 1 = sampled, defaults to 0
   */
  constructor(traceId, spanId, flags) {
    if (traceId) {
      this.traceId = traceId;
      this.spanId = spanId;
    } else {
      this.traceId = getTraceId() || createTraceId();
    }
    this.flags = flags ?? 0;
  }
  /**
   * Run function in new span context
   * @param {(...args:any) => Promise<any>} fn
   * @param  {...any} args arguments passed to handler
   */
  runInNewSpanContext(fn, ...args) {
    // @ts-ignore
    return new this.constructor(this.traceId, createSpanId(), this.flags).runInCurrentSpanContext(fn, ...args);
  }
  /**
   * Run function in current span context
   * @param {(...args:any) => Promise<any>} fn
   * @param  {...any} args arguments passed to handler
   */
  runInCurrentSpanContext(fn, ...args) {
    let spanId;
    if (!(spanId = this.spanId)) {
      this.spanId = spanId = createSpanId();
    }

    return new Promise((resolve, reject) => {
      // @ts-ignore
      storeTracing({ traceId: this.traceId, spanId, flags: this.flags }, async () => {
        try {
          const res = await fn(...args);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

/**
 * Create new trace id
 * @returns 16 random bytes as hex
 */
export function createTraceId() {
  return randomBytes(16).toString('hex');
}

/**
 * Create new span id
 * @returns 8 random bytes as hex string
 */
export function createSpanId() {
  return randomBytes(8).toString('hex');
}

/**
 * Format traceparent header value
 * @param {string} [traceId] parent trace ID
 * @param {string} [spanId] parent span ID
 * @param {number|string} [flags] flags as number
 * @returns "00-traceid-spanid-hex(flags)"
 */
export function formatTraceparent(traceId, spanId, flags = 0) {
  return `00-${traceId || createTraceId()}-${spanId || createSpanId()}-${Number(normalizeTracingFlags(flags)).toString(16).padStart(2, '0')}`;
}

/**
 * @param {number|string} [flags] numeric tracing flags
 */
function normalizeTracingFlags(flags) {
  let flagn = Number(flags);
  if (isNaN(flagn) || flagn > 255 || flagn < 0) {
    flagn = 0;
  }
  return flagn;
}
