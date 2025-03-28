import { SonicBoomOpts } from 'sonic-boom';

export interface StructuredTransformationConfig extends SonicBoomOpts {
  /**
   * pino ignore keys, filters Telemetry properties
   * @default {string[]} hostname pid, level, time, msg
   */
  ignoreKeys?: string[];
  [k: string]: any;
}
