// Minimal test worker — reports what works back to main thread
const results = [];

function test(name, fn) {
  try {
    const r = fn();
    results.push(name + ": OK" + (r ? " (" + r + ")" : ""));
  } catch (e) {
    results.push(name + ": FAIL (" + e.message + ")");
  }
}

test("postMessage", () => typeof postMessage);
test("importScripts", () => typeof importScripts);
test("dynamic-import", () => typeof import("data:text/javascript,").then);

// Test if we can do a dynamic import of a real module
import("data:text/javascript,export const x = 42")
  .then(() => results.push("dynamic-import-exec: OK"))
  .catch((e) => results.push("dynamic-import-exec: FAIL (" + e.message + ")"))
  .finally(() => {
    postMessage(results.join("\n"));
  });
