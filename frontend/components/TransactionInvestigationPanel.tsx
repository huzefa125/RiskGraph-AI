"use client";

import { useState } from "react";
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

const TABS = ["Risk factors", "Network", "Decision"] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = useState<Tab>("Risk factors");

  return (
    <div className="flex flex-col gap-5">
      {/* always-visible summary: the score, level and recommended action are the single
          most important facts here, so they stay above the fold regardless of which tab
          is open rather than being buried in "Risk factors" */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="panel-title">Transaction #{transaction.transaction_id}</h2>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {new Date(transaction.occurred_at).toLocaleString("en-IN")}
          </span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          User #{transaction.user_id} · ₹{transaction.amount.toLocaleString("en-IN")} · {transaction.payment_method}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <RecommendedActionBadge action={recommendedAction} />
        <RiskMeter score={score} level={riskLevel} />
      </div>

      <div>
        <div className="tab-strip" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              data-active={tab === t}
              className="tab-item"
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Network" && ring && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: "var(--status-critical)" }}
                  aria-hidden
                  title="Part of a detected fraud ring"
                />
              )}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "Risk factors" && <RiskFactorList factors={riskFactors} />}

          {tab === "Network" && (
            <div className="flex flex-col gap-4">
              {graph && <ConnectedEntitiesSummary graph={graph} focusUserId={transaction.user_id} />}
              <FraudRingStatusCard ring={ring} />
              {graph && (
                <div>
                  <h3 className="eyebrow mb-2">Entity graph</h3>
                  <FraudGraph graph={graph} focusUserId={transaction.user_id} />
                </div>
              )}
            </div>
          )}

          {tab === "Decision" && (
            <CaseDecisionForm transactionId={transaction.transaction_id} initialCase={caseRecord} />
          )}
        </div>
      </div>
    </div>
  );
}
