/** @type {string} Debug or trace information. */
export const SEVERITY_DEBUG = 'DEBUG';

/** @type {string} Routine information, such as ongoing status or performance. */
export const SEVERITY_INFO = 'INFO';

/** @type {string} Normal but significant events, such as start up, shut down, or a configuration change. */
export const SEVERITY_NOTICE = 'NOTICE';

/** @type {string} Warning events might cause problems. */
export const SEVERITY_WARNING = 'WARNING';

/** @type {string} Error events are likely to cause problems. */
export const SEVERITY_ERROR = 'ERROR';

/** @type {string} Critical events cause more severe problems or outages. */
export const SEVERITY_CRITICAL = 'CRITICAL';

/** @type {string} A person must take an action immediately. */
export const SEVERITY_ALERT = 'ALERT';

/** @type {string} One or more systems are unusable. */
export const SEVERITY_EMERGENCY = 'EMERGENCY';

export const TRACE_ID_KEY = 'logging.googleapis.com/trace';
export const SPAN_ID_KEY = 'logging.googleapis.com/spanId';
export const SOURCELOCATION_KEY = 'logging.googleapis.com/sourceLocation';

export const STACK_PATTERN =
  /^\s*at ((?<function>(?!file:)[\w.<>]+)(?: ))?(?:\[.+?\] )?(?:\()?(?<file>.+):(?<line>\d+):(?<col>\d+)(?:\))?$/m;
