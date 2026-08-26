import type { FraudRing } from "@/lib/types";
import { RISK_LEVEL_COLOR, RISK_LEVEL_ICON } from "@/lib/risk";

export function RingsList({ rings, loading }: { rings: FraudRing[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
      </div>
    );
  }

  if (rings.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No coordinated fraud rings detected in the current dataset.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rings.map((ring, i) => {
        const color = RISK_LEVEL_COLOR[ring.risk_level];
        return (
          <li
            key={i}
            className="rounded-md border p-3 text-sm"
            style={{ borderColor: "var(--border)", borderLeft: `3px solid ${color}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                Ring #{i + 1} <span style={{ color: "var(--text-muted)" }}>— {ring.users.length} users</span>
              </span>
              <span className="chip shrink-0" style={{ color }}>
                <span aria-hidden>{RISK_LEVEL_ICON[ring.risk_level]}</span>
                {ring.risk_level}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
              {ring.users.map((u) => u.replace("user:", "#")).join(", ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
