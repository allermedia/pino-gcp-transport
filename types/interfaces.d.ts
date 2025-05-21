import { SonicBoomOpts } from 'sonic-boom';

export interface StructuredTransformationConfig extends SonicBoomOpts {
  /**
   * pino ignore keys, optional list of pino ignore keys
   * @default hostname, pid, level, time, msg
   */
  ignoreKeys?: string[];
  [k: string]: any;
}
