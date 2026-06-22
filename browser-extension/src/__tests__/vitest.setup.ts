import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock chrome extension APIs
globalThis.chrome = {
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  identity: {
    getRedirectURL: vi.fn(() => "https://extid.chromiumapp.org/"),
    launchWebAuthFlow: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
} as unknown as typeof chrome;
