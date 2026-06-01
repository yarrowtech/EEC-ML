describe('logger', () => {
  let streamWrites;
  let levelCalls;
  let childBindings;

  beforeEach(() => {
    jest.resetModules();
    streamWrites = {};
    levelCalls = {
      trace: [],
      debug: [],
      info: [],
      warn: [],
      error: [],
      fatal: [],
    };
    childBindings = [];

    jest.doMock('fs', () => ({
      mkdirSync: jest.fn(),
    }));

    jest.doMock('pino', () => {
      const pino = jest.fn((_config, destination) => {
        const logger = {
          trace: jest.fn((...args) => levelCalls.trace.push(args)),
          debug: jest.fn((...args) => levelCalls.debug.push(args)),
          info: jest.fn((...args) => levelCalls.info.push(args)),
          warn: jest.fn((...args) => levelCalls.warn.push(args)),
          error: jest.fn((...args) => levelCalls.error.push(args)),
          fatal: jest.fn((...args) => levelCalls.fatal.push(args)),
          child: jest.fn((bindings) => {
            childBindings.push(bindings);
            return { bindings, destination };
          }),
        };
        return logger;
      });

      pino.destination = jest.fn(({ dest }) => {
        streamWrites[dest] = [];
        return {
          dest,
          write: jest.fn((line) => streamWrites[dest].push(line)),
        };
      });
      pino.multistream = jest.fn((streams) => ({ streams }));
      pino.stdTimeFunctions = { isoTime: jest.fn(() => 'ts') };

      return pino;
    });
  });

  it('routes string, object, and error inputs to the expected pino methods', () => {
    const { logger } = require('../utils/logger');

    logger.info('User %s logged in', 'alice');
    logger.warn('Audit event', { actorId: 'admin-1' });
    logger.error({ action: 'save.failed', message: 'Save failed', entityId: 42 });
    logger.log('free-form line');
    logger.log(123);
    logger.log(new Error('kaboom'));

    expect(levelCalls.info[0]).toEqual(['User alice logged in']);
    expect(levelCalls.warn[0]).toEqual([{ actorId: 'admin-1' }, 'Audit event']);
    expect(levelCalls.error[0]).toEqual([{ action: 'save.failed', entityId: 42 }, 'Save failed']);
    expect(levelCalls.info[1]).toEqual(['free-form line']);
    expect(levelCalls.info[2]).toEqual(['123']);
    expect(levelCalls.error[1][0]).toEqual({ err: expect.any(Error) });
    expect(levelCalls.error[1][1]).toBe('kaboom');
  });

  it('falls back to info for unknown levels and exposes child logger bindings', () => {
    const { logger } = require('../utils/logger');

    logger.log({
      level: 'nonsense',
      message: 'Fallback level',
      requestId: 'req-22',
    });

    const child = logger.child({ requestId: 'req-99' });

    expect(levelCalls.info[0]).toEqual([{ requestId: 'req-22' }, 'Fallback level']);
    expect(childBindings).toEqual([{ requestId: 'req-99' }]);
    expect(child).toEqual(expect.objectContaining({ bindings: { requestId: 'req-99' } }));
  });

  it('binds console methods through the logger only once', () => {
    const originalFlag = global.__PINO_CONSOLE_BOUND__;
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    global.__PINO_CONSOLE_BOUND__ = false;

    try {
      const { bindConsoleToLogger } = require('../utils/logger');

      bindConsoleToLogger();
      const firstLog = console.log;
      bindConsoleToLogger();

      expect(console.log).toBe(firstLog);

      console.log('console-log');
      console.warn('console-warn');
      console.error('console-error');

      expect(levelCalls.info.some((args) => args[0] === 'console-log')).toBe(true);
      expect(levelCalls.warn.some((args) => args[0] === 'console-warn')).toBe(true);
      expect(levelCalls.error.some((args) => args[0] === 'console-error')).toBe(true);
    } finally {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      global.__PINO_CONSOLE_BOUND__ = originalFlag;
    }
  });
});
