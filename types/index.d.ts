declare module '@aller/pino-gcp-transport' {
	import type { Transform } from 'node:stream';
	import type { SonicBoomOpts } from 'sonic-boom';
  /**
   * Compose Application Insights pino transport
   * @param opts - transport options
   * @param Transformation - optional Telemetry transformation stream
   * */
  export default function compose(opts: StructuredTransformationConfig, Transformation?: typeof StructuredTransformation): ReturnType<typeof import("pino-abstract-transport")>;
  /**
   * Transform pino log record to Google Cloud logging
   *
   * logstream -> transform-to-gcp -> stdout
   *
   * 
   */
  export class StructuredTransformation extends Transform {
	  /**
	
	  * @param options - optional stream options
	   * @param config - optional transform options
	   */
	  constructor(options?: import("stream").TransformOptions, config?: StructuredTransformationConfig);
	  /** Log line key names to ignore when extracting properties */
	  ignoreKeys: string[];
	  
	  _transform(chunk: string | object, _encoding: string, callback: CallableFunction): void;
	  /**
	   * Convert to telemetryish object
	   * */
	  convertToStructured(chunk: string | object): StructuredJson;
	  /**
	   * Convert pino log level to SeverityLevel
	   * */
	  convertToSeverity(level: number): string;
	  /**
	   * Extract properties from log line
	   * */
	  extractProperties(line: any, ignoreKeys?: string[]): any;
  }
  interface StructuredTransformationConfig extends SonicBoomOpts {
	/**
	 * pino ignore keys, filters Telemetry properties
	 * @default {string[]} hostname pid, level, time, msg
	 */
	ignoreKeys?: string[];
	[k: string]: any;
  }
	export function getTraceId(): any;
	export function getSpanId(): any;
	/**
	 * Get trace headers to forward downstream
	 * @param flags 1 = trace is sampled seems to be the only flag that is supported
	 */
	export function getTraceHeaders(flags?: number): Map<string, string>;
	/**
	 * Get trace headers as object
	 * @param flags trace flags
	 * */
	export function getTraceHeadersAsObject(flags: number): Record<string, string>;
	/**
	 * Get tracing for logger suitable for mixin
	 * @param projectId google project id required to build the logging trace id key
	 * @returns object with trace logging parameters
	 */
	export function getLogTrace(projectId: string): Record<string, string> | undefined;
	/**
	 * Express trace id from header
	 * */
	export function getTraceIdFromHeader(req: import("express").Request): {
		traceId: string;
		spanId: string;
		fromHeader: string;
		headerValue: string;
	} | {
		traceId: string;
		spanId: string;
		fromHeader: string;
		headerValue?: undefined;
	};
	/**
	 * Create express tracing middleware
	 */
	export function middleware(): (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => void;
	/**
	 * Attach trace and span id handler
	 * */
	export function attachTraceIdHandler(handler: (...args: any[]) => Promise<any>, traceId: string, spanId: string): Promise<any>;
	/** Recommended trace header in format "00-traceid-spanid-01" */
	export const TRACEPARENT_HEADER_KEY: "traceparent";
	/** Legacy header in format "traceid/spanid;op=0" */
	export const X_HEADER_KEY: "x-cloud-trace-context";
	/** @type {string} Debug or trace information. */
	export const SEVERITY_DEBUG: string;
	/** @type {string} Routine information, such as ongoing status or performance. */
	export const SEVERITY_INFO: string;
	/** @type {string} Normal but significant events, such as start up, shut down, or a configuration change. */
	export const SEVERITY_NOTICE: string;
	/** @type {string} Warning events might cause problems. */
	export const SEVERITY_WARNING: string;
	/** @type {string} Error events are likely to cause problems. */
	export const SEVERITY_ERROR: string;
	/** @type {string} Critical events cause more severe problems or outages. */
	export const SEVERITY_CRITICAL: string;
	/** @type {string} A person must take an action immediately. */
	export const SEVERITY_ALERT: string;
	/** @type {string} One or more systems are unusable. */
	export const SEVERITY_EMERGENCY: string;
	export const TRACE_ID_KEY: "logging.googleapis.com/trace";
	export const SPAN_ID_KEY: "logging.googleapis.com/spanId";
	export const SOURCELOCATION_KEY: "logging.googleapis.com/sourceLocation";
	export const STACK_PATTERN: RegExp;
  /*!
   * Copyright 2015 Google Inc. All Rights Reserved.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *      http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  const INSERT_ID_KEY = 'logging.googleapis.com/insertId';
  const LABELS_KEY = 'logging.googleapis.com/labels';
  const OPERATION_KEY = 'logging.googleapis.com/operation';
  const SOURCE_LOCATION_KEY = 'logging.googleapis.com/sourceLocation';
  const SPAN_ID_KEY_1 = 'logging.googleapis.com/spanId';
  const TRACE_KEY = 'logging.googleapis.com/trace';
  const TRACE_SAMPLED_KEY = 'logging.googleapis.com/trace_sampled';

  interface StructuredJson {
	message?: string | object;
	httpRequest?: IHttpRequest;
	timestamp?: Date;
	[INSERT_ID_KEY]?: string;
	[OPERATION_KEY]?: object;
	[SOURCE_LOCATION_KEY]?: object;
	[LABELS_KEY]?: object;
	[SPAN_ID_KEY_1]?: string;
	[TRACE_KEY]?: string;
	[TRACE_SAMPLED_KEY]?: boolean;
	logName?: string;
	resource?: object;
	[key: string]: unknown;
  }

  interface IHttpRequest {
	/** HttpRequest requestMethod */
	requestMethod?: string | null;

	/** HttpRequest requestUrl */
	requestUrl?: string | null;

	/** HttpRequest requestSize */
	requestSize?: number | string | null;

	/** HttpRequest status */
	status?: number | null;

	/** HttpRequest responseSize */
	responseSize?: number | string | null;

	/** HttpRequest userAgent */
	userAgent?: string | null;

	/** HttpRequest remoteIp */
	remoteIp?: string | null;

	/** HttpRequest serverIp */
	serverIp?: string | null;

	/** HttpRequest referer */
	referer?: string | null;

	/** HttpRequest latency */
	latency?: string | null;

	/** HttpRequest cacheLookup */
	cacheLookup?: boolean | null;

	/** HttpRequest cacheHit */
	cacheHit?: boolean | null;

	/** HttpRequest cacheValidatedWithOriginServer */
	cacheValidatedWithOriginServer?: boolean | null;

	/** HttpRequest cacheFillBytes */
	cacheFillBytes?: number | string | null;

	/** HttpRequest protocol */
	protocol?: string | null;
  }

	export {};
}

declare module '@aller/pino-gcp-transport/tracing' {
	export function getTraceId(): any;
	export function getSpanId(): any;
	/**
	 * Get trace headers to forward downstream
	 * @param flags 1 = trace is sampled seems to be the only flag that is supported
	 */
	export function getTraceHeaders(flags?: number): Map<string, string>;
	/**
	 * Get trace headers as object
	 * @param flags trace flags
	 * */
	export function getTraceHeadersAsObject(flags: number): Record<string, string>;
	/**
	 * Get tracing for logger suitable for mixin
	 * @param projectId google project id required to build the logging trace id key
	 * @returns object with trace logging parameters
	 */
	export function getLogTrace(projectId: string): Record<string, string> | undefined;
	/**
	 * Express trace id from header
	 * */
	export function getTraceIdFromHeader(req: import("express").Request): {
		traceId: string;
		spanId: string;
		fromHeader: string;
		headerValue: string;
	} | {
		traceId: string;
		spanId: string;
		fromHeader: string;
		headerValue?: undefined;
	};
	/**
	 * Create express tracing middleware
	 */
	export function middleware(): (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => void;
	/**
	 * Attach trace and span id handler
	 * */
	export function attachTraceIdHandler(handler: (...args: any[]) => Promise<any>, traceId: string, spanId: string): Promise<any>;
	/** Recommended trace header in format "00-traceid-spanid-01" */
	export const TRACEPARENT_HEADER_KEY: "traceparent";
	/** Legacy header in format "traceid/spanid;op=0" */
	export const X_HEADER_KEY: "x-cloud-trace-context";

	export {};
}

//# sourceMappingURL=index.d.ts.map