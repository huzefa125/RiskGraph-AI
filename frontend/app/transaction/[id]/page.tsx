import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Case, FraudRing } from "@/lib/types";
import { TransactionInvestigationPanel } from "@/components/TransactionInvestigationPanel";
import { FraudRingStatusCard } from "@/components/FraudRingStatusCard";
import { FraudGraph } from "@/components/FraudGraph";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transactionId = Number(id);
  if (!Number.isInteger(transactionId)) notFound();

  const [transaction, graph, rings, cases] = await Promise.all([
    api.transaction(transactionId).catch(() => null),
    api.graph(transactionId).catch(() => null),
    api.rings().catch(() => [] as FraudRing[]),
    api.cases().catch(() => [] as Case[]),
  ]);

  if (!transaction) notFound();

  const ring = rings.find((r) => r.transaction_ids.includes(transactionId)) ?? null;
  const caseRecord = cases.find((c) => c.transaction_id === transactionId) ?? null;
  const isScored =
    transaction.risk_level != null && transaction.score != null && transaction.recommended_action != null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>
        ← Back to dashboard
      </Link>

      {isScored ? (
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <TransactionInvestigationPanel
            transaction={transaction}
            score={transaction.score!}
            riskLevel={transaction.risk_level!}
            recommendedAction={transaction.recommended_action!}
            riskFactors={transaction.risk_factors ?? []}
            graph={graph}
            ring={ring}
            caseRecord={caseRecord}
          />
        </div>
      ) : (
        <>
          <header>
            <h1 className="text-xl font-semibold">Transaction #{transaction.transaction_id}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              User #{transaction.user_id} · ₹{transaction.amount.toLocaleString("en-IN")} ·{" "}
              {transaction.payment_method} · {new Date(transaction.occurred_at).toLocaleString()}
            </p>
          </header>

          <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="text-sm font-semibold">Risk assessment</h2>
            <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              This transaction is part of the historical dataset and hasn&apos;t been scored through
              the live prediction path.
            </p>
          </div>

          <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="mb-3 text-sm font-semibold">Fraud-ring status</h2>
            <FraudRingStatusCard ring={ring} />
          </div>

          {graph && (
            <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h2 className="mb-3 text-sm font-semibold">Entity graph</h2>
              <FraudGraph graph={graph} focusUserId={transaction.user_id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
