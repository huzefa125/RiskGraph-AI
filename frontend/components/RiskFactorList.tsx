import type { RiskFactor } from "@/lib/types";

export function RiskFactorList({ factors }: { factors: RiskFactor[] }) {
  if (factors.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No elevated risk factors — this transaction looks like normal behavior for this user.
      </p>
    );
  }

  const max = Math.max(...factors.map((f) => f.contribution));

  return (
    <ul className="flex flex-col gap-2">
      {factors.map((f) => (
        <li key={f.feature}>
          <div className="flex items-baseline justify-between text-sm">
            <span>{f.description}</span>
            <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {f.contribution.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: "var(--gridline)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(f.contribution / max) * 100}%`,
                background: "var(--seq-400)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
