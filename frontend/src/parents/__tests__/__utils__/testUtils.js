import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithRouter(ui, options = {}) {
  const { route = '/' } = options;

  window.history.pushState({}, 'Test page', route);

  return render(
    <BrowserRouter>
      {ui}
      <Toaster />
    </BrowserRouter>,
    options
  );
}

/**
 * Mock fetch implementation for API calls
 */
export function createMockFetch(responses = {}) {
  return jest.fn((url, options) => {
    const method = options?.method || 'GET';
    const key = `${method} ${url}`;

    const mockResponse = responses[key] || responses[url];

    if (mockResponse) {
      if (mockResponse.error) {
        return Promise.reject(mockResponse.error);
      }

      return Promise.resolve({
        ok: mockResponse.ok !== false,
        status: mockResponse.status || 200,
        json: async () => mockResponse.data || mockResponse,
        text: async () => JSON.stringify(mockResponse.data || mockResponse),
      });
    }

    // Default 404 response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' }),
    });
  });
}

/**
 * Wait for async operations
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Mock localStorage with token
 */
export function mockAuthToken(token = 'mock-jwt-token') {
  if (typeof global.localStorage.getItem.mockImplementation === 'function') {
    global.localStorage.getItem.mockImplementation((key) => {
      if (key === 'token') return token;
      return null;
    });
  } else if (typeof global.localStorage.getItem.mockReturnValue === 'function') {
    global.localStorage.getItem.mockReturnValue(token);
  }
}

/**
 * Clear all mocks
 */
export function clearAllMocks() {
  jest.clearAllMocks();
  // localStorage is already mocked in jest.setup.js
  if (global.localStorage.getItem && typeof global.localStorage.getItem.mockClear === 'function') {
    global.localStorage.getItem.mockClear();
    global.localStorage.setItem.mockClear();
    global.localStorage.removeItem.mockClear();
    global.localStorage.clear.mockClear();
  }
}

/**
 * Mock socket.io-client
 */
export function createMockSocket() {
  const eventHandlers = {};

  const mockSocket = {
    on: jest.fn((event, handler) => {
      eventHandlers[event] = handler;
    }),
    off: jest.fn((event) => {
      delete eventHandlers[event];
    }),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,

    // Helper to trigger events in tests
    _triggerEvent: (event, ...args) => {
      if (eventHandlers[event]) {
        eventHandlers[event](...args);
      }
    },
    _getHandler: (event) => eventHandlers[event],
  };

  return mockSocket;
}

/**
 * Mock Razorpay
 */
export function createMockRazorpay() {
  const mockRazorpay = jest.fn((options) => {
    return {
      open: jest.fn(() => {
        // Simulate successful payment
        setTimeout(() => {
          if (options.handler) {
            options.handler({
              razorpay_payment_id: 'pay_mock123',
              razorpay_order_id: options.order_id,
              razorpay_signature: 'signature_mock',
            });
          }
        }, 100);
      }),
      on: jest.fn(),
    };
  });

  global.Razorpay = mockRazorpay;
  return mockRazorpay;
}

/**
 * Mock Jitsi Meet
 */
export function createMockJitsiMeet() {
  const mockJitsiMeet = {
    JitsiMeetExternalAPI: jest.fn(function(domain, options) {
      this.getRoomsInfo = jest.fn(() => Promise.resolve([]));
      this.executeCommand = jest.fn();
      this.addEventListener = jest.fn();
      this.removeEventListener = jest.fn();
      this.dispose = jest.fn();
      this.isVideoMuted = jest.fn(() => false);
      this.isAudioMuted = jest.fn(() => false);
    }),
  };

  global.JitsiMeetExternalAPI = mockJitsiMeet.JitsiMeetExternalAPI;
  return mockJitsiMeet;
}

/**
 * Mock jsPDF
 */
export function createMockJsPDF() {
  const mockJsPDF = jest.fn(function() {
    this.text = jest.fn();
    this.setFontSize = jest.fn();
    this.setFont = jest.fn();
    this.addImage = jest.fn();
    this.rect = jest.fn();
    this.line = jest.fn();
    this.save = jest.fn();
    this.addPage = jest.fn();
    this.setLineWidth = jest.fn();
    this.setDrawColor = jest.fn();
    this.setTextColor = jest.fn();
    this.setFillColor = jest.fn();
    this.roundedRect = jest.fn();
    this.splitTextToSize = jest.fn((value) => [value]);
    this.getTextWidth = jest.fn(() => 50);
  });

  return mockJsPDF;
}

/**
 * Create mock navigate function
 */
export function createMockNavigate() {
  return jest.fn();
}

/**
 * Create mock location object
 */
export function createMockLocation(pathname = '/parent') {
  return {
    pathname,
    search: '',
    hash: '',
    state: null,
  };
}

/**
 * Simulate user typing with delay
 */
export async function typeWithDelay(element, text, delay = 50) {
  for (const char of text) {
    element.value += char;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Simulate file upload
 */
export function createMockFile(name = 'test.pdf', type = 'application/pdf', size = 1024) {
  return new File(['mock content'], name, { type, size });
}

/**
 * Mock window.matchMedia for responsive tests
 */
export function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

/**
 * Mock crypto for E2EE testing
 */
export function mockCrypto() {
  const crypto = {
    subtle: {
      generateKey: jest.fn(() =>
        Promise.resolve({
          publicKey: 'mock-public-key',
          privateKey: 'mock-private-key',
        })
      ),
      encrypt: jest.fn((algorithm, key, data) =>
        Promise.resolve(new ArrayBuffer(32))
      ),
      decrypt: jest.fn((algorithm, key, data) =>
        Promise.resolve(new TextEncoder().encode('decrypted message'))
      ),
      exportKey: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      importKey: jest.fn(() => Promise.resolve('imported-key')),
    },
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  };

  global.crypto = crypto;
  return crypto;
}
