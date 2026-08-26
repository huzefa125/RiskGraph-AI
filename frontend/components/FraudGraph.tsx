"use client";

import { useMemo, useState } from "react";
import type { GraphNode, GraphResponse } from "@/lib/types";

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

function layout(nodes: GraphNode[]) {
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

function buildAdjacency(graph: GraphResponse) {
  const neighbors = new Map<string, Set<string>>();
  for (const n of graph.nodes) neighbors.set(n.id, new Set());
  for (const e of graph.edges) {
    neighbors.get(e.source)?.add(e.target);
    neighbors.get(e.target)?.add(e.source);
  }
  return neighbors;
}

function label(id: string) {
  const [, value] = id.split(":");
  return value;
}

export function FraudGraph({
  graph,
  focusUserId,
}: {
  graph: GraphResponse;
  focusUserId?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positions = useMemo(() => layout(graph.nodes), [graph.nodes]);
  const neighbors = useMemo(() => buildAdjacency(graph), [graph]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const typesPresent = Array.from(new Set(graph.nodes.map((n) => n.type)));
  const focusId = focusUserId != null ? `user:${focusUserId}` : null;

  const selected = selectedId ? nodeById.get(selectedId) : null;
  const selectedNeighborIds = selectedId ? Array.from(neighbors.get(selectedId) ?? []) : [];

  // for a selected user: which OTHER users share a hub (device/IP) with them
  const coUsers = new Set<string>();
  if (selected?.type === "user") {
    for (const hubId of selectedNeighborIds) {
      for (const other of neighbors.get(hubId) ?? []) {
        if (other !== selectedId) coUsers.add(other);
      }
    }
  }
  const hubUserCount = selected && selected.type !== "user" ? selectedNeighborIds.length : 0;

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
          const dimmed = selectedId != null && e.source !== selectedId && e.target !== selectedId;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--gridline)"
              strokeWidth={2}
              opacity={dimmed ? 0.35 : 1}
            />
          );
        })}
        {graph.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const isFocus = n.id === focusId;
          const isSelected = n.id === selectedId;
          const isSharedHub = n.type !== "user" && (neighbors.get(n.id)?.size ?? 0) >= 2;
          const baseRadius = n.type === "user" ? 8 : 11;
          return (
            <g
              key={n.id}
              onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
              tabIndex={0}
              role="button"
              aria-label={`${NODE_LABEL[n.type]} ${label(n.id)}${isFocus ? " (investigated user)" : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(n.id === selectedId ? null : n.id);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              {/* no <title> element here on purpose: React's SSR special-cases that tag
                  name (it assumes document <title>) and renders it empty, causing a
                  hydration mismatch on this page. aria-label covers accessibility, and the
                  click-to-select detail panel below already shows richer info than a hover
                  tooltip would. */}
              {isFocus && (
                <circle cx={p.x} cy={p.y} r={baseRadius + 6} fill="none" stroke="var(--foreground)" strokeWidth={2} />
              )}
              {isSharedHub && (
                <circle cx={p.x} cy={p.y} r={baseRadius + 4} fill="none" stroke="var(--status-critical)" strokeWidth={2} />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={baseRadius}
                fill={NODE_COLOR[n.type]}
                stroke={isSelected ? "var(--foreground)" : "none"}
                strokeWidth={isSelected ? 3 : 0}
              />
            </g>
          );
        })}
      </svg>

      <ul className="mt-2 flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {typesPresent.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLOR[t] }} />
            {NODE_LABEL[t]}
          </li>
        ))}
        {focusId && nodeById.has(focusId) && (
          <li className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border-2"
              style={{ borderColor: "var(--foreground)", background: "transparent" }}
            />
            Investigated user
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: "var(--status-critical)", background: "transparent" }}
          />
          Shared (suspicious)
        </li>
      </ul>

      {graph.is_potential_ring && (
        <p className="mt-2 text-xs font-medium" style={{ color: "var(--status-critical)" }}>
          ⚠ Multiple users share this device/IP — potential coordinated fraud ring.
        </p>
      )}

      {selected && (
        <div
          className="mt-3 rounded-md border p-3 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {NODE_LABEL[selected.type]} {label(selected.id)}
              {selected.id === focusId && " — investigated user"}
            </span>
            <button
              onClick={() => setSelectedId(null)}
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close detail panel"
            >
              ✕
            </button>
          </div>

          {selected.type === "user" ? (
            coUsers.size > 0 ? (
              <p className="mt-1.5" style={{ color: "var(--text-secondary)" }}>
                Shares a device or IP with {coUsers.size} other user{coUsers.size > 1 ? "s" : ""}:{" "}
                {Array.from(coUsers).map((u) => `#${label(u)}`).join(", ")}
              </p>
            ) : (
              <p className="mt-1.5" style={{ color: "var(--text-secondary)" }}>
                No shared devices or IPs with other users in this graph.
              </p>
            )
          ) : (
            <p className="mt-1.5" style={{ color: "var(--text-secondary)" }}>
              Used by {hubUserCount} user{hubUserCount === 1 ? "" : "s"} in this graph
              {hubUserCount >= 2 ? " — shared across multiple users is the coordinated-fraud signal." : "."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
