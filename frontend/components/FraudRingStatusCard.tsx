import Link from "next/link";
import type { FraudRing } from "@/lib/types";
import { RISK_LEVEL_COLOR, RISK_LEVEL_ICON } from "@/lib/risk";

export function FraudRingStatusCard({ ring }: { ring: FraudRing | null }) {
  if (!ring) {
    return (
      <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--status-good)" }}>✓</span> Not part of any detected fraud ring.
      </div>
    );
  }

  const color = RISK_LEVEL_COLOR[ring.risk_level];
  return (
    <div className="rounded-md border p-3 text-sm" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color }}>
          <span aria-hidden>{RISK_LEVEL_ICON[ring.risk_level]}</span> Part of a detected fraud ring —{" "}
          {ring.risk_level} ({ring.risk_score.toFixed(1)})
        </span>
        <Link href="/rings" className="text-xs hover:underline shrink-0" style={{ color: "var(--text-secondary)" }}>
          Full investigation →
        </Link>
      </div>
      <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
        {ring.users.length} users · {ring.transaction_count} transactions · ₹
        {ring.total_amount.toLocaleString("en-IN")} total
      </p>
    </div>
  );
}
