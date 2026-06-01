import pino from 'pino/browser';

const env = import.meta.env || {};

const LOG_LEVEL = env.VITE_LOG_LEVEL || (env.DEV ? 'debug' : 'info');
const LOG_ENABLED = env.MODE !== 'test' && env.VITE_ENABLE_LOGGING !== 'false';
const SERVICE_NAME = env.VITE_APP_NAME || 'frontend';

const consoleTarget = typeof globalThis !== 'undefined' && globalThis.console
  ? globalThis.console
  : console;

export const rawConsole = {
  log: consoleTarget.log ? consoleTarget.log.bind(consoleTarget) : () => {},
  info: consoleTarget.info ? consoleTarget.info.bind(consoleTarget) : () => {},
  warn: consoleTarget.warn ? consoleTarget.warn.bind(consoleTarget) : () => {},
  error: consoleTarget.error ? consoleTarget.error.bind(consoleTarget) : () => {},
  debug: consoleTarget.debug ? consoleTarget.debug.bind(consoleTarget) : () => {},
};

const pinoLogger = pino({
  name: SERVICE_NAME,
  level: LOG_LEVEL,
  enabled: LOG_ENABLED,
  browser: {
    asObject: true,
    write: {
      trace: (entry) => rawConsole.debug(entry),
      debug: (entry) => rawConsole.debug(entry),
      info: (entry) => rawConsole.info(entry),
      warn: (entry) => rawConsole.warn(entry),
      error: (entry) => rawConsole.error(entry),
      fatal: (entry) => rawConsole.error(entry),
    },
  },
});

const parseLevel = (level) => {
  const normalized = String(level || '').toLowerCase();
  if (['fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(normalized)) {
    return normalized;
  }
  return 'info';
};

const write = (level, ...args) => {
  const resolvedLevel = parseLevel(level);

  if (args.length === 1 && args[0] instanceof Error) {
    pinoLogger[resolvedLevel]({ err: args[0] }, args[0].message);
    return;
  }

  const [first, second, ...rest] = args;

  if (typeof first === 'string' && second && typeof second === 'object' && !Array.isArray(second)) {
    pinoLogger[resolvedLevel](second, first);
    return;
  }

  if (first && typeof first === 'object' && !Array.isArray(first) && typeof second === 'string') {
    pinoLogger[resolvedLevel](first, second, ...rest);
    return;
  }

  if (first && typeof first === 'object' && !Array.isArray(first) && rest.length === 0 && second === undefined) {
    const { message = '', ...obj } = first;
    if (message) {
      pinoLogger[resolvedLevel](obj, String(message));
    } else {
      pinoLogger[resolvedLevel](obj);
    }
    return;
  }

  pinoLogger[resolvedLevel](...args);
};

export const logger = {
  trace: (...args) => write('trace', ...args),
  debug: (...args) => write('debug', ...args),
  info: (...args) => write('info', ...args),
  warn: (...args) => write('warn', ...args),
  error: (...args) => write('error', ...args),
  fatal: (...args) => write('fatal', ...args),
  log: (entry = {}) => {
    if (entry instanceof Error) {
      write('error', entry);
      return;
    }
    if (typeof entry === 'string') {
      write('info', entry);
      return;
    }
    if (!entry || typeof entry !== 'object') {
      write('info', String(entry));
      return;
    }
    const { level = 'info', message = '', ...meta } = entry;
    write(level, meta, message || undefined);
  },
  child: (bindings = {}) => pinoLogger.child(bindings),
};

export const bindConsoleToLogger = () => {
  if (globalThis.__PINO_BROWSER_CONSOLE_BOUND__) return;
  globalThis.__PINO_BROWSER_CONSOLE_BOUND__ = true;

  console.log = (...args) => write('info', ...args);
  console.info = (...args) => write('info', ...args);
  console.warn = (...args) => write('warn', ...args);
  console.error = (...args) => write('error', ...args);
  console.debug = (...args) => write('debug', ...args);
};
