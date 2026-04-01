import { useEffect } from "react";

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

    console.log("[WakeLock] UA:", navigator.userAgent);
    console.log("[WakeLock] isBluefy:", isBluefy);
    console.log("[WakeLock] navigator.wakeLock exists:", "wakeLock" in navigator);
    console.log("[WakeLock] path:", hasNativeWakeLock ? "native" : "video-fallback");

    // ── Native Wake Lock path ──
    if (hasNativeWakeLock) {
      let lock: WakeLockSentinel | null = null;

      async function acquire() {
        try {
          lock = await navigator.wakeLock.request("screen");
          console.log("[WakeLock] native lock acquired, type:", lock.type);
          lock.addEventListener("release", () => {
            console.log("[WakeLock] native lock released");
          });
        } catch (e) {
          console.warn("[WakeLock] native lock failed:", e);
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

    // ── Video fallback (iOS / Bluefy) ──
    // A looping silent video keeps the OS from sleeping.
    // This is the same technique used by NoSleep.js.
    // Tiny webm: 0.1s of silence, ~300 bytes base64.
    const SILENT_WEBM =
      "data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVAIueBAKNAHIEAAIAwAQCdASoIAAgAAUAmJaQAA3AA/vz0AAA=";

    // Some iOS browsers also need an mp4 source for the trick to work.
    const SILENT_MP4 =
      "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU4Ljc2LjEwMA==";

    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("loop", "");
    // Must be in the DOM on some browsers, but invisible
    video.style.position = "fixed";
    video.style.top = "-1px";
    video.style.left = "-1px";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";

    // Prefer webm, fall back to mp4
    const webmSource = document.createElement("source");
    webmSource.src = SILENT_WEBM;
    webmSource.type = "video/webm";
    video.appendChild(webmSource);

    const mp4Source = document.createElement("source");
    mp4Source.src = SILENT_MP4;
    mp4Source.type = "video/mp4";
    video.appendChild(mp4Source);

    document.body.appendChild(video);

    function play() {
      const result = video.play();
      if (!result) return; // No promise in non-browser environments
      result.then(() => {
        console.log("[WakeLock] video playing, paused:", video.paused, "readyState:", video.readyState);
      }).catch((e) => {
        console.warn("[WakeLock] video autoplay blocked:", e.message);
        // Autoplay blocked — needs a user gesture first.
        // Listen for the first tap/click and retry.
        function onInteraction() {
          video.play()?.then(() => {
            console.log("[WakeLock] video playing after interaction, paused:", video.paused);
          }).catch((e2) => {
            console.warn("[WakeLock] video play after interaction failed:", e2.message);
          });
          document.removeEventListener("touchstart", onInteraction);
          document.removeEventListener("click", onInteraction);
        }
        document.addEventListener("touchstart", onInteraction, { once: true });
        document.addEventListener("click", onInteraction, { once: true });
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        play();
      }
    }

    play();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      video.pause();
      video.remove();
    };
  }, []);
}
