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
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
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
