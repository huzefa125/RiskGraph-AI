import Link from "next/link";
import type { Case } from "@/lib/types";
import { ACTION_COLOR, RISK_LEVEL_COLOR } from "@/lib/risk";

export function CasesList({ cases }: { cases: Case[] }) {
  if (cases.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No cases in this view.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="pb-2 font-medium">Transaction</th>
            <th className="pb-2 font-medium">User</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Risk</th>
            <th className="pb-2 font-medium">Decision</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Reason</th>
            <th className="pb-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.case_id} className="border-t align-top" style={{ borderColor: "var(--gridline)" }}>
              <td className="py-2">
                <Link href={`/transaction/${c.transaction_id}`} className="hover:underline">
                  #{c.transaction_id}
                </Link>
              </td>
              <td className="py-2 tabular-nums">#{c.user_id}</td>
              <td className="py-2 tabular-nums">₹{c.amount.toLocaleString("en-IN")}</td>
              <td className="py-2">
                <span className="font-medium" style={{ color: RISK_LEVEL_COLOR[c.risk_level] }}>
                  {c.risk_level} ({c.risk_score.toFixed(1)})
                </span>
              </td>
              <td className="py-2">
                <span className="font-medium" style={{ color: ACTION_COLOR[c.decision] }}>
                  {c.decision}
                </span>
              </td>
              <td className="py-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    color: c.status === "open" ? "var(--status-warning)" : "var(--status-good)",
                    background: "color-mix(in srgb, currentColor 14%, transparent)",
                  }}
                >
                  {c.status}
                </span>
              </td>
              <td className="py-2 max-w-xs" style={{ color: "var(--text-secondary)" }}>
                {c.reason || "—"}
              </td>
              <td className="py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {new Date(c.updated_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
