import type { Case, FraudRing, GraphResponse, RecommendedAction, RiskFactor, RiskLevel } from "@/lib/types";
import { RiskMeter } from "@/components/RiskMeter";
import { RiskFactorList } from "@/components/RiskFactorList";
import { FraudGraph } from "@/components/FraudGraph";
import { RecommendedActionBadge } from "@/components/RecommendedActionBadge";
import { ConnectedEntitiesSummary } from "@/components/ConnectedEntitiesSummary";
import { FraudRingStatusCard } from "@/components/FraudRingStatusCard";
import { CaseDecisionForm } from "@/components/CaseDecisionForm";

interface TransactionSummary {
  transaction_id: number;
  user_id: number;
  amount: number;
  payment_method: string;
  occurred_at: string;
}

export function TransactionInvestigationPanel({
  transaction,
  score,
  riskLevel,
  recommendedAction,
  riskFactors,
  graph,
  ring,
  caseRecord,
}: {
  transaction: TransactionSummary;
  score: number;
  riskLevel: RiskLevel;
  recommendedAction: RecommendedAction;
  riskFactors: RiskFactor[];
  graph: GraphResponse | null;
  ring: FraudRing | null;
  caseRecord: Case | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold">Transaction #{transaction.transaction_id}</h2>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          User #{transaction.user_id} · ₹{transaction.amount.toLocaleString("en-IN")} ·{" "}
          {transaction.payment_method} · {new Date(transaction.occurred_at).toLocaleString()}
        </p>
      </div>

      <RecommendedActionBadge action={recommendedAction} />

      <RiskMeter score={score} level={riskLevel} />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Risk factors
        </h3>
        <RiskFactorList factors={riskFactors} />
      </div>

      {graph && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Connected entities
          </h3>
          <ConnectedEntitiesSummary graph={graph} focusUserId={transaction.user_id} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Fraud-ring status
        </h3>
        <FraudRingStatusCard ring={ring} />
      </div>

      {graph && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Entity graph
          </h3>
          <FraudGraph graph={graph} focusUserId={transaction.user_id} />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Analyst decision
        </h3>
        <CaseDecisionForm transactionId={transaction.transaction_id} initialCase={caseRecord} />
      </div>
    </div>
  );
}
