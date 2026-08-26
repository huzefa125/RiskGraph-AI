import type { RiskFactor } from "@/lib/types";

// device_user_count / ip_user_count come from the NetworkX shared-entity graph;
// everything else is a plain transaction/user feature the XGBoost model saw directly.
const GRAPH_FEATURES = new Set(["device_user_count", "ip_user_count"]);

function FactorBar({ factor, max }: { factor: RiskFactor; max: number }) {
  return (
    <li>
      <div className="flex items-baseline justify-between text-sm">
        <span>{factor.description}</span>
        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {factor.contribution.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: "var(--gridline)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${(factor.contribution / max) * 100}%`,
            background: GRAPH_FEATURES.has(factor.feature) ? "var(--series-device)" : "var(--seq-400)",
          }}
        />
      </div>
    </li>
  );
}

export function RiskFactorList({ factors }: { factors: RiskFactor[] }) {
  if (factors.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No elevated risk factors — this transaction looks like normal behavior for this user.
      </p>
    );
  }

  const max = Math.max(...factors.map((f) => f.contribution));
  const modelFactors = factors.filter((f) => !GRAPH_FEATURES.has(f.feature));
  const graphFactors = factors.filter((f) => GRAPH_FEATURES.has(f.feature));

  return (
    <div className="flex flex-col gap-4">
      {modelFactors.length > 0 && (
        <div>
          <h4
            className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--seq-400)" }}
            />
            Model evidence
          </h4>
          <ul className="flex flex-col gap-2">
            {modelFactors.map((f) => (
              <FactorBar key={f.feature} factor={f} max={max} />
            ))}
          </ul>
        </div>
      )}
      {graphFactors.length > 0 && (
        <div>
          <h4
            className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--series-device)" }}
            />
            Graph evidence
          </h4>
          <ul className="flex flex-col gap-2">
            {graphFactors.map((f) => (
              <FactorBar key={f.feature} factor={f} max={max} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
