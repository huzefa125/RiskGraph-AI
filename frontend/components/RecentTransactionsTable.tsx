import Link from "next/link";
import type { RecentTransaction } from "@/lib/types";
import { RISK_LEVEL_COLOR } from "@/lib/risk";

// short, fixed-format timestamp — keeps the row compact and, since this table is only
// ever populated client-side after a loading state (never present in the initial SSR
// pass), there's no server/client locale hydration risk here to worry about
function shortWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function RecentTransactionsTable({
  rows,
  loading,
}: {
  rows: RecentTransaction[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-6 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="thin-scroll max-h-80 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
          <tr className="text-left" style={{ color: "var(--text-muted)" }}>
            <th className="border-b px-2 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Transaction</th>
            <th className="border-b px-2 py-2 font-medium" style={{ borderColor: "var(--border)" }}>User</th>
            <th className="border-b px-2 py-2 font-medium" style={{ borderColor: "var(--border)" }}>Amount</th>
            <th className="border-b px-2 py-2 text-right font-medium" style={{ borderColor: "var(--border)" }}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.transaction_id} className="border-t" style={{ borderColor: "var(--gridline)" }}>
              <td className="px-2 py-2">
                <Link
                  href={`/transaction/${r.transaction_id}`}
                  className="font-mono font-medium hover:underline"
                  style={{ color: "var(--seq-500)" }}
                >
                  #{r.transaction_id}
                </Link>
                <div className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {shortWhen(r.occurred_at)}
                </div>
              </td>
              <td className="px-2 py-2 font-mono tabular-nums">#{r.user_id}</td>
              <td className="px-2 py-2">
                <div className="tabular-nums">₹{r.amount.toLocaleString("en-IN")}</div>
                <div className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{r.payment_method}</div>
              </td>
              <td className="px-2 py-2 text-right">
                {r.risk_level ? (
                  <span className="chip" style={{ color: RISK_LEVEL_COLOR[r.risk_level] }}>
                    {r.risk_level} · {r.score?.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>not scored</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
