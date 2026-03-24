import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

// Polyfill Web Crypto API for jsdom (used by MoYu AES encryption tests)
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}

// Mock CSSStyleSheet.replaceSync for cubing.js in test environment
Object.defineProperty(CSSStyleSheet.prototype, "replaceSync", {
  value: function () {
    // no-op for tests
  },
  writable: true,
  configurable: true,
});
