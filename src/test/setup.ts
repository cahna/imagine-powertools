import { vi, beforeEach } from "vitest";

// Mock DataTransfer for clipboard operations (not available in jsdom)
class MockDataTransfer {
  private data: Map<string, string> = new Map();

  setData(format: string, data: string): void {
    this.data.set(format, data);
  }

  getData(format: string): string {
    return this.data.get(format) ?? "";
  }

  clearData(format?: string): void {
    if (format) {
      this.data.delete(format);
    } else {
      this.data.clear();
    }
  }
}

// Mock ClipboardEvent for paste operations (not available in jsdom)
class MockClipboardEvent extends Event {
  readonly clipboardData: DataTransfer | null;

  constructor(type: string, eventInitDict?: ClipboardEventInit) {
    super(type, eventInitDict);
    this.clipboardData = eventInitDict?.clipboardData ?? null;
  }
}

// Assign mocks to global if not present
if (typeof globalThis.DataTransfer === "undefined") {
  Object.assign(globalThis, { DataTransfer: MockDataTransfer });
}
if (typeof globalThis.ClipboardEvent === "undefined") {
  Object.assign(globalThis, { ClipboardEvent: MockClipboardEvent });
}

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
