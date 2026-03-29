// src/features/pll-trainer/PllTrainer.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { usePllTrainer } from "./usePllTrainer";
import { usePllRecognitionTrainer } from "./usePllRecognitionTrainer";
import { PllRecognizeView } from "./PllRecognizeView";
import { KnownPllsModal } from "./KnownPllsModal";
import { PLL_CASES } from "@/core/pll-cases";

interface PllTrainerProps {
  connection: CubeConnection;
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

export function PllTrainer({ connection }: PllTrainerProps) {
  const { status, connect } = useCubeConnection(connection);
  const trainer = usePllTrainer(connection);
  const recognitionTrainer = usePllRecognitionTrainer();

  const isConnected = status === "connected";

  return (
    <div className="space-y-6">
      {/* Connection */}
      {!isConnected && (
        <div className="text-center">
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded bg-blue-600 px-6 py-3 text-lg font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : "Connect Cube"}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-4 border-b border-gray-800 pb-2">
        <TabButton
          label="Drill"
          active={trainer.tab === "drill"}
          onClick={() => trainer.setTab("drill")}
        />
        <TabButton
          label="Learn"
          active={trainer.tab === "learn"}
          onClick={() => trainer.setTab("learn")}
        />
        <TabButton
          label="Recognize"
          active={trainer.tab === "recognize"}
          onClick={() => trainer.setTab("recognize")}
        />
        <button
          onClick={() => trainer.setShowKnownModal(true)}
          className="ml-auto text-gray-400 hover:text-white"
          title="Known PLLs"
        >
          <span className="text-xl">&#9881;</span>
        </button>
      </div>

      {/* Drill mode */}
      {trainer.tab === "drill" && (
        <DrillView
          trainer={trainer}
          isConnected={isConnected}
        />
      )}

      {/* Learn mode */}
      {trainer.tab === "learn" && (
        <LearnView trainer={trainer} />
      )}

      {/* Recognize mode */}
      {trainer.tab === "recognize" && (
        <PllRecognizeView trainer={recognitionTrainer} />
      )}

      {/* Known PLLs modal */}
      <KnownPllsModal
        open={trainer.showKnownModal}
        knownCases={trainer.knownCases}
        onToggle={trainer.toggleKnownCase}
        onClose={() => trainer.setShowKnownModal(false)}
      />
    </div>
  );
}

// --- Sub-components ---

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-b-2 border-blue-500 text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// --- Drill View ---

function DrillView({
  trainer,
  isConnected,
}: {
  trainer: ReturnType<typeof usePllTrainer>;
  isConnected: boolean;
}) {
  const { drillPhase, drillDisplayMs, drillSession, drillStats, startDrill, knownCases } =
    trainer;

  if (knownCases.size === 0) {
    return (
      <div className="text-center text-gray-400">
        <p>No known cases yet. Add some cases via the gear icon, or learn new ones first.</p>
      </div>
    );
  }

  if (drillPhase === "idle") {
    return (
      <div className="text-center">
        <button
          onClick={startDrill}
          disabled={!isConnected}
          className="rounded bg-green-600 px-6 py-3 text-lg font-medium hover:bg-green-500 disabled:opacity-50"
        >
          Start Drill
        </button>
        {!isConnected && (
          <p className="mt-2 text-sm text-gray-500">Connect your cube first</p>
        )}
      </div>
    );
  }

  if (drillPhase === "selecting") {
    return (
      <div className="text-center text-gray-400">
        <p>Selecting case...</p>
      </div>
    );
  }

  if (drillPhase === "scrambling") {
    return (
      <div className="text-center space-y-4">
        <p className="text-gray-400">Apply this scramble:</p>
        <p className="font-mono text-xl">{drillSession.scramble}</p>
        <p className="text-sm text-gray-500">
          The cube state will be verified automatically
        </p>
      </div>
    );
  }

  if (drillPhase === "ready") {
    return (
      <div className="text-center space-y-4">
        <p className="font-mono text-6xl font-bold tabular-nums">0.00</p>
        <p className="text-gray-400">Scramble verified -- start solving!</p>
      </div>
    );
  }

  if (drillPhase === "solving") {
    return (
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {formatTime(drillDisplayMs)}
        </p>
      </div>
    );
  }

  // Review phase
  return (
    <div className="space-y-4 text-center">
      {/* Case name */}
      <h2 className="text-3xl font-bold">{drillSession.currentCase}</h2>

      {/* Time */}
      <p className="font-mono text-5xl font-bold tabular-nums">
        {formatTime(drillSession.duration)}
      </p>

      {/* Stats row */}
      <div className="flex justify-center gap-6 text-sm text-gray-400">
        <span>{drillSession.moveCount} moves</span>
        {drillStats && (
          <>
            <span>avg {formatTime(drillStats.avgTime)}</span>
            <span>best {formatTime(drillStats.bestTime)}</span>
          </>
        )}
      </div>

      {/* 2-look warning */}
      {drillSession.was2Look && (
        <div className="rounded bg-amber-900/50 px-4 py-2 text-amber-300">
          2-look detected -- try to solve this case in one algorithm
        </div>
      )}

      {/* Reference algorithm */}
      {drillSession.currentCase && (
        <div className="text-sm text-gray-500">
          <p className="mb-1">Reference algorithm:</p>
          <p className="font-mono">
            {PLL_CASES[drillSession.currentCase].algorithm}
          </p>
        </div>
      )}

      {/* Next button */}
      <button
        onClick={startDrill}
        className="rounded bg-green-600 px-6 py-3 font-medium hover:bg-green-500"
      >
        Next Scramble
      </button>
    </div>
  );
}

// --- Learn View ---

function LearnView({
  trainer,
}: {
  trainer: ReturnType<typeof usePllTrainer>;
}) {
  const {
    learnPhase,
    learnPosition,
    learnReps,
    learnCompletions,
    learnNeedsUndo,
    learnSession,
    unknownCases,
    startLearnCase,
    startLearnTest,
    addLearnedCaseToKnown,
    resetLearn,
  } = trainer;

  // Case picker
  if (learnPhase === "idle") {
    if (unknownCases.length === 0) {
      return (
        <div className="text-center text-gray-400">
          <p>You know all 21 PLLs! Use drill mode to practice.</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pick a case to learn</h2>
        <div className="flex flex-wrap gap-2">
          {unknownCases.map((name) => (
            <button
              key={name}
              onClick={() => startLearnCase(name)}
              className="rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Practicing
  if (learnPhase === "practicing") {
    const faceMoves = learnSession.faceMoves;
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">{learnSession.caseName}</h2>

        {/* Algorithm with current-move highlighting */}
        <div className="flex flex-wrap justify-center gap-2 font-mono text-xl">
          {faceMoves.map((move, i) => (
            <span
              key={i}
              className={
                i < learnPosition
                  ? "text-green-400"
                  : i === learnPosition
                    ? "rounded bg-green-700 px-1 text-white"
                    : "text-gray-400"
              }
            >
              {move}
            </span>
          ))}
        </div>

        {/* Undo warning */}
        {learnNeedsUndo && (
          <p className="text-amber-400">
            Wrong move! Undo with: <span className="font-mono font-bold">{learnNeedsUndo.join(" ")}</span>
          </p>
        )}

        {/* Rep counter */}
        <p className="text-gray-400">
          Reps: <span className="font-mono">{learnReps}</span>
        </p>

        <div className="flex justify-center gap-4">
          <button
            onClick={startLearnTest}
            className="rounded bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500"
          >
            Ready to Test
          </button>
          <button
            onClick={resetLearn}
            className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Testing
  if (learnPhase === "testing") {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">{learnSession.caseName}</h2>
        <p className="text-gray-500 italic">Algorithm hidden</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full ${
                i < learnCompletions
                  ? "bg-green-500"
                  : i === learnCompletions
                    ? "bg-amber-400"
                    : "bg-gray-600"
              }`}
            />
          ))}
        </div>

        {/* Undo warning */}
        {learnNeedsUndo && (
          <p className="text-amber-400">
            Wrong move! Undo with: <span className="font-mono font-bold">{learnNeedsUndo.join(" ")}</span>
          </p>
        )}

        <button
          onClick={resetLearn}
          className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        >
          Back
        </button>
      </div>
    );
  }

  // Passed
  return (
    <div className="space-y-6 text-center">
      <h2 className="text-2xl font-bold text-green-400">
        {learnSession.caseName} -- Passed!
      </h2>
      <p className="text-gray-400">
        You completed the algorithm 5 times from memory.
      </p>
      <div className="flex justify-center gap-4">
        <button
          onClick={addLearnedCaseToKnown}
          className="rounded bg-green-600 px-6 py-3 font-medium hover:bg-green-500"
        >
          Add to Known List
        </button>
        <button
          onClick={resetLearn}
          className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
