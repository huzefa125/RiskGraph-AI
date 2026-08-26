import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { RiskMeter } from "@/components/RiskMeter";
import { RiskFactorList } from "@/components/RiskFactorList";
import { FraudGraph } from "@/components/FraudGraph";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transactionId = Number(id);
  if (!Number.isInteger(transactionId)) notFound();

  const [transaction, graph] = await Promise.all([
    api.transaction(transactionId).catch(() => null),
    api.graph(transactionId).catch(() => null),
  ]);

  if (!transaction) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>
        ← Back to dashboard
      </Link>

      <header>
        <h1 className="text-xl font-semibold">Transaction #{transaction.transaction_id}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          User #{transaction.user_id} · ₹{transaction.amount.toLocaleString("en-IN")} ·{" "}
          {transaction.payment_method} · {new Date(transaction.occurred_at).toLocaleString()}
        </p>
      </header>

      <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="text-sm font-semibold">Risk assessment</h2>
        {transaction.risk_level && transaction.score != null ? (
          <div className="mt-4 flex flex-col gap-5">
            <RiskMeter score={transaction.score} level={transaction.risk_level} />
            {transaction.risk_factors && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Risk factors
                </h3>
                <RiskFactorList factors={transaction.risk_factors} />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            This transaction is part of the historical dataset and hasn&apos;t been scored through
            the live prediction path.
          </p>
        )}
      </div>

      {graph && (
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold">Entity graph</h2>
          <FraudGraph graph={graph} />
        </div>
      )}
    </div>
  );
}
