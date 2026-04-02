import { useEffect, useState } from "react";

export interface WakeLockDiagnostics {
  userAgent: string;
  isBluefy: boolean;
  nativeApiExists: boolean;
  path: "native" | "video-fallback";
  status: string;
}

// Module-level diagnostics so the debug page can read them
let currentDiagnostics: WakeLockDiagnostics | null = null;
const listeners = new Set<() => void>();

function setDiagnostics(update: Partial<WakeLockDiagnostics>) {
  currentDiagnostics = { ...currentDiagnostics!, ...update };
  for (const l of listeners) l();
}

export function useWakeLockDiagnostics(): WakeLockDiagnostics | null {
  const [diag, setDiag] = useState(currentDiagnostics);
  useEffect(() => {
    const listener = () => setDiag({ ...currentDiagnostics! });
    listeners.add(listener);
    // Sync in case it was set before mount
    if (currentDiagnostics) setDiag({ ...currentDiagnostics });
    return () => { listeners.delete(listener); };
  }, []);
  return diag;
}

/**
 * Keeps the screen awake while the app is visible.
 *
 * Primary: Screen Wake Lock API (Chrome, Safari 16.4+).
 * Fallback: plays a tiny silent video in a loop, which tricks
 * iOS / Bluefy into keeping the screen on.
 *
 * Re-acquires the lock when the tab regains visibility (browsers
 * release wake locks when a tab is backgrounded).
 */
export function useWakeLock() {
  useEffect(() => {
    const isBluefy = /Bluefy/i.test(navigator.userAgent);
    const hasNativeWakeLock = !isBluefy && "wakeLock" in navigator;
    const path = hasNativeWakeLock ? "native" : "video-fallback";

    currentDiagnostics = {
      userAgent: navigator.userAgent,
      isBluefy,
      nativeApiExists: "wakeLock" in navigator,
      path,
      status: "initializing",
    };
    for (const l of listeners) l();

    // ── Native Wake Lock path ──
    if (hasNativeWakeLock) {
      let lock: WakeLockSentinel | null = null;

      async function acquire() {
        try {
          lock = await navigator.wakeLock.request("screen");
          setDiagnostics({ status: "native lock acquired" });
          lock.addEventListener("release", () => {
            setDiagnostics({ status: "native lock released" });
          });
        } catch (e) {
          setDiagnostics({ status: `native lock failed: ${e}` });
        }
      }

      function onVisibilityChange() {
        if (document.visibilityState === "visible") {
          acquire();
        }
      }

      acquire();
      document.addEventListener("visibilitychange", onVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        lock?.release();
      };
    }

    // ── Bluefy path: use its native screen-dim API ──
    if (isBluefy && "bluetooth" in navigator) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).bluetooth.setScreenDimEnabled(true);
        setDiagnostics({ status: "bluefy setScreenDimEnabled(true) called" });
      } catch (e) {
        setDiagnostics({ status: `bluefy setScreenDimEnabled failed: ${e}` });
      }
      return () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (navigator as any).bluetooth.setScreenDimEnabled(false);
        } catch {
          // ignore cleanup errors
        }
      };
    }

    // ── Generic fallback: nothing we can do ──
    setDiagnostics({ status: "no wake lock method available" });
  }, []);
}
