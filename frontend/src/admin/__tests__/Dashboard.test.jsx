import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  localStorage.setItem('token', 'x.eyJpZCI6ImEiLCJzY2hvb2xJZCI6InMifQ.y');
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('dashboard-stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          students: { total: 300, recent: 8 },
          teachers: { total: 56, recent: 3 },
          parents: { total: 300, recent: 12 },
          totalUsers: 657,
          recentTotal: 23,
        }),
      });
    }
    if (u.includes('/api/fees/payments')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => [{ amount: 5000, paidOn: new Date().toISOString() }] });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => [{ totalAmount: 8000, paidAmount: 2000, dueDate: new Date().toISOString() }],
    });
  });
});

test('renders the header, live counts, chart and quick actions', async () => {
  render(
    <MemoryRouter>
      <Dashboard setShowAdminHeader={jest.fn()} />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Good (morning|afternoon|evening), Admin/)).toBeInTheDocument();

  await flush();
  await flush();

  expect(screen.getByText('657')).toBeInTheDocument();
  expect(screen.getByText('56')).toBeInTheDocument();
  expect(screen.getAllByText('300')).toHaveLength(2);
  expect(screen.getByText('Fees Collection')).toBeInTheDocument();
  expect(screen.getByText('Add Student')).toBeInTheDocument();
  expect(screen.getByText('Add Teacher')).toBeInTheDocument();
});

test('shows a fallback when there is no fee activity', async () => {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('dashboard-stats')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ totalUsers: 0, recentTotal: 0 }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });

  render(
    <MemoryRouter>
      <Dashboard setShowAdminHeader={jest.fn()} />
    </MemoryRouter>,
  );
  await flush();
  await flush();
  expect(screen.getByText(/No fee activity in the last 6 months/)).toBeInTheDocument();
});
