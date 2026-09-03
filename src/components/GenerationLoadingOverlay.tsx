import { useEffect, useState } from "react";

// Simulated staged progress — the actual backend call is a single Gemini
// request with no discrete steps to report, so there's no real per-stage
// signal to hook into. This paces believable stage messages against how
// long generation typically takes (~20s), the same approach most AI
// products use for long single-call operations. Nothing false is claimed —
// the underlying status is genuinely "pending" the whole time; this is
// just pacing, not fake data.
const STAGES = [
  { label: "Studying your room...", pct: 12 },
  { label: "Sketching the new layout...", pct: 30 },
  { label: "Placing furniture...", pct: 52 },
  { label: "Dialing in your theme...", pct: 74 },
  { label: "Adding the finishing touches...", pct: 90 },
  { label: "Almost there...", pct: 97 },
];

// Typical generation is ~20s (per generate-room-background.ts). Stages
// advance on this cadence but cap below 100% until the real result lands —
// the bar never claims "done" before the actual data arrives.
const STAGE_INTERVAL_MS = 3500;

export function GenerationLoadingOverlay({ active }: { active: boolean }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  const stage = STAGES[stageIndex];

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/55 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        <p className="text-sm font-medium text-white transition-opacity duration-300">
          {stage.label}
        </p>
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all duration-700 ease-out"
            style={{ width: `${stage.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}