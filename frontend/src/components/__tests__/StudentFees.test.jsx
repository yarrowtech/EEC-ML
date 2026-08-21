import React from 'react';
import { render, screen } from '@testing-library/react';
import StudentFees from '../StudentFees';

const jsonResponse = (payload) => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(payload),
});

describe('student fees', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    global.fetch = jest.fn(() => jsonResponse({
      invoices: [{
        _id: 'invoice-1',
        title: 'Term 1 Fees',
        status: 'partial',
        dueDate: '2026-09-01T00:00:00.000Z',
        totalAmount: 12000,
        paidAmount: 5000,
        balanceAmount: 7000,
      }],
      paymentsByInvoice: {
        'invoice-1': [{
          _id: 'payment-1',
          amount: 5000,
          method: 'online',
          paidOn: '2026-08-20T00:00:00.000Z',
        }],
      },
    }));
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('loads the signed-in student invoices and payment history', async () => {
    render(<StudentFees />);

    expect(await screen.findByText('Term 1 Fees')).toBeInTheDocument();
    expect(screen.getByText('Recent Payments')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay.*7,000/i })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/fees/student/invoices'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer student-token' }),
      })
    );
  });
});
