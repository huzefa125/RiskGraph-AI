import Link from "next/link";
import type { RecentTransaction } from "@/lib/types";
import { RISK_LEVEL_COLOR } from "@/lib/risk";

export function RecentTransactionsTable({ rows }: { rows: RecentTransaction[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="pb-2 font-medium">ID</th>
            <th className="pb-2 font-medium">User</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Method</th>
            <th className="pb-2 font-medium">When</th>
            <th className="pb-2 font-medium">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.transaction_id} className="border-t" style={{ borderColor: "var(--gridline)" }}>
              <td className="py-2">
                <Link href={`/transaction/${r.transaction_id}`} className="hover:underline">
                  #{r.transaction_id}
                </Link>
              </td>
              <td className="py-2 tabular-nums">{r.user_id}</td>
              <td className="py-2 tabular-nums">₹{r.amount.toLocaleString("en-IN")}</td>
              <td className="py-2">{r.payment_method}</td>
              <td className="py-2" style={{ color: "var(--text-secondary)" }}>
                {new Date(r.occurred_at).toLocaleString()}
              </td>
              <td className="py-2">
                {r.risk_level ? (
                  <span className="font-medium" style={{ color: RISK_LEVEL_COLOR[r.risk_level] }}>
                    {r.risk_level} ({r.score?.toFixed(1)})
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>not scored</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
