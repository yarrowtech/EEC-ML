import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import FeesPayment from '../FeesPayment';
import {
  mockParentProfile,
  mockInvoices,
  mockRazorpayOrder,
} from './__mocks__/mockData';
import {
  createMockFetch,
  createMockRazorpay,
} from './__utils__/testUtils';

// FeesPayment now routes every request through parentApiFetch, which calls
// useNavigate() — so the component must render inside a router in tests.
const renderFees = () => render(<FeesPayment />, { wrapper: MemoryRouter });

const BASE = 'http://localhost:5000';

const baseResponses = () => ({
  [`${BASE}/api/fees/parent/children`]: {
    ok: true,
    data: { children: mockParentProfile.children },
  },
  '/api/fees/parent/children': {
    ok: true,
    data: { children: mockParentProfile.children },
  },
  [`${BASE}/api/fees/parent/invoices?studentId=student1`]: {
    ok: true,
    data: { invoices: mockInvoices, paymentsByInvoice: {} },
  },
  '/api/fees/parent/invoices?studentId=student1': {
    ok: true,
    data: { invoices: mockInvoices, paymentsByInvoice: {} },
  },
  [`${BASE}/api/reports/report-cards/parent`]: { ok: true, data: { template: null } },
  '/api/reports/report-cards/parent': { ok: true, data: { template: null } },
});

describe('FeesPayment', () => {
  let mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();

    global.localStorage.getItem = jest.fn((key) => (key === 'token' ? 'test-token' : null));

    mockFetch = createMockFetch(baseResponses());
    global.fetch = mockFetch;

    createMockRazorpay();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Render Tests', () => {
    test('renders without crashing', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getByText(/fees payment/i)).toBeInTheDocument();
      });
    });

    test('displays loading state initially', () => {
      renderFees();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('displays children after loading', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getByText(mockParentProfile.children[0].name)).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading Tests', () => {
    test('fetches children on mount with the bearer token', async () => {
      renderFees();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/parent/children'),
          expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
          })
        );
      });
    });

    test('fetches invoices for the selected child', async () => {
      renderFees();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/parent/invoices?studentId='),
          expect.any(Object)
        );
      });
    });

    test('displays invoices after loading', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });
    });

    test('handles API error gracefully', async () => {
      mockFetch = createMockFetch({
        [`${BASE}/api/fees/parent/children`]: { ok: false, status: 500, data: { error: 'Server error' } },
        '/api/fees/parent/children': { ok: false, status: 500, data: { error: 'Server error' } },
      });
      global.fetch = mockFetch;

      renderFees();
      await waitFor(() => {
        expect(screen.getByText(/server error|failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Invoice Display Tests', () => {
    test('displays invoice amount correctly', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getAllByText(/₹5,000/i).length).toBeGreaterThan(0);
      });
    });

    test('displays paid status for paid invoices', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getAllByText(/paid/i).length).toBeGreaterThan(0);
      });
    });

    test('calculates total balance correctly', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getAllByText(/₹/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Payment Flow Tests', () => {
    test('renders a mobile sticky payment action for the selected pending invoice', async () => {
      renderFees();
      const mobilePayButton = await screen.findByRole('button', { name: /pay now.*5,000/i });
      expect(mobilePayButton.closest('.fees-mobile-pay')).toBeInTheDocument();
    });

    test('clicking pay now creates an order against /api/fees/:id/pay', async () => {
      mockFetch = createMockFetch({
        ...baseResponses(),
        [`POST ${BASE}/api/fees/invoice1/pay`]: {
          ok: true,
          data: { order: { ...mockRazorpayOrder }, keyId: 'test_key' },
        },
        'POST /api/fees/invoice1/pay': {
          ok: true,
          data: { order: { ...mockRazorpayOrder }, keyId: 'test_key' },
        },
        [`POST ${BASE}/api/fees/payments/razorpay/verify`]: { ok: true, data: { success: true } },
        'POST /api/fees/payments/razorpay/verify': { ok: true, data: { success: true } },
      });
      global.fetch = mockFetch;

      renderFees();

      const payButton = await screen.findByRole('button', { name: /pay now.*5,000/i });
      await act(async () => {
        fireEvent.click(payButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/invoice1/pay'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    test('verifies the payment against /api/fees/payments/razorpay/verify after checkout', async () => {
      mockFetch = createMockFetch({
        ...baseResponses(),
        [`POST ${BASE}/api/fees/invoice1/pay`]: {
          ok: true,
          data: { order: { ...mockRazorpayOrder }, keyId: 'test_key' },
        },
        'POST /api/fees/invoice1/pay': {
          ok: true,
          data: { order: { ...mockRazorpayOrder }, keyId: 'test_key' },
        },
        [`POST ${BASE}/api/fees/payments/razorpay/verify`]: { ok: true, data: { success: true } },
        'POST /api/fees/payments/razorpay/verify': { ok: true, data: { success: true } },
      });
      global.fetch = mockFetch;

      renderFees();

      const payButton = await screen.findByRole('button', { name: /pay now.*5,000/i });
      await act(async () => {
        fireEvent.click(payButton);
        // The mock Razorpay invokes options.handler() ~100ms after open().
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/payments/razorpay/verify'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    test('surfaces an error when order creation fails', async () => {
      mockFetch = createMockFetch({
        ...baseResponses(),
        [`POST ${BASE}/api/fees/invoice1/pay`]: { ok: false, status: 400, data: { error: 'Invoice is already paid' } },
        'POST /api/fees/invoice1/pay': { ok: false, status: 400, data: { error: 'Invoice is already paid' } },
      });
      global.fetch = mockFetch;

      renderFees();

      const payButton = await screen.findByRole('button', { name: /pay now.*5,000/i });
      await act(async () => {
        fireEvent.click(payButton);
      });

      await waitFor(() => {
        expect(screen.getAllByText(/already paid|payment failed|failed to create/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling Tests', () => {
    test('shows error when token is missing', async () => {
      global.localStorage.getItem = jest.fn(() => null);

      renderFees();

      await waitFor(() => {
        expect(screen.getByText(/login required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Currency Formatting Tests', () => {
    test('formats amount in INR correctly', async () => {
      renderFees();
      await waitFor(() => {
        expect(screen.getAllByText(/₹/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty children list', async () => {
      mockFetch = createMockFetch({
        [`${BASE}/api/fees/parent/children`]: { ok: true, data: { children: [] } },
        '/api/fees/parent/children': { ok: true, data: { children: [] } },
      });
      global.fetch = mockFetch;

      renderFees();
      await waitFor(() => {
        expect(screen.getByText(/no children found|no students/i)).toBeInTheDocument();
      });
    });

    test('handles empty invoices list', async () => {
      mockFetch = createMockFetch({
        ...baseResponses(),
        [`${BASE}/api/fees/parent/invoices?studentId=student1`]: {
          ok: true,
          data: { invoices: [], paymentsByInvoice: {} },
        },
        '/api/fees/parent/invoices?studentId=student1': {
          ok: true,
          data: { invoices: [], paymentsByInvoice: {} },
        },
      });
      global.fetch = mockFetch;

      renderFees();
      await waitFor(() => {
        expect(screen.getByText(/no invoices|no pending fees|no fees found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality Tests', () => {
    test('refresh button reloads data', async () => {
      renderFees();

      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });

      const callsBefore = mockFetch.mock.calls.length;
      const refreshButton = screen.getByRole('button', { name: /refresh|reload/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });
});
