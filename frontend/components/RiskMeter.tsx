import type { RiskLevel } from "@/lib/types";
import { RISK_LEVEL_COLOR, RISK_LEVEL_ICON } from "@/lib/risk";

export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  const color = RISK_LEVEL_COLOR[level];
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-semibold tabular-nums">{score.toFixed(1)}</span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
        >
          <span aria-hidden>{RISK_LEVEL_ICON[level]}</span>
          {level}
        </span>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: "var(--gridline)" }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: "var(--seq-500)" }}
        />
      </div>
      <div
        className="mt-1 flex justify-between text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span>0</span>
        <span>30 · MEDIUM</span>
        <span>60 · HIGH</span>
        <span>80 · CRITICAL</span>
        <span>100</span>
      </div>
    </div>
  );
}
