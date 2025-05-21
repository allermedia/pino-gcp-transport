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
export declare const INSERT_ID_KEY = 'logging.googleapis.com/insertId';
export declare const LABELS_KEY = 'logging.googleapis.com/labels';
export declare const OPERATION_KEY = 'logging.googleapis.com/operation';
export declare const SOURCE_LOCATION_KEY = 'logging.googleapis.com/sourceLocation';
export declare const SPAN_ID_KEY = 'logging.googleapis.com/spanId';
export declare const TRACE_KEY = 'logging.googleapis.com/trace';
export declare const TRACE_SAMPLED_KEY = 'logging.googleapis.com/trace_sampled';

export interface StructuredJson {
  message?: string | object;
  httpRequest?: IHttpRequest;
  timestamp?: { seconds: number; nanos: number };
  [INSERT_ID_KEY]?: string;
  [OPERATION_KEY]?: object;
  [SOURCE_LOCATION_KEY]?: object;
  [LABELS_KEY]?: object;
  [SPAN_ID_KEY]?: string;
  [TRACE_KEY]?: string;
  [TRACE_SAMPLED_KEY]?: boolean;
  logName?: string;
  resource?: object;
  [key: string]: unknown;
}

export interface IHttpRequest {
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

export enum LogSeverity {
  DEFAULT = 0,
  DEBUG = 100,
  INFO = 200,
  NOTICE = 300,
  WARNING = 400,
  ERROR = 500,
  CRITICAL = 600,
  ALERT = 700,
  EMERGENCY = 800,
}
