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

        // Patch the preload helper: guard DOM access for worker safety
        if (chunk.code.includes("modulepreload")) {
          // Guard the preload branch that uses document
          chunk.code = chunk.code.replace(
            /if\(([a-zA-Z])&&\1\.length>0\)\{document\./g,
            'if($1&&$1.length>0&&typeof document!=="undefined"){document.',
          );
          // Guard the error handler that uses window.dispatchEvent
          chunk.code = chunk.code.replace(
            /window\.dispatchEvent\(/g,
            '(typeof window!=="undefined"&&window.dispatchEvent)(',
          );
        }

        // Patch the search worker entry: replace main bundle import with
        // an inline expose flag so the worker doesn't load the entire app.
        // The worker entry has: import{e as o}from"./index-XXXX.js";o.expose&&(...)
        // We replace the import with a local constant.
        if (
          chunk.fileName.includes("search-worker-entry") &&
          chunk.code.includes("comlink-exposed")
        ) {
          // Replace: import{e as VAR}from"./index-HASH.js";VAR.expose&&(
          // With:    const VAR={expose:true};VAR.expose&&(
          chunk.code = chunk.code.replace(
            /import\{(\w) as (\w)\}from"\.\/index-[^"]+\.js";/,
            "const $2={expose:true};",
          );
          // Remove bare side-effect imports of vendor chunks (e.g. react-vendor)
          // that were left behind. Workers don't need React.
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split React and DOM-dependent libraries into their own chunk.
          // This prevents the cubing.js solver (which runs in a web worker)
          // from importing a chunk that contains React/DOM code, which
          // crashes in worker contexts on iOS WKWebView.
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
