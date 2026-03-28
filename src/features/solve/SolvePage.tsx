// src/features/solve/SolvePage.tsx
import { useState, useCallback } from "react";
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSolveSession } from "./use-solve-session";
import { SolveHistory, formatTime } from "./SolveHistory";
import { ScrambleDisplay } from "./ScrambleDisplay";

interface SolvePageProps {
  connection: CubeConnection;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Connect your cube to begin",
  scrambling: "",
  ready: "Scramble verified — start solving!",
  solving: "",
  solved: "Solved!",
};

export function SolvePage({ connection }: SolvePageProps) {
  const { status, error, connect } = useCubeConnection(connection);
  const { phase, displayMs, trackerState, recentSolves, scrambleSource } =
    useSolveSession(connection);

  const isConnected = status === "connected";

  const [workerDiag, setWorkerDiag] = useState("not run");
  const runWorkerTest = useCallback(() => {
    setWorkerDiag("running...");

    // Test 1: Classic worker
    try {
      const w1 = new Worker(import.meta.env.BASE_URL + "worker-test.js");
      w1.onmessage = (e) => {
        setWorkerDiag((prev) => prev + "\n[classic] " + e.data);
        w1.terminate();
      };
      w1.onerror = (e) => {
        setWorkerDiag((prev) => prev + "\n[classic] error: " + e.message);
      };
    } catch (e) {
      setWorkerDiag((prev) => prev + "\n[classic] create failed: " + (e as Error).message);
    }

    // Test 2: Module worker with blob
    try {
      const blob = new Blob(['postMessage("blob-module-ok")'], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const w2 = new Worker(url, { type: "module" });
      w2.onmessage = (e) => {
        setWorkerDiag((prev) => prev + "\n[blob-module] " + e.data);
        w2.terminate();
        URL.revokeObjectURL(url);
      };
      w2.onerror = (e) => {
        setWorkerDiag((prev) => prev + "\n[blob-module] error: " + e.message);
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      setWorkerDiag((prev) => prev + "\n[blob-module] create failed: " + (e as Error).message);
    }

    // Test 3: Module worker with dynamic import
    try {
      const code = 'try { await import("data:text/javascript,"); postMessage("dynamic-import-ok"); } catch(e) { postMessage("dynamic-import-fail: " + e.message); }';
      const blob = new Blob([code], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const w3 = new Worker(url, { type: "module" });
      w3.onmessage = (e) => {
        setWorkerDiag((prev) => prev + "\n[dynamic-import] " + e.data);
        w3.terminate();
        URL.revokeObjectURL(url);
      };
      w3.onerror = (e) => {
        setWorkerDiag((prev) => prev + "\n[dynamic-import] error: " + e.message);
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      setWorkerDiag((prev) => prev + "\n[dynamic-import] create failed: " + (e as Error).message);
    }

    // Test 4: Try importing the actual cubing.js worker entry in a worker
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const indexSrc = scripts.map(s => s.getAttribute('src')!).find(s => s?.includes('/assets/index-'));
    if (indexSrc) {
      // Fetch the index chunk to find chunk filenames
      fetch(new URL(indexSrc, location.href).href)
        .then(r => r.text())
        .then(code => {
          const base = new URL(indexSrc, location.href).href.replace(/[^/]+$/, '');
          // Find chunk filenames
          const find = (pat: string) => {
            const re = new RegExp(`"(${pat}[^"]+\\.js)"`, 'g');
            const m = [...code.matchAll(re)];
            return m.length > 0 ? base + m[0][1] : null;
          };

          const preloadUrl = find("preload-helper");
          const workerEntryUrl = find("search-worker-entry");
          // Also find the index chunk URL itself
          const indexUrl = new URL(indexSrc, location.href).href;

          const urls = [
            { name: "preload-helper", url: preloadUrl },
            { name: "index", url: indexUrl },
            { name: "worker-entry", url: workerEntryUrl },
          ];

          for (const { name, url } of urls) {
            if (!url) {
              setWorkerDiag(prev => prev + `\n[${name}] not found`);
              continue;
            }
            const testCode = `
              try {
                await import("${url}");
                postMessage("OK");
              } catch(e) {
                postMessage("FAIL: " + e.message + (e.stack ? "\\n" + e.stack.split("\\n").slice(0,3).join("\\n") : ""));
              }
            `;
            const blob = new Blob([testCode], { type: "text/javascript" });
            const blobUrl = URL.createObjectURL(blob);
            const w = new Worker(blobUrl, { type: "module" });
            const label = name;
            w.onmessage = (e) => setWorkerDiag(prev => prev + `\n[${label}] ${e.data}`);
            w.onerror = (e) => setWorkerDiag(prev => prev + `\n[${label}] onerror: ${e.message}`);
            setTimeout(() => {
              setWorkerDiag(prev => prev.includes(`[${label}]`) ? prev : prev + `\n[${label}] timeout (no response)`);
              w.terminate();
              URL.revokeObjectURL(blobUrl);
            }, 8000);
          }
        });
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Connection status */}
      {!isConnected && (
        <div className="text-center">
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded bg-blue-600 px-6 py-3 text-lg font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : "Connect Cube"}
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Worker diagnostic */}
      <div className="text-center">
        <button onClick={runWorkerTest} className="rounded bg-gray-700 px-3 py-1 text-xs">
          Test Worker
        </button>
        <pre className="mt-1 text-xs text-gray-500 font-mono whitespace-pre-wrap text-left max-w-md mx-auto">
          {workerDiag}
        </pre>
        {scrambleSource && (
          <p className="text-xs text-gray-500 font-mono">scramble: {scrambleSource}</p>
        )}
      </div>

      {/* Scramble display with progress */}
      {phase === "scrambling" && trackerState && (
        <div className="text-center">
          <ScrambleDisplay trackerState={trackerState} />
        </div>
      )}

      {/* Timer */}
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {formatTime(displayMs)}
        </p>
        {PHASE_LABELS[phase] && (
          <p className="mt-2 text-gray-400">{PHASE_LABELS[phase]}</p>
        )}
      </div>

      {/* Recent solves */}
      {recentSolves.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent Solves</h2>
          <SolveHistory solves={recentSolves} />
        </div>
      )}
    </div>
  );
}
