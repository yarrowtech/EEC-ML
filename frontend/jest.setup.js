import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder (required by react-router-dom)
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// localStorage: a real in-memory store wrapped in jest spies. Behaves like the
// browser API (values round-trip within a test) while still being assertable and
// per-test overridable (`localStorage.getItem = jest.fn(...)`).
const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: jest.fn((key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[String(key)] = String(value);
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((i) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    __reset() {
      store = {};
      this.getItem.mockClear();
      this.setItem.mockClear();
      this.removeItem.mockClear();
      this.clear.mockClear();
    },
  };
};

let localStorageMock = createLocalStorageMock();
Object.defineProperty(global, 'localStorage', {
  configurable: true,
  get: () => localStorageMock,
  set: (value) => {
    localStorageMock = value;
  },
});

// ResizeObserver — not implemented in JSDOM (recharts ResponsiveContainer,
// MindMapUI, AcademicSetup, etc. all construct one).
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock window.scrollTo (not implemented in JSDOM)
window.scrollTo = jest.fn();

// Mock window.dispatchEvent
window.dispatchEvent = jest.fn();

// Reset before each test
beforeEach(() => {
  if (typeof localStorageMock.__reset === 'function') {
    localStorageMock.__reset();
  } else {
    localStorageMock = createLocalStorageMock();
  }
  window.scrollTo.mockClear();
  window.dispatchEvent.mockClear();
});
