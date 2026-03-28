/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * Vite plugin: make shared chunks safe for worker contexts.
 *
 * Vite shares chunks between the main thread and web workers. The cubing.js
 * search worker entry imports the main app bundle (for a tiny `expose` flag)
 * and a preload helper (which uses DOM APIs). On desktop Chrome, unused DOM
 * references in imported modules are tolerated. On iOS WKWebView (Bluefy),
 * the worker crashes during module evaluation.
 *
 * This plugin patches:
 * 1. The preload helper — guards DOM access behind `typeof document` checks
 * 2. The worker entry — replaces the main bundle import with an inline flag
 */
function workerSafeChunks(): Plugin {
  return {
    name: "worker-safe-chunks",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;

        // Inject DOM shim into the preload helper. Since ES module imports
        // are hoisted, the shim must be in the first module the worker loads.
        // The preload helper is imported by the worker entry before anything
        // else, so injecting here ensures DOM stubs exist before cubing.js
        // modules (which reference document/customElements) are evaluated.
        // The shim is guarded by typeof document === "undefined" so it's
        // a no-op on the main thread.
        if (chunk.fileName.includes("preload-helper")) {
          const domShim = `if(typeof document==="undefined"){` +
            `const _noop=()=>new Proxy({},{get:()=>_noop,set:()=>true});` +
            `globalThis.document=_noop();` +
            `globalThis.HTMLElement=class{};` +
            `globalThis.customElements={define:_noop,get:_noop};` +
            `globalThis.CSSStyleSheet=class{replaceSync(){}};` +
            `globalThis.window=globalThis;` +
            `globalThis.localStorage={getItem:()=>null,setItem:_noop,removeItem:_noop};` +
            `globalThis.navigator=_noop();}`;
          chunk.code = domShim + chunk.code;
        }

        // Also guard the preload helper's own DOM access
        if (chunk.code.includes("modulepreload")) {
          chunk.code = chunk.code.replace(
            /if\(([a-zA-Z])&&\1\.length>0\)\{document\./g,
            'if($1&&$1.length>0&&typeof document!=="undefined"){document.',
          );
          chunk.code = chunk.code.replace(
            /window\.dispatchEvent\(/g,
            '(typeof window!=="undefined"&&window.dispatchEvent)(',
          );
        }

        // Patch the search worker entry for worker compatibility.
        if (
          chunk.fileName.includes("search-worker-entry") &&
          chunk.code.includes("comlink-exposed")
        ) {
          // Replace main bundle import with inline expose flag
          chunk.code = chunk.code.replace(
            /import\{(\w) as (\w)\}from"\.\/index-[^"]+\.js";/,
            "const $2={expose:true};",
          );
        }

        // Remove bare side-effect imports of react-vendor from worker chunks.
        if (
          chunk.fileName.includes("search-worker-entry") ||
          chunk.fileName.includes("inside-")
        ) {
          chunk.code = chunk.code.replace(
            /import"\.\/react-vendor-[^"]+\.js";/g,
            "",
          );
        }
      }
    },
  };
}

export default defineConfig({
  base: "/cubing-trainer/",
  plugins: [react(), tailwindcss(), workerSafeChunks()],
  build: {
    target: "esnext",
    // Disable the inline modulepreload polyfill. It uses document.createElement
    // at the top level, which crashes when the index chunk is imported by the
    // cubing.js search worker. Modern browsers support modulepreload natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  esbuild: {
    target: "esnext", // cubing.js search worker uses top-level await
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  },
});
