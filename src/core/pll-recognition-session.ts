import { PLL_CASES } from "./pll-cases";
import type { Color, ViewingCorner, AUF } from "./pll-sticker-cache";

export type RecognitionPhase = "idle" | "presenting" | "review";

const AUF_OPTIONS: AUF[] = ["", "U", "U'", "U2"];
const VIEWING_CORNERS: ViewingCorner[] = [0, 1, 2, 3];

/**
 * Interface for the sticker cache dependency.
 * The real PllStickerCache will implement this; tests can mock it.
 */
export interface PllStickerCacheInterface {
  getStickers(caseName: string, auf: AUF, corner: ViewingCorner): Promise<Color[]>;
}

/**
 * Interface for the recognition stats store dependency.
 * The real PllRecognitionStatsStore will implement this; tests can mock it.
 */
export interface PllRecognitionStatsStoreInterface {
  recordAttempt(attempt: PllRecognitionAttempt): Promise<void>;
  getAllStats(): Promise<PllRecognitionCaseStats[]>;
}

/**
 * Interface for the case selector dependency.
 * The real PllRecognitionCaseSelector will implement this; tests can mock it.
 */
export interface PllRecognitionCaseSelectorInterface {
  select(
    cases: PllRecognitionCaseWeight[],
    now?: number,
  ): string | null;
}

export interface PllRecognitionAttempt {
  id: string;
  caseName: string;
  viewingCorner: number;
  auf: number;
  correct: boolean;
  answerGiven: string;
  distractors: string[];
  recognitionTime: number;
  timestamp: number;
}

export interface PllRecognitionCaseStats {
  caseName: string;
  attemptCount: number;
  accuracy: number;
  avgTime: number;
  lastAttemptAt: number;
}

export interface PllRecognitionCaseWeight extends PllRecognitionCaseStats {
  lastAttemptAt: number;
}

const ALL_PLL_CASE_NAMES = Object.keys(PLL_CASES);

export class PllRecognitionSession {
  private _phase: RecognitionPhase = "idle";
  private _currentCase: string | null = null;
  private _auf: AUF = "";
  private _corner: ViewingCorner = 0;
  private _stickers: Color[] = [];
  private _distractors: string[] = [];
  private _answerGiven: string | null = null;
  private _correct: boolean = false;
  private _recognitionTime: number = 0;
  private presentStartTime: number = 0;
  private phaseListeners = new Set<(phase: RecognitionPhase) => void>();

  constructor(
    private statsStore: PllRecognitionStatsStoreInterface,
    private caseSelector: PllRecognitionCaseSelectorInterface,
    private stickerCache: PllStickerCacheInterface,
  ) {}

  get phase(): RecognitionPhase {
    return this._phase;
  }

  get currentCase(): string | null {
    return this._currentCase;
  }

  get auf(): AUF {
    return this._auf;
  }

  get corner(): ViewingCorner {
    return this._corner;
  }

  get stickers(): readonly Color[] {
    return this._stickers;
  }

  get distractors(): readonly string[] {
    return this._distractors;
  }

  get answerGiven(): string | null {
    return this._answerGiven;
  }

  get correct(): boolean {
    return this._correct;
  }

  get recognitionTime(): number {
    return this._recognitionTime;
  }

  /**
   * Start the next recognition case. Transitions: idle/review -> presenting.
   * Selects a case via selector, randomizes AUF + corner, gets stickers from cache,
   * picks 5 random distractors.
   */
  async start(): Promise<void> {
    if (this._phase !== "idle" && this._phase !== "review") return;

    // Get stats and build weight list for selector
    const stats = await this.statsStore.getAllStats();
    const statsMap = new Map(stats.map((s) => [s.caseName, s]));

    const weights: PllRecognitionCaseWeight[] = ALL_PLL_CASE_NAMES.map(
      (caseName) => {
        const s = statsMap.get(caseName);
        return {
          caseName,
          attemptCount: s?.attemptCount ?? 0,
          accuracy: s?.accuracy ?? 0,
          avgTime: s?.avgTime ?? 0,
          lastAttemptAt: s?.lastAttemptAt ?? 0,
        };
      },
    );

    const caseName = this.caseSelector.select(weights);
    if (!caseName) return;

    this._currentCase = caseName;

    // Randomize AUF and viewing corner
    this._auf = AUF_OPTIONS[Math.floor(Math.random() * AUF_OPTIONS.length)];
    this._corner =
      VIEWING_CORNERS[Math.floor(Math.random() * VIEWING_CORNERS.length)];

    // Get stickers from cache
    this._stickers = await this.stickerCache.getStickers(
      caseName,
      this._auf,
      this._corner,
    );

    // Pick 5 random distractors (other PLL cases, not the current one)
    this._distractors = pickDistractors(caseName, 5);

    // Reset answer state
    this._answerGiven = null;
    this._correct = false;
    this._recognitionTime = 0;
    this.presentStartTime = Date.now();

    this.setPhase("presenting");
  }

  /**
   * Submit an answer. Transitions: presenting -> review.
   * Stops timer, records attempt via stats store.
   */
  async answer(caseName: string): Promise<void> {
    if (this._phase !== "presenting") return;

    const now = Date.now();
    this._recognitionTime = now - this.presentStartTime;
    this._answerGiven = caseName;
    this._correct = caseName === this._currentCase;

    // Record the attempt
    const attempt: PllRecognitionAttempt = {
      id: crypto.randomUUID(),
      caseName: this._currentCase!,
      viewingCorner: this._corner,
      auf: AUF_OPTIONS.indexOf(this._auf),
      correct: this._correct,
      answerGiven: caseName,
      distractors: [...this._distractors],
      recognitionTime: this._recognitionTime,
      timestamp: now,
    };

    await this.statsStore.recordAttempt(attempt);

    this.setPhase("review");
  }

  /**
   * Move to the next case. Transitions: review -> presenting.
   * Convenience method that calls start().
   */
  async next(): Promise<void> {
    if (this._phase !== "review") return;
    await this.start();
  }

  addPhaseListener(callback: (phase: RecognitionPhase) => void): void {
    this.phaseListeners.add(callback);
  }

  removePhaseListener(callback: (phase: RecognitionPhase) => void): void {
    this.phaseListeners.delete(callback);
  }

  private setPhase(phase: RecognitionPhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}

/**
 * Pick n random distractor case names, excluding the correct case.
 */
function pickDistractors(correctCase: string, count: number): string[] {
  const candidates = ALL_PLL_CASE_NAMES.filter((c) => c !== correctCase);
  const result: string[] = [];

  // Fisher-Yates partial shuffle
  const pool = [...candidates];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    result.push(pool[i]);
  }

  return result;
}
