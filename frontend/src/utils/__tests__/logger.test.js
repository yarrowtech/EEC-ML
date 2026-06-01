jest.mock('pino/browser', () => {
  const levelCalls = {
    trace: [],
    debug: [],
    info: [],
    warn: [],
    error: [],
    fatal: [],
  };
  const childBindings = [];

  const factory = jest.fn(() => ({
    trace: jest.fn((...args) => levelCalls.trace.push(args)),
    debug: jest.fn((...args) => levelCalls.debug.push(args)),
    info: jest.fn((...args) => levelCalls.info.push(args)),
    warn: jest.fn((...args) => levelCalls.warn.push(args)),
    error: jest.fn((...args) => levelCalls.error.push(args)),
    fatal: jest.fn((...args) => levelCalls.fatal.push(args)),
    child: jest.fn((bindings) => {
      childBindings.push(bindings);
      return { bindings };
    }),
  }));

  factory.__levelCalls = levelCalls;
  factory.__childBindings = childBindings;

  return {
    __esModule: true,
    default: factory,
  };
});

describe('frontend logger', () => {
  let logger;
  let bindConsoleToLogger;
  let rawConsole;
  let mockedPino;

  beforeEach(async () => {
    jest.resetModules();
    global.__PINO_BROWSER_CONSOLE_BOUND__ = false;
    mockedPino = (await import('pino/browser')).default;
    ({ logger, bindConsoleToLogger, rawConsole } = await import('../logger.js'));
    Object.values(mockedPino.__levelCalls).forEach((calls) => {
      calls.length = 0;
    });
    mockedPino.__childBindings.length = 0;
  });

  it('routes strings, objects, primitive values, and errors to pino methods', () => {
    logger.info('Loaded page', { route: '/dashboard' });
    logger.warn({ action: 'cache.miss', message: 'Cache miss', key: 'student:1' });
    logger.log('free-form');
    logger.log(42);
    logger.log(new Error('kaboom'));

    expect(mockedPino.__levelCalls.info[0]).toEqual([{ route: '/dashboard' }, 'Loaded page']);
    expect(mockedPino.__levelCalls.warn[0]).toEqual([{ action: 'cache.miss', key: 'student:1' }, 'Cache miss']);
    expect(mockedPino.__levelCalls.info[1]).toEqual(['free-form']);
    expect(mockedPino.__levelCalls.info[2]).toEqual(['42']);
    expect(mockedPino.__levelCalls.error[0][0]).toEqual({ err: expect.any(Error) });
    expect(mockedPino.__levelCalls.error[0][1]).toBe('kaboom');
  });

  it('falls back to info for unknown levels and exposes child bindings', () => {
    logger.log({
      level: 'nonsense',
      message: 'Fallback level',
      requestId: 'req-1',
    });

    const child = logger.child({ requestId: 'req-99' });

    expect(mockedPino.__levelCalls.info[0]).toEqual([{ requestId: 'req-1' }, 'Fallback level']);
    expect(mockedPino.__childBindings).toEqual([{ requestId: 'req-99' }]);
    expect(child).toEqual({ bindings: { requestId: 'req-99' } });
  });

  it('binds browser console methods only once and forwards through the logger', () => {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    try {
      bindConsoleToLogger();
      const firstLog = console.log;
      bindConsoleToLogger();

      expect(console.log).toBe(firstLog);

      console.log('console-log');
      console.warn('console-warn');
      console.error('console-error');
      console.debug('console-debug');

      expect(mockedPino.__levelCalls.info.some((args) => args[0] === 'console-log')).toBe(true);
      expect(mockedPino.__levelCalls.warn.some((args) => args[0] === 'console-warn')).toBe(true);
      expect(mockedPino.__levelCalls.error.some((args) => args[0] === 'console-error')).toBe(true);
      expect(mockedPino.__levelCalls.debug.some((args) => args[0] === 'console-debug')).toBe(true);
      expect(rawConsole.log).toBeDefined();
    } finally {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
      global.__PINO_BROWSER_CONSOLE_BOUND__ = false;
    }
  });
});
