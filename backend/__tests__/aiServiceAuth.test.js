describe('AI service credential destination', () => {
  const originalUrl = process.env.AI_SERVICE_URL;
  const originalKey = process.env.AI_SERVICE_INTERNAL_KEY;
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.AI_SERVICE_INTERNAL_KEY;
    else process.env.AI_SERVICE_INTERNAL_KEY = originalKey;
    jest.resetModules();
  });
  test('only the exact service origin receives credentials', () => {
    process.env.AI_SERVICE_URL = 'https://ai.example';
    process.env.AI_SERVICE_INTERNAL_KEY = 'test-key';
    const use = jest.fn();
    jest.doMock('axios', () => ({ interceptors: { request: { use } } }));
    require('../utils/aiServiceAuth');
    const attach = use.mock.calls[0][0];
    expect(attach({ url: 'https://ai.example/generate/tutor' }).headers['X-Internal-Key']).toBe('test-key');
    expect(attach({ url: '/generate', baseURL: 'https://ai.example' }).maxRedirects).toBe(0);
    expect(attach({ url: 'https://evil.test', baseURL: 'https://ai.example' }).headers).toBeUndefined();
    for (const url of ['https://ai.example.evil.test/generate', 'https://ai.example@evil.test', 'https://ai.example:9443', '/relative']) {
      expect(attach({ url }).headers).toBeUndefined();
    }
  });
});
