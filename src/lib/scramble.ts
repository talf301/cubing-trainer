import { randomScrambleForEvent } from "cubing/scramble";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";

export interface ScrambleResult {
  scramble: string;
  expectedState: KPattern;
  /** How the scramble was generated. */
  source: "worker" | "fallback-no-module-worker" | "fallback-worker-cached-broken" | "fallback-timeout";
}

/** Standard 3x3 moves with quarter/half turns. */
const MOVES_333 = [
  "U", "U'", "U2", "D", "D'", "D2",
  "R", "R'", "R2", "L", "L'", "L2",
  "F", "F'", "F2", "B", "B'", "B2",
];

/**
 * Generate a random-move scramble (not random-state).
 * Used as a fallback when cubing.js worker-based scramble hangs.
 */
function randomMoveScramble(length = 20): string {
  const moves: string[] = [];
  let lastFace = "";
  let secondLastFace = "";

  for (let i = 0; i < length; i++) {
    let move: string;
    do {
      move = MOVES_333[Math.floor(Math.random() * MOVES_333.length)];
    } while (
      move[0] === lastFace ||
      // Avoid sequences like R L R where opposite faces commute
      (move[0] === secondLastFace && isOppositeFace(move[0], lastFace))
    );
    secondLastFace = lastFace;
    lastFace = move[0];
    moves.push(move);
  }
  return moves.join(" ");
}

function isOppositeFace(a: string, b: string): boolean {
  const pairs: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
  return pairs[a] === b;
}

/**
 * Check if the browser supports module workers, which cubing.js requires
 * for its scramble search worker. iOS WebKit often doesn't support these,
 * causing the scramble promise to hang forever.
 */
let _moduleWorkerSupport: boolean | null = null;
function supportsModuleWorkers(): boolean {
  if (_moduleWorkerSupport !== null) return _moduleWorkerSupport;
  try {
    const blob = new Blob([""], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url, { type: "module" });
    w.terminate();
    URL.revokeObjectURL(url);
    _moduleWorkerSupport = true;
  } catch {
    _moduleWorkerSupport = false;
  }
  return _moduleWorkerSupport;
}

/** Tracks whether the cubing.js worker has ever produced a scramble. */
let workerKnownGood = false;
// Clear cached flag for fresh diagnosis
localStorage.removeItem("scramble-worker-broken");
let workerKnownBad = false;

/** Race scramble generation against a timeout, falling back to random-move scramble. */
export async function generateScramble(): Promise<ScrambleResult> {
  const kpuzzle = await cube3x3x3.kpuzzle();

  let scrambleStr: string;
  let source: ScrambleResult["source"];

  if (!supportsModuleWorkers()) {
    scrambleStr = randomMoveScramble();
    source = "fallback-no-module-worker";
  } else if (workerKnownBad) {
    scrambleStr = randomMoveScramble();
    source = "fallback-worker-cached-broken";
  } else {
    try {
      const scrambleAlg = await Promise.race([
        randomScrambleForEvent("333"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("scramble timeout")),
            workerKnownGood ? 3000 : 8000,
          ),
        ),
      ]);
      scrambleStr = scrambleAlg.toString();
      workerKnownGood = true;
      source = "worker";
    } catch {
      if (!workerKnownGood) {
        workerKnownBad = true;
        localStorage.setItem("scramble-worker-broken", "1");
      }
      scrambleStr = randomMoveScramble();
      source = "fallback-timeout";
    }
  }

  const alg = new Alg(scrambleStr);
  const solved = kpuzzle.defaultPattern();
  const expectedState = solved.applyAlg(alg);

  return { scramble: scrambleStr, expectedState, source };
}
