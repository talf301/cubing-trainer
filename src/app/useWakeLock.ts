import { useEffect } from "react";

/**
 * Keeps the screen awake while the app is visible.
 * Uses the Screen Wake Lock API — silently no-ops if unsupported.
 * Re-acquires the lock when the tab regains visibility (browsers
 * release wake locks when a tab is backgrounded).
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Permission denied or low battery — nothing we can do.
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
  }, []);
}
