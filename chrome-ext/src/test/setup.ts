import { vi, beforeEach } from "vitest";

// Mock Chrome extension APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn((message, callback) => {
      if (callback) callback({ success: true });
    }),
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
  },
  storage: {
    local: {
      get: vi.fn((keys, callback) => callback({})),
      set: vi.fn((items, callback) => callback?.()),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
  },
};

// Assign to global
Object.assign(globalThis, { chrome: mockChrome });

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});
