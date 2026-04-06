/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { copyFileSync } from "fs";

/**
 * Vite plugin: guard Vite's modulepreload helper for worker contexts.
 *
 * Vite inlines a modulepreload helper into chunks. Its code references
 * `document` and `window` at the top level, which crashes in workers on
 * iOS WKWebView. This plugin adds typeof guards so the helper is a no-op
 * when DOM APIs are unavailable.
 *
 * The heavy lifting for worker compatibility is done by manualChunks
 * (below), which keeps cubing.js core code in a separate chunk from
 * React and twisty player DOM code. cubing.js's own code already guards
 * its DOM access with `globalThis.HTMLElement ? ... : fallback` patterns.
 */
function workerSafeChunks(): Plugin {
  return {
    name: "worker-safe-chunks",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;

        // Guard Vite's modulepreload helper DOM access
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
      }
    },
  };
}

/**
 * GitHub Pages serves 404.html for unknown paths. Copying index.html
 * to 404.html lets the SPA handle client-side routes on hard refresh.
 */
function githubPagesSpa(): Plugin {
  return {
    name: "github-pages-spa",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const src = path.resolve(outDir, "index.html");
      const dest = path.resolve(outDir, "404.html");
      copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  base: "/cubing-trainer/",
  plugins: [react(), tailwindcss(), workerSafeChunks(), githubPagesSpa()],
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
          // Keep cubing.js core (DOM-free) code in its own chunk so the
          // search worker's inside chunk imports from here instead of from
          // the index chunk (which contains React + twisty player DOM code).
          // Exclude worker entry and inside chunks — they must remain
          // separate for the worker's dynamic import to work.
          if (
            id.includes("node_modules/cubing") &&
            !id.includes("/twisty/") &&
            !id.includes("twisty-dynamic") &&
            !id.includes("search-worker-entry") &&
            !id.includes("/inside")
          ) {
            return "cubing-core";
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
