import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Mock CSSStyleSheet.replaceSync for cubing.js in test environment
Object.defineProperty(CSSStyleSheet.prototype, "replaceSync", {
  value: function () {
    // no-op for tests
  },
  writable: true,
  configurable: true,
});
