import Link from "next/link";
import type { FraudRing } from "@/lib/types";
import { RISK_LEVEL_COLOR, RISK_LEVEL_ICON } from "@/lib/risk";

export function FraudRingStatusCard({ ring }: { ring: FraudRing | null }) {
  if (!ring) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border p-3 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        <span style={{ color: "var(--status-good)" }} aria-hidden>✓</span> Not part of any detected fraud ring.
      </div>
    );
  }

  const color = RISK_LEVEL_COLOR[ring.risk_level];
  return (
    <div
      className="rounded-md border p-3 text-sm"
      style={{ borderColor: color, borderLeft: `3px solid ${color}`, background: "color-mix(in srgb, currentColor 5%, var(--surface))", color }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="chip" style={{ color }}>
          <span aria-hidden>{RISK_LEVEL_ICON[ring.risk_level]}</span>
          {ring.risk_level} · {ring.risk_score.toFixed(1)}
        </span>
        <Link href="/rings" className="text-xs font-medium hover:underline shrink-0" style={{ color: "var(--seq-500)" }}>
          Full investigation →
        </Link>
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        Part of a detected fraud ring — {ring.users.length} users · {ring.transaction_count} transactions · ₹
        {ring.total_amount.toLocaleString("en-IN")} total
      </p>
    </div>
  );
}
