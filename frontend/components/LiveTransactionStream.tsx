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
    <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Live transaction stream</h2>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ color, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
        >
          <span
            aria-hidden
            className={status === "LIVE" ? "animate-pulse" : undefined}
            style={{ display: "inline-block", width: 6, height: 6, borderRadius: "9999px", background: color }}
          />
          {STATUS_LABEL[status]}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Waiting for live transactions — score one to see it appear here in real time.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {events.map((e) => {
            const highlight = e.risk_level === "HIGH" || e.risk_level === "CRITICAL";
            const levelColor = RISK_LEVEL_COLOR[e.risk_level];
            return (
              <li key={e.transaction_id}>
                <Link
                  href={`/transaction/${e.transaction_id}`}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs hover:opacity-80"
                  style={{
                    borderColor: highlight ? levelColor : "var(--border)",
                    background: highlight
                      ? `color-mix(in srgb, ${levelColor} 10%, var(--surface))`
                      : "var(--surface)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium">#{e.transaction_id}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(e.occurred_at).toLocaleTimeString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span>₹{e.amount.toLocaleString("en-IN")}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      device #{e.device_id} · {e.device_user_count} users
                    </span>
                    <span className="font-semibold" style={{ color: levelColor }}>
                      {e.risk_level} ({e.score.toFixed(1)})
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
