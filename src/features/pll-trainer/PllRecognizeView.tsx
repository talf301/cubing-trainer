// src/features/pll-trainer/PllRecognizeView.tsx
import { useState } from "react";
import { PllCaseViewer, type VisibleSides } from "./PllCaseViewer";
import { OverheadPllDiagram } from "./OverheadPllDiagram";
import type { usePllRecognitionTrainer } from "./usePllRecognitionTrainer";

const STORAGE_KEY = "pll-recognition-visible-sides";

function loadVisibleSides(): VisibleSides {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "2" || stored === "3" || stored === "4") return Number(stored) as VisibleSides;
  return 2;
}

interface PllRecognizeViewProps {
  trainer: ReturnType<typeof usePllRecognitionTrainer>;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function PllRecognizeView({ trainer }: PllRecognizeViewProps) {
  const {
    phase,
    options,
    currentCase,
    auf,
    corner,
    answerGiven,
    correct,
    recognitionTime,
    overheadStickers,
    start,
    answer,
    next,
  } = trainer;

  const [visibleSides, setVisibleSides] = useState<VisibleSides>(loadVisibleSides);

  function changeVisibleSides(n: VisibleSides) {
    setVisibleSides(n);
    localStorage.setItem(STORAGE_KEY, String(n));
  }

  // Idle phase
  if (phase === "idle") {
    return (
      <div className="space-y-6 text-center">
        {/* Visible sides selector */}
        <SidesSelector value={visibleSides} onChange={changeVisibleSides} />

        <button
          onClick={start}
          className="rounded bg-green-600 px-6 py-3 text-lg font-medium hover:bg-green-500"
        >
          Start Recognition
        </button>
      </div>
    );
  }

  // Presenting phase: 3D cube viewer + answer grid
  if (phase === "presenting") {
    return (
      <div className="space-y-8 text-center">
        {/* 3D cube viewer */}
        <div className="flex justify-center">
          {currentCase && (
            <PllCaseViewer
              caseName={currentCase}
              auf={auf}
              corner={corner}
              visibleSides={visibleSides}
              size={240}
            />
          )}
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

  // Review phase
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

function SidesSelector({
  value,
  onChange,
}: {
  value: VisibleSides;
  onChange: (n: VisibleSides) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-sm text-gray-400">Visible sides</span>
      {([2, 3, 4] as VisibleSides[]).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`rounded px-3 py-1 text-sm font-medium transition ${
            n === value
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
