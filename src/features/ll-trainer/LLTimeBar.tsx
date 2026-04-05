// src/features/ll-trainer/LLTimeBar.tsx
import type { LLPracticeCompletion } from "@/core/ll-practice-session";

interface LLTimeBarProps {
  completion: LLPracticeCompletion;
  /** Compact variant for recent attempts log (hides phase totals) */
  compact?: boolean;
}

// Segment colors
const OLL_EXEC_COLOR = "#5b8af5";
const OLL_RECOG_COLOR = "#3b5998";
const PLL_EXEC_COLOR = "#e8922f";
const PLL_RECOG_COLOR = "#7a4a1a";

function formatMs(ms: number): string {
  const seconds = ms / 1000;
  return seconds.toFixed(2);
}

interface BarSegment {
  label: string;
  duration: number;
  color: string;
}

function buildSegments(completion: LLPracticeCompletion): BarSegment[] {
  const segments: BarSegment[] = [];

  for (const seg of completion.ollSegments) {
    if (seg.recognitionTime > 0) {
      segments.push({
        label: "",
        duration: seg.recognitionTime,
        color: OLL_RECOG_COLOR,
      });
    }
    segments.push({
      label: seg.caseName,
      duration: seg.executionTime,
      color: OLL_EXEC_COLOR,
    });
  }

  for (const seg of completion.pllSegments) {
    if (seg.recognitionTime > 0) {
      segments.push({
        label: "",
        duration: seg.recognitionTime,
        color: PLL_RECOG_COLOR,
      });
    }
    segments.push({
      label: seg.caseName,
      duration: seg.executionTime,
      color: PLL_EXEC_COLOR,
    });
  }

  return segments;
}

export function LLTimeBar({ completion, compact = false }: LLTimeBarProps) {
  const segments = buildSegments(completion);
  const totalMs = completion.totalTime;

  if (totalMs === 0) return null;

  const barHeight = compact ? "h-5" : "h-7";
  const fontSize = compact ? "text-[10px]" : "text-xs";

  return (
    <div>
      {/* Segmented bar */}
      <div className={`flex ${barHeight} w-full overflow-hidden rounded`}>
        {segments.map((seg, i) => {
          const widthPct = (seg.duration / totalMs) * 100;
          return (
            <div
              key={i}
              className={`flex items-center justify-center overflow-hidden ${fontSize} font-medium text-white`}
              style={{
                backgroundColor: seg.color,
                width: `${widthPct}%`,
                minWidth: seg.label ? "1.5rem" : undefined,
              }}
              title={`${seg.label || "recog"}: ${formatMs(seg.duration)}s`}
            >
              {seg.label && widthPct > 8 ? (
                <span className="truncate px-0.5">{seg.label}</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Phase totals below bar */}
      {!compact && (
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>
            <span
              className="mr-1 inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: OLL_EXEC_COLOR }}
            />
            OLL {formatMs(completion.ollTime)}s
          </span>
          <span>
            <span
              className="mr-1 inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: PLL_EXEC_COLOR }}
            />
            PLL {formatMs(completion.pllTime)}s
          </span>
          <span className="font-medium text-gray-300">
            Total {formatMs(completion.totalTime)}s
          </span>
        </div>
      )}
    </div>
  );
}
