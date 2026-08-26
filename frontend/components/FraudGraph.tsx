import type { GraphResponse } from "@/lib/types";

const NODE_COLOR = {
  user: "var(--series-user)",
  device: "var(--series-device)",
  ip: "var(--series-ip)",
} as const;

const NODE_LABEL = { user: "User", device: "Device", ip: "IP address" } as const;

const SIZE = 320;
const CENTER = SIZE / 2;
const HUB_RADIUS = 46;
const USER_RADIUS = 128;

function layout(nodes: GraphResponse["nodes"]) {
  const hubs = nodes.filter((n) => n.type !== "user");
  const users = nodes.filter((n) => n.type === "user");
  const positions = new Map<string, { x: number; y: number }>();

  hubs.forEach((n, i) => {
    const angle = (i / Math.max(hubs.length, 1)) * 2 * Math.PI - Math.PI / 2;
    positions.set(n.id, {
      x: CENTER + HUB_RADIUS * Math.cos(angle) * (hubs.length > 1 ? 1 : 0),
      y: CENTER + HUB_RADIUS * Math.sin(angle) * (hubs.length > 1 ? 1 : 0),
    });
  });
  users.forEach((n, i) => {
    const angle = (i / Math.max(users.length, 1)) * 2 * Math.PI - Math.PI / 2;
    positions.set(n.id, {
      x: CENTER + USER_RADIUS * Math.cos(angle),
      y: CENTER + USER_RADIUS * Math.sin(angle),
    });
  });
  return positions;
}

export function FraudGraph({ graph }: { graph: GraphResponse }) {
  const positions = layout(graph.nodes);
  const typesPresent = Array.from(new Set(graph.nodes.map((n) => n.type)));

  return (
    <div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-sm"
        role="img"
        aria-label={`Entity graph for transaction ${graph.transaction_id}`}
      >
        {graph.edges.map((e, i) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--gridline)"
              strokeWidth={2}
            />
          );
        })}
        {graph.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={n.type === "user" ? 8 : 11} fill={NODE_COLOR[n.type]}>
                <title>
                  {NODE_LABEL[n.type]}: {n.id}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {typesPresent.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: NODE_COLOR[t] }}
            />
            {NODE_LABEL[t]}
          </li>
        ))}
      </ul>
      {graph.is_potential_ring && (
        <p
          className="mt-2 text-xs font-medium"
          style={{ color: "var(--status-critical)" }}
        >
          ⚠ Multiple users share this device/IP — potential coordinated fraud ring.
        </p>
      )}
    </div>
  );
}
