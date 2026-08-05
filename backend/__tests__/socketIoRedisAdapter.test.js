const mockAdapter = { name: 'redis-adapter' };
const mockCreateAdapter = jest.fn(() => mockAdapter);
const mockSubClient = {
  connect: jest.fn(),
  on: jest.fn(),
  quit: jest.fn(),
  isOpen: false,
};
const mockPubClient = {
  connect: jest.fn(),
  duplicate: jest.fn(() => mockSubClient),
  on: jest.fn(),
  quit: jest.fn(),
  isOpen: false,
};

jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: mockCreateAdapter }));
jest.mock('redis', () => ({ createClient: jest.fn(() => mockPubClient) }));
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { configureSocketIoRedisAdapter } = require('../utils/socketIoRedisAdapter');

describe('Socket.IO Redis adapter', () => {
  const originalEnabled = process.env.SOCKET_IO_REDIS_ENABLED;
  const originalRequired = process.env.SOCKET_IO_REDIS_REQUIRED;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPubClient.connect.mockResolvedValue(undefined);
    mockSubClient.connect.mockResolvedValue(undefined);
    mockPubClient.quit.mockResolvedValue(undefined);
    mockSubClient.quit.mockResolvedValue(undefined);
    delete process.env.SOCKET_IO_REDIS_ENABLED;
    delete process.env.SOCKET_IO_REDIS_REQUIRED;
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.SOCKET_IO_REDIS_ENABLED;
    else process.env.SOCKET_IO_REDIS_ENABLED = originalEnabled;
    if (originalRequired === undefined) delete process.env.SOCKET_IO_REDIS_REQUIRED;
    else process.env.SOCKET_IO_REDIS_REQUIRED = originalRequired;
  });

  test('attaches the Redis adapter after both clients connect', async () => {
    const io = { adapter: jest.fn() };
    await expect(configureSocketIoRedisAdapter(io)).resolves.toEqual({ enabled: true });
    expect(mockPubClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSubClient.connect).toHaveBeenCalledTimes(1);
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
    expect(io.adapter).toHaveBeenCalledWith(mockAdapter);
  });

  test('falls back without attaching when Redis is optional and unavailable', async () => {
    mockPubClient.connect.mockRejectedValueOnce(new Error('Redis unavailable'));
    const io = { adapter: jest.fn() };
    await expect(configureSocketIoRedisAdapter(io)).resolves.toEqual({
      enabled: false,
      reason: 'connection_failed',
    });
    expect(io.adapter).not.toHaveBeenCalled();
  });

  test('fails startup when Redis is required and unavailable', async () => {
    process.env.SOCKET_IO_REDIS_REQUIRED = 'true';
    mockPubClient.connect.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(configureSocketIoRedisAdapter({ adapter: jest.fn() }))
      .rejects.toThrow('Redis unavailable');
  });
});
