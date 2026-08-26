"use client";

import Link from "next/link";
import { useRiskStream, type StreamStatus } from "@/hooks/useRiskStream";
import { RISK_LEVEL_COLOR } from "@/lib/risk";

const STATUS_COLOR: Record<StreamStatus, string> = {
  LIVE: "var(--status-good)",
  RECONNECTING: "var(--status-warning)",
  OFFLINE: "var(--status-critical)",
};

const STATUS_LABEL: Record<StreamStatus, string> = {
  LIVE: "LIVE",
  RECONNECTING: "RECONNECTING",
  OFFLINE: "OFFLINE",
};

export function LiveTransactionStream() {
  const { events, status } = useRiskStream();
  const color = STATUS_COLOR[status];

  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: "var(--border)", borderLeft: `3px solid ${color}`, background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <h2 className="panel-title">Live transaction stream</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {events.length > 0 ? `${events.length} recent` : ""}
          </span>
        </div>
        <span className="chip" style={{ color }}>
          <span
            aria-hidden
            className={status === "LIVE" ? "animate-pulse" : undefined}
            style={{ display: "inline-block", width: 6, height: 6, borderRadius: "9999px", background: color }}
          />
          {STATUS_LABEL[status]}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Waiting for live transactions — score one to see it appear here in real time.
        </p>
      ) : (
        <ul className="thin-scroll max-h-72 overflow-y-auto p-2">
          {events.map((e) => {
            const highlight = e.risk_level === "HIGH" || e.risk_level === "CRITICAL";
            const levelColor = RISK_LEVEL_COLOR[e.risk_level];
            return (
              <li key={e.transaction_id}>
                <Link
                  href={`/transaction/${e.transaction_id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs transition-colors hover:border-current"
                  style={{
                    borderColor: highlight ? levelColor : "transparent",
                    background: highlight
                      ? `color-mix(in srgb, ${levelColor} 8%, var(--surface))`
                      : "transparent",
                    marginBottom: "0.125rem",
                  }}
                >
                  <span className="flex items-center gap-2 font-mono">
                    <span className="font-medium">#{e.transaction_id}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(e.occurred_at).toLocaleTimeString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span>₹{e.amount.toLocaleString("en-IN")}</span>
                    <span className="hidden font-mono sm:inline" style={{ color: "var(--text-secondary)" }}>
                      device #{e.device_id} · {e.device_user_count} users
                    </span>
                    <span className="chip" style={{ color: levelColor }}>
                      {e.risk_level} · {e.score.toFixed(1)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
