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
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Transaction</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>User</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Amount</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Risk</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Decision</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Status</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Reason</th>
            <th className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.case_id} className="border-t align-top" style={{ borderColor: "var(--gridline)" }}>
              <td className="px-3 py-2.5 font-mono">
                <Link href={`/transaction/${c.transaction_id}`} className="hover:underline" style={{ color: "var(--seq-500)" }}>
                  #{c.transaction_id}
                </Link>
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums">#{c.user_id}</td>
              <td className="px-3 py-2.5 tabular-nums">₹{c.amount.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2.5">
                <span className="chip" style={{ color: RISK_LEVEL_COLOR[c.risk_level] }}>
                  {c.risk_level} · {c.risk_score.toFixed(1)}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-medium" style={{ color: ACTION_COLOR[c.decision] }}>
                  {c.decision}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span
                  className="chip uppercase"
                  style={{ color: c.status === "open" ? "var(--status-warning)" : "var(--status-good)" }}
                >
                  {c.status}
                </span>
              </td>
              <td className="max-w-xs px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                {c.reason || "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                {new Date(c.updated_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
