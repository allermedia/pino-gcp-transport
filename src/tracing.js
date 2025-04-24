import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

import { TRACE_ID_KEY, SPAN_ID_KEY } from './constants.js';

const store = new AsyncLocalStorage();

/** Recommended trace header in format "00-traceid-spanid-01" */
export const TRACEPARENT_HEADER_KEY = 'traceparent';

/** Legacy header in format "traceid/spanid;op=0" */
export const X_HEADER_KEY = 'x-cloud-trace-context';

export function getTraceId() {
  return store.getStore()?.get(TRACE_ID_KEY);
}

export function getSpanId() {
  return store.getStore()?.get(SPAN_ID_KEY);
}

/**
 * Get trace headers to forward downstream
 * @param {number} [flags] 1 = trace is sampled seems to be the only flag that is supported
 */
export function getTraceHeaders(flags = 0) {
  if (typeof flags !== 'number' || flags > 255 || flags < 0) {
    flags = 0;
  }

  /** @type {Map<string, string>} */
  const headers = new Map();

  const traceId = store.getStore()?.get(TRACE_ID_KEY);
  if (traceId) {
    const spanId = store.getStore().get(SPAN_ID_KEY);
    headers.set(X_HEADER_KEY, `${traceId}/${spanId};op=${(flags & 1) === 1 ? '1' : 0}`);
    headers.set(TRACEPARENT_HEADER_KEY, `00-${traceId}-${spanId}-${flags.toString(16).padStart(2, '0')}`);
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
 * @returns {Record<string, string>|undefined} object with trace logging parameters
 */
export function getLogTrace(projectId) {
  if (typeof projectId !== 'string') return;

  const traceId = store.getStore()?.get(TRACE_ID_KEY);
  if (!traceId) return;

  return {
    [TRACE_ID_KEY]: `projects/${projectId.trim()}/traces/${traceId}`,
    [SPAN_ID_KEY]: store.getStore().get(SPAN_ID_KEY),
  };
}

/**
 * Express trace id from header
 * @param {import('express').Request|import('fastify').FastifyRequest} req
 * @returns
 */
export function getTraceIdFromHeader(req) {
  let traceHeader;
  const spanId = randomBytes(8).toString('hex');

  if ((traceHeader = req.headers[TRACEPARENT_HEADER_KEY])) {
    // @ts-ignore
    const [, traceId] = traceHeader.split('-');
    return { traceId, spanId, fromHeader: TRACEPARENT_HEADER_KEY, headerValue: traceHeader };
  } else if ((traceHeader = req.headers[X_HEADER_KEY])) {
    // @ts-ignore
    const [traceId] = traceHeader.split('/');
    return { traceId, spanId, fromHeader: X_HEADER_KEY, headerValue: traceHeader };
  }

  return { traceId: randomBytes(16).toString('hex'), spanId, fromHeader: X_HEADER_KEY };
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
 * @param {{traceId:string, spanId:string}} tracing
 * @param {CallableFunction} callback
 */
function storeTracing({ traceId, spanId }, callback) {
  store.run(new Map(), () => {
    store.getStore().set(TRACE_ID_KEY, traceId);
    store.getStore().set(SPAN_ID_KEY, spanId);
    callback();
  });
}

/**
 * Attach trace and span id handler
 * @param {(...args:any[]) => Promise<any>} handler
 * @param {string} traceId
 * @param {string} spanId
 */
export function attachTraceIdHandler(handler, traceId, spanId) {
  return new Promise((resolve, reject) => {
    storeTracing({ traceId: traceId || randomBytes(16).toString('hex'), spanId }, async () => {
      try {
        const res = await handler();
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}
