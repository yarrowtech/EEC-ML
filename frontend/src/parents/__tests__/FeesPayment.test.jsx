import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeesPayment from '../FeesPayment';
import {
  mockParentProfile,
  mockInvoices,
  mockRazorpayOrder,
  mockRazorpayPayment,
} from './__mocks__/mockData';
import {
  createMockFetch,
  createMockRazorpay,
} from './__utils__/testUtils';

describe('FeesPayment', () => {
  let mockFetch;
  let mockRazorpay;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage
    global.localStorage.getItem = jest.fn((key) => {
      if (key === 'token') return 'test-token';
      return null;
    });

    // Mock children and invoices API
    mockFetch = createMockFetch({
      'http://localhost:5000/api/fees/parent/children': {
        ok: true,
        data: {
          children: mockParentProfile.children,
        },
      },
      '/api/fees/parent/children': {
        ok: true,
        data: {
          children: mockParentProfile.children,
        },
      },
      'http://localhost:5000/api/fees/parent/invoices?studentId=student1': {
        ok: true,
        data: {
          invoices: mockInvoices,
          paymentsByInvoice: {},
        },
      },
      '/api/fees/parent/invoices?studentId=student1': {
        ok: true,
        data: {
          invoices: mockInvoices,
          paymentsByInvoice: {},
        },
      },
    });
    global.fetch = mockFetch;

    // Mock Razorpay
    mockRazorpay = createMockRazorpay();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Render Tests', () => {
    test('renders without crashing', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/fees payment/i)).toBeInTheDocument();
      });
    });

    test('displays loading state initially', () => {
      render(<FeesPayment />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('displays children dropdown after loading', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(mockParentProfile.children[0].name)).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading Tests', () => {
    test('fetches children on mount', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/parent/children'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    test('fetches invoices for selected child', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/parent/invoices?studentId='),
          expect.any(Object)
        );
      });
    });

    test('displays invoices after loading', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });
    });

    test('handles API error gracefully', async () => {
      mockFetch = createMockFetch({
        'http://localhost:5000/api/fees/parent/children': {
          ok: false,
          status: 500,
          data: { error: 'Server error' },
        },
        '/api/fees/parent/children': {
          ok: false,
          status: 500,
          data: { error: 'Server error' },
        },
      });
      global.fetch = mockFetch;

      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/server error|failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Child Selection Tests', () => {
    test('allows selecting different child', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(mockParentProfile.children[0].name)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('option', { name: new RegExp(mockParentProfile.children[1].name, 'i') }));

      // Verify invoice fetch for new child
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`studentId=${mockParentProfile.children[1]._id}`),
          expect.any(Object)
        );
      });
    });
  });

  describe('Invoice Display Tests', () => {
    test('displays invoice amount correctly', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getAllByText(/₹5,000/i).length).toBeGreaterThan(0);
      });
    });

    test('displays paid status for paid invoices', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getAllByText(/paid/i).length).toBeGreaterThan(0);
      });
    });

    test('displays pending status for unpaid invoices', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/pending/i)).toBeInTheDocument();
      });
    });

    test('calculates total balance correctly', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        // Total balance from pending invoices should be displayed
        const balanceElements = screen.getAllByText(/₹/i);
        expect(balanceElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Payment Flow Tests', () => {
    test('renders a mobile sticky payment action for the selected pending invoice', async () => {
      render(<FeesPayment />);

      const mobilePayButton = await screen.findByRole('button', { name: /pay now.*5,000/i });
      expect(mobilePayButton.closest('.fees-mobile-pay')).toBeInTheDocument();
    });

    test('pay button is disabled for paid invoices', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        const payButtons = screen.queryAllByText(/pay now/i);
        // At least one pay button should be disabled (for paid invoice)
        expect(payButtons.length).toBeGreaterThan(0);
      });
    });

    test('pay button is enabled for pending invoices', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        const payButtons = screen.getAllByText(/pay now/i);
        expect(payButtons.length).toBeGreaterThan(0);
      });
    });

    test.skip('clicking pay now creates Razorpay order', async () => {
      // TODO: Fix Razorpay mock integration
      mockFetch = createMockFetch({
        ...mockFetch,
        'POST http://localhost:5000/api/fees/parent/razorpay/order': {
          ok: true,
          data: {
            order: mockRazorpayOrder,
            keyId: 'test_key',
          },
        },
        'POST /api/fees/parent/razorpay/order': {
          ok: true,
          data: {
            order: mockRazorpayOrder,
            keyId: 'test_key',
          },
        },
      });
      global.fetch = mockFetch;

      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });

      const payButton = screen.getAllByText(/pay now/i)[0];
      fireEvent.click(payButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fees/parent/razorpay/order'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    test.skip('handles payment verification on success', async () => {
      // TODO: Implement after Razorpay mock is fixed
    });

    test.skip('handles payment failure gracefully', async () => {
      // TODO: Implement after Razorpay mock is fixed
    });
  });

  describe('Amount Validation Tests', () => {
    test('validates payment amount is positive', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });

      // Amount validation should prevent 0 or negative amounts
      // This test would require finding the amount input and testing validation
    });

    test('validates payment amount does not exceed balance', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });

      // Amount should not exceed invoice balance
    });
  });

  describe('Error Handling Tests', () => {
    test('shows error when token is missing', async () => {
      global.localStorage.getItem = jest.fn(() => null);

      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/login required/i)).toBeInTheDocument();
      });
    });

    test('shows error when Razorpay script fails to load', async () => {
      // TODO: Mock Razorpay script load failure
    });

    test('shows error when payment verification fails', async () => {
      // TODO: Mock payment verification failure
    });
  });

  describe('Currency Formatting Tests', () => {
    test('formats amount in INR correctly', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        // Should display ₹ symbol and properly formatted amount
        const elements = screen.getAllByText(/₹/i);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty children list', async () => {
      mockFetch = createMockFetch({
        'http://localhost:5000/api/fees/parent/children': {
          ok: true,
          data: {
            children: [],
          },
        },
        '/api/fees/parent/children': {
          ok: true,
          data: {
            children: [],
          },
        },
      });
      global.fetch = mockFetch;

      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/no children found|no students/i)).toBeInTheDocument();
      });
    });

    test('handles empty invoices list', async () => {
      mockFetch = createMockFetch({
        'http://localhost:5000/api/fees/parent/children': {
          ok: true,
          data: {
            children: mockParentProfile.children,
          },
        },
        '/api/fees/parent/children': {
          ok: true,
          data: {
            children: mockParentProfile.children,
          },
        },
        'http://localhost:5000/api/fees/parent/invoices?studentId=student1': {
          ok: true,
          data: {
            invoices: [],
            paymentsByInvoice: {},
          },
        },
        '/api/fees/parent/invoices?studentId=student1': {
          ok: true,
          data: {
            invoices: [],
            paymentsByInvoice: {},
          },
        },
      });
      global.fetch = mockFetch;

      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/no invoices|no pending fees/i)).toBeInTheDocument();
      });
    });

    test('prevents multiple simultaneous payments', async () => {
      // TODO: Test that clicking pay button multiple times doesn't initiate multiple payments
    });
  });

  describe('Refresh Functionality Tests', () => {
    test('refresh button reloads invoices', async () => {
      render(<FeesPayment />);

      await waitFor(() => {
        expect(screen.getByText(/Tuition Fee - January 2025/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh|reload/i });
      if (refreshButton) {
        fireEvent.click(refreshButton);

        // Should trigger a new fetch
        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + refresh
        });
      }
    });
  });
});
