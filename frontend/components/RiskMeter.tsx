import type { RiskLevel } from "@/lib/types";
import { RISK_LEVEL_COLOR, RISK_LEVEL_ICON } from "@/lib/risk";

// mirrors config.RISK_LEVELS on the backend (score_to_level): LOW <=30, MEDIUM <=60,
// HIGH <=80, CRITICAL <=100 — kept as plain boundary numbers here rather than a shared
// constant since the frontend has no build-time link to the Python config module
const ZONE_BOUNDARIES = [30, 60, 80];

export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  const color = RISK_LEVEL_COLOR[level];
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
          {score.toFixed(1)}
        </span>
        <span className="chip" style={{ color, fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}>
          <span aria-hidden>{RISK_LEVEL_ICON[level]}</span>
          {level}
        </span>
      </div>

      <div
        className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${score.toFixed(1)} — ${level}`}
        style={{ background: "var(--gridline)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
        {/* zone-boundary ticks (30/60/80) so the fill's position reads against the
            same LOW/MEDIUM/HIGH/CRITICAL bands the labels below name */}
        {ZONE_BOUNDARIES.map((b) => (
          <div
            key={b}
            className="absolute top-0 h-full w-px"
            style={{ left: `${b}%`, background: "rgba(255,255,255,0.6)" }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span>0</span>
        <span>30 · MEDIUM</span>
        <span>60 · HIGH</span>
        <span>80 · CRITICAL</span>
        <span>100</span>
      </div>
    </div>
  );
}
