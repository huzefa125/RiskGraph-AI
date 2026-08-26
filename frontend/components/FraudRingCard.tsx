"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { FraudRing, GraphResponse } from "@/lib/types";
import { RISK_LEVEL_COLOR, RISK_LEVEL_ICON } from "@/lib/risk";
import { FraudGraph } from "@/components/FraudGraph";

function entityLabel(id: string) {
  const [, value] = id.split(":");
  return value;
}

const MAX_VISIBLE_TRANSACTIONS = 12;

export function FraudRingCard({ ring, index }: { ring: FraudRing; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const color = RISK_LEVEL_COLOR[ring.risk_level];

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (graph || ring.representative_transaction_id == null) return;
    setLoadingGraph(true);
    setGraphError(null);
    try {
      const g = await api.graph(ring.representative_transaction_id);
      setGraph(g);
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : "Failed to load entity graph");
    } finally {
      setLoadingGraph(false);
    }
  }

  const visibleTxns = ring.transaction_ids.slice(0, MAX_VISIBLE_TRANSACTIONS);
  const hiddenCount = ring.transaction_ids.length - visibleTxns.length;

  return (
    <div
      className="rounded-lg border p-4 sm:p-5"
      style={{ borderColor: "var(--border)", borderLeft: `3px solid ${color}`, background: "var(--surface)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="panel-title">Ring #{index + 1}</span>
            <span className="chip" style={{ color }}>
              <span aria-hidden>{RISK_LEVEL_ICON[ring.risk_level]}</span>
              {ring.risk_level} · {ring.risk_score.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {ring.users.length} users · {ring.component_size} entities in graph
          </p>
        </div>
        <button onClick={handleToggle} className="btn btn-outline shrink-0 px-3 py-1.5 text-xs">
          {expanded ? "Hide graph" : "Inspect entity graph"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div>
          <div className="eyebrow">Transactions</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">{ring.transaction_count}</div>
        </div>
        <div>
          <div className="eyebrow">Total amount</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            ₹{ring.total_amount.toLocaleString("en-IN")}
          </div>
        </div>
        <div>
          <div className="eyebrow">Shared devices</div>
          <div className="mt-0.5 font-mono text-sm">
            {ring.devices.length > 0 ? ring.devices.map(entityLabel).join(", ") : "—"}
          </div>
        </div>
        <div>
          <div className="eyebrow">Shared IPs</div>
          <div className="mt-0.5 font-mono text-sm">
            {ring.ips.length > 0 ? ring.ips.map(entityLabel).join(", ") : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2" style={{ borderColor: "var(--gridline)" }}>
        <div>
          <div className="eyebrow">Users involved</div>
          <p className="mt-0.5 font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
            {ring.users.map((u) => `#${entityLabel(u)}`).join(", ")}
          </p>
        </div>

        <div>
          <div className="eyebrow">Connected transactions</div>
          <p className="mt-0.5 flex flex-wrap gap-x-1 font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
            {visibleTxns.map((tid, i) => (
              <span key={tid}>
                <Link href={`/transaction/${tid}`} className="hover:underline" style={{ color: "var(--seq-500)" }}>
                  #{tid}
                </Link>
                {i < visibleTxns.length - 1 ? "," : ""}
              </span>
            ))}
            {hiddenCount > 0 && <span style={{ color: "var(--text-muted)" }}>+{hiddenCount} more</span>}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--gridline)" }}>
          {loadingGraph && (
            <div className="skeleton h-48 w-full max-w-sm" />
          )}
          {graphError && (
            <p className="text-sm" style={{ color: "var(--status-critical)" }}>
              {graphError}
            </p>
          )}
          {graph && <FraudGraph graph={graph} />}
        </div>
      )}
    </div>
  );
}
