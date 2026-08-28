import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AttendanceView from '../AttendanceView';

const cacheStore = new Map();
const mockReadCacheEntry = jest.fn((key) => cacheStore.get(key) || null);
const mockWriteCacheEntry = jest.fn((key, value) => {
  cacheStore.set(key, { data: value, timestamp: Date.now() });
});
const mockClearCacheEntry = jest.fn((key) => cacheStore.delete(key));

jest.mock('../../utils/studentCache', () => ({
  readCacheEntry: (...args) => mockReadCacheEntry(...args),
  writeCacheEntry: (...args) => mockWriteCacheEntry(...args),
  clearCacheEntry: (...args) => mockClearCacheEntry(...args),
}));

const renderWithRouter = (initialPath = '/student/attendance') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AttendanceView />
    </MemoryRouter>
  );

const createLocalStorage = (initialData = {}) => {
  const store = { ...initialData };
  return {
    getItem: jest.fn((key) => (key in store ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
};

describe('AttendanceView', () => {
  beforeEach(() => {
    cacheStore.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn();
    const storage = createLocalStorage({ token: 'student-token', userType: 'Student' });
    global.localStorage = storage;
    window.localStorage = storage;
  });

  test('renders cached stats and refreshes from API', async () => {
    mockReadCacheEntry.mockReturnValue({
      data: {
        stats: { totalClasses: 10, attended: 8, absent: 2, percentage: 80 },
        records: [],
      },
      timestamp: Date.now(),
    });

    const apiPayload = {
      summary: { totalClasses: 12, presentDays: 10, absentDays: 2, attendancePercentage: 83 },
      attendance: [
        { _id: 'a1', date: '2025-02-01T00:00:00.000Z', subject: 'Mathematics', status: 'present' },
        { _id: 'a2', date: '2025-02-02T00:00:00.000Z', subject: 'Science', status: 'absent' },
      ],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => apiPayload,
    });

    renderWithRouter();

    expect(await screen.findByText(/8 of 10 classes/i)).toBeInTheDocument();
  });

  test('respects daily filter query parameter', async () => {
    mockReadCacheEntry.mockReturnValue({
      data: {
        stats: { totalClasses: 2, attended: 2, absent: 0, percentage: 100 },
        records: [
          { id: 'd1', date: '2025-03-01', subject: 'Math', status: 'present' },
          { id: 'd2', date: '2025-03-02', subject: 'Chemistry', status: 'present' },
        ],
      },
      timestamp: Date.now(),
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ summary: {}, attendance: [] }),
    });

    renderWithRouter('/student/attendance?filter=present');

    expect(await screen.findByText(/Day-by-Day Attendance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Present' })).toHaveClass('bg-amber-600');
  });
});
