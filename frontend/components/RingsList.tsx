import type { FraudRing } from "@/lib/types";

export function RingsList({ rings, loading }: { rings: FraudRing[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 w-full animate-pulse rounded-md" style={{ background: "var(--gridline)" }} />
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
      {rings.map((ring, i) => (
        <li
          key={i}
          className="rounded-md border p-3 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium" style={{ color: "var(--status-critical)" }}>
              Ring #{i + 1} — {ring.users.length} users
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {ring.component_size} nodes total
            </span>
          </div>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            {ring.users.map((u) => u.replace("user:", "#")).join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
