import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PllRecognitionSession,
  type PllStickerCacheInterface,
  type PllRecognitionStatsStoreInterface,
  type PllRecognitionCaseSelectorInterface,
  type PllRecognitionCaseWeight,
  type PllRecognitionAttempt,
  type RecognitionPhase,
} from "../pll-recognition-session";
import type { Color } from "../pll-sticker-cache";

function createMockStatsStore(): PllRecognitionStatsStoreInterface {
  return {
    recordAttempt: vi.fn().mockResolvedValue(undefined),
    getAllStats: vi.fn().mockResolvedValue([]),
  };
}

function createMockSelector(caseName: string = "T"): PllRecognitionCaseSelectorInterface {
  return {
    select: vi.fn().mockReturnValue(caseName),
  };
}

function createMockStickerCache(): PllStickerCacheInterface {
  const mockStickers: Color[] = ["F", "F", "R", "R", "B", "B"];
  return {
    getStickers: vi.fn().mockResolvedValue(mockStickers),
  };
}

describe("PllRecognitionSession", () => {
  let statsStore: PllRecognitionStatsStoreInterface;
  let selector: PllRecognitionCaseSelectorInterface;
  let stickerCache: PllStickerCacheInterface;
  let session: PllRecognitionSession;

  beforeEach(() => {
    statsStore = createMockStatsStore();
    selector = createMockSelector("T");
    stickerCache = createMockStickerCache();
    session = new PllRecognitionSession(statsStore, selector, stickerCache);
  });

  describe("initial state", () => {
    it("starts in idle phase", () => {
      expect(session.phase).toBe("idle");
    });

    it("has no current case", () => {
      expect(session.currentCase).toBeNull();
    });
  });

  describe("start()", () => {
    it("transitions from idle to presenting", async () => {
      await session.start();
      expect(session.phase).toBe("presenting");
    });

    it("sets the current case from the selector", async () => {
      await session.start();
      expect(session.currentCase).toBe("T");
    });

    it("fetches stickers from cache", async () => {
      await session.start();
      expect(stickerCache.getStickers).toHaveBeenCalledWith(
        "T",
        expect.any(String),
        expect.any(Number),
      );
      expect(session.stickers).toHaveLength(6);
    });

    it("picks 5 distractors that don't include the current case", async () => {
      await session.start();
      expect(session.distractors).toHaveLength(5);
      expect(session.distractors).not.toContain("T");
    });

    it("builds weights for all 21 PLL cases and passes to selector", async () => {
      await session.start();
      const selectCall = (selector.select as ReturnType<typeof vi.fn>).mock.calls[0];
      const weights: PllRecognitionCaseWeight[] = selectCall[0];
      expect(weights.length).toBe(21);
      // Each weight should have the expected shape
      for (const w of weights) {
        expect(w).toHaveProperty("caseName");
        expect(w).toHaveProperty("attemptCount");
        expect(w).toHaveProperty("accuracy");
        expect(w).toHaveProperty("avgTime");
        expect(w).toHaveProperty("lastAttemptAt");
      }
    });

    it("enriches weights with stats from the store", async () => {
      (statsStore.getAllStats as ReturnType<typeof vi.fn>).mockResolvedValue([
        { caseName: "T", attemptCount: 10, accuracy: 0.8, avgTime: 1500, lastAttemptAt: 1000 },
      ]);
      await session.start();
      const selectCall = (selector.select as ReturnType<typeof vi.fn>).mock.calls[0];
      const weights: PllRecognitionCaseWeight[] = selectCall[0];
      const tWeight = weights.find((w) => w.caseName === "T");
      expect(tWeight).toEqual({
        caseName: "T",
        attemptCount: 10,
        accuracy: 0.8,
        avgTime: 1500,
        lastAttemptAt: 1000,
      });
      // Unattempted cases get zeros
      const aaWeight = weights.find((w) => w.caseName === "Aa");
      expect(aaWeight?.attemptCount).toBe(0);
    });

    it("does nothing if called during presenting phase", async () => {
      await session.start();
      const firstCase = session.currentCase;
      // Calling start again while presenting should be a no-op
      selector = createMockSelector("Y");
      await session.start();
      expect(session.currentCase).toBe(firstCase);
    });

    it("does nothing if selector returns null", async () => {
      selector = { select: vi.fn().mockReturnValue(null) };
      session = new PllRecognitionSession(statsStore, selector, stickerCache);
      await session.start();
      expect(session.phase).toBe("idle");
    });
  });

  describe("answer()", () => {
    beforeEach(async () => {
      await session.start();
    });

    it("transitions from presenting to review on correct answer", async () => {
      await session.answer("T");
      expect(session.phase).toBe("review");
      expect(session.correct).toBe(true);
      expect(session.answerGiven).toBe("T");
    });

    it("transitions from presenting to review on incorrect answer", async () => {
      await session.answer("Y");
      expect(session.phase).toBe("review");
      expect(session.correct).toBe(false);
      expect(session.answerGiven).toBe("Y");
    });

    it("records recognition time", async () => {
      // The time between start() and answer() should be > 0
      await session.answer("T");
      expect(session.recognitionTime).toBeGreaterThanOrEqual(0);
    });

    it("records attempt in stats store", async () => {
      await session.answer("T");
      expect(statsStore.recordAttempt).toHaveBeenCalledTimes(1);
      const attempt: PllRecognitionAttempt = (
        statsStore.recordAttempt as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      expect(attempt.caseName).toBe("T");
      expect(attempt.correct).toBe(true);
      expect(attempt.answerGiven).toBe("T");
      expect(attempt.id).toBeTruthy();
      expect(attempt.recognitionTime).toBeGreaterThanOrEqual(0);
      expect(attempt.distractors).toHaveLength(5);
    });

    it("records incorrect attempt in stats store", async () => {
      await session.answer("Y");
      const attempt: PllRecognitionAttempt = (
        statsStore.recordAttempt as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      expect(attempt.correct).toBe(false);
      expect(attempt.answerGiven).toBe("Y");
    });

    it("does nothing if not in presenting phase", async () => {
      await session.answer("T"); // now in review
      await session.answer("Y"); // should be no-op
      expect(session.answerGiven).toBe("T");
      expect(statsStore.recordAttempt).toHaveBeenCalledTimes(1);
    });
  });

  describe("next()", () => {
    it("transitions from review back to presenting", async () => {
      await session.start();
      await session.answer("T");
      expect(session.phase).toBe("review");
      await session.next();
      expect(session.phase).toBe("presenting");
    });

    it("does nothing if not in review phase", async () => {
      await session.start();
      await session.next(); // in presenting, should be no-op
      expect(session.phase).toBe("presenting");
    });
  });

  describe("phase listeners", () => {
    it("notifies listeners on phase changes", async () => {
      const phases: RecognitionPhase[] = [];
      session.addPhaseListener((phase) => phases.push(phase));

      await session.start();
      await session.answer("T");
      await session.next();

      expect(phases).toEqual(["presenting", "review", "presenting"]);
    });

    it("supports removing listeners", async () => {
      const phases: RecognitionPhase[] = [];
      const listener = (phase: RecognitionPhase) => phases.push(phase);
      session.addPhaseListener(listener);

      await session.start();
      session.removePhaseListener(listener);
      await session.answer("T");

      expect(phases).toEqual(["presenting"]);
    });
  });

  describe("full lifecycle", () => {
    it("idle -> presenting -> review -> presenting (via next)", async () => {
      expect(session.phase).toBe("idle");

      await session.start();
      expect(session.phase).toBe("presenting");
      expect(session.currentCase).toBe("T");
      expect(session.stickers).toHaveLength(6);
      expect(session.distractors).toHaveLength(5);

      await session.answer("T");
      expect(session.phase).toBe("review");
      expect(session.correct).toBe(true);

      await session.next();
      expect(session.phase).toBe("presenting");
    });
  });

  describe("AUF and corner randomization", () => {
    it("sets auf to a valid AUF value", async () => {
      await session.start();
      expect(["", "U", "U'", "U2"]).toContain(session.auf);
    });

    it("sets corner to a valid ViewingCorner", async () => {
      await session.start();
      expect([0, 1, 2, 3]).toContain(session.corner);
    });
  });
});
