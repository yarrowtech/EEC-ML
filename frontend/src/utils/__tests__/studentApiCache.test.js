import { fetchCachedJson } from '../studentApiCache';

describe('studentApiCache authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'student-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { name: 'Student' } }),
    });
  });

  test('automatically includes the student bearer token', async () => {
    await fetchCachedJson('/api/student/auth/dashboard', { forceRefresh: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.get('Authorization')).toBe('Bearer student-token');
  });

  test('preserves an explicitly supplied authorization header', async () => {
    await fetchCachedJson('/api/student/auth/dashboard', {
      forceRefresh: true,
      fetchOptions: { headers: { Authorization: 'Bearer explicit-token' } },
    });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.get('Authorization')).toBe('Bearer explicit-token');
  });
});
