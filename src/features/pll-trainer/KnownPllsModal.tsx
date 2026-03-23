// src/features/pll-trainer/KnownPllsModal.tsx
import { PLL_CASES } from "@/core/pll-cases";

const ALL_PLL_NAMES = Object.keys(PLL_CASES);

interface KnownPllsModalProps {
  open: boolean;
  knownCases: Set<string>;
  onToggle: (caseName: string) => void;
  onClose: () => void;
}

export function KnownPllsModal({
  open,
  knownCases,
  onToggle,
  onClose,
}: KnownPllsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-gray-900 p-6">
        <h2 className="mb-4 text-xl font-bold">Known PLLs</h2>
        <p className="mb-4 text-sm text-gray-400">
          Select the PLL cases you already know. These will appear in drill
          mode.
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {ALL_PLL_NAMES.map((name) => {
            const isKnown = knownCases.has(name);
            return (
              <button
                key={name}
                onClick={() => onToggle(name)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  isKnown
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
