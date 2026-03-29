// src/features/pll-trainer/PllRecognizeView.tsx
import { CornerView } from "./CornerView";
import { OverheadPllDiagram } from "./OverheadPllDiagram";
import type { usePllRecognitionTrainer } from "./usePllRecognitionTrainer";

interface PllRecognizeViewProps {
  trainer: ReturnType<typeof usePllRecognitionTrainer>;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function PllRecognizeView({ trainer }: PllRecognizeViewProps) {
  const {
    phase,
    stickers,
    options,
    currentCase,
    answerGiven,
    correct,
    recognitionTime,
    overheadStickers,
    start,
    answer,
    next,
  } = trainer;

  // Idle phase
  if (phase === "idle") {
    return (
      <div className="text-center">
        <button
          onClick={start}
          className="rounded bg-green-600 px-6 py-3 text-lg font-medium hover:bg-green-500"
        >
          Start Recognition
        </button>
      </div>
    );
  }

  // Presenting phase: large CornerView + 3x2 answer grid
  if (phase === "presenting") {
    return (
      <div className="space-y-8 text-center">
        {/* Large corner view */}
        <div className="flex justify-center">
          <CornerView stickers={stickers} size={240} />
        </div>

        {/* 3x2 answer grid */}
        <div className="grid grid-cols-3 gap-3 mx-auto max-w-md">
          {options.map((caseName) => (
            <button
              key={caseName}
              onClick={() => answer(caseName)}
              className="rounded bg-gray-700 px-4 py-3 text-sm font-medium hover:bg-gray-600 transition"
            >
              {caseName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Review phase: correct/wrong indicator + case name + OverheadPllDiagram + Next
  return (
    <div className="space-y-6 text-center">
      {/* Correct / Wrong indicator */}
      {correct ? (
        <div className="text-3xl font-bold text-green-400">Correct!</div>
      ) : (
        <div className="space-y-1">
          <div className="text-3xl font-bold text-red-400">Wrong</div>
          <p className="text-gray-400">
            You answered <span className="font-mono">{answerGiven}</span>
          </p>
        </div>
      )}

      {/* Case name */}
      <h2 className="text-2xl font-bold">{currentCase}</h2>

      {/* Recognition time */}
      <p className="font-mono text-lg text-gray-400">
        {formatTime(recognitionTime)}s
      </p>

      {/* Overhead PLL diagram */}
      {overheadStickers && (
        <div className="flex justify-center">
          <OverheadPllDiagram stickers={overheadStickers} size={160} />
        </div>
      )}

      {/* Next / Skip button */}
      {correct ? (
        <button
          onClick={next}
          className="rounded bg-gray-700 px-6 py-3 font-medium hover:bg-gray-600 transition"
        >
          Skip (auto-advancing...)
        </button>
      ) : (
        <button
          onClick={next}
          className="rounded bg-green-600 px-6 py-3 font-medium hover:bg-green-500 transition"
        >
          Next
        </button>
      )}
    </div>
  );
}
