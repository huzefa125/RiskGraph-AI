"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Case, FraudRing, GraphResponse, ModelInfo, PredictionResponse, RecentTransaction } from "@/lib/types";
import { StatTile } from "@/components/StatTile";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionInvestigationPanel } from "@/components/TransactionInvestigationPanel";
import { RecentTransactionsTable } from "@/components/RecentTransactionsTable";
import { RingsList } from "@/components/RingsList";
import { LiveTransactionStream } from "@/components/LiveTransactionStream";

export default function Home() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [rings, setRings] = useState<FraudRing[]>([]);
  const [recent, setRecent] = useState<RecentTransaction[]>([]);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [transactionDetail, setTransactionDetail] = useState<RecentTransaction | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [resultRing, setResultRing] = useState<FraudRing | null>(null);
  const [resultCase, setResultCase] = useState<Case | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshRecent = useCallback(() => {
    api.recentTransactions(10).then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([api.modelInfo(), api.rings(), api.recentTransactions(10)])
      .then(([info, ringsData, recentData]) => {
        setModelInfo(info);
        setRings(ringsData);
        setRecent(recentData);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to reach the API"))
      .finally(() => setLoading(false));
  }, []);

  async function handleResult(prediction: PredictionResponse) {
    setResult(prediction);
    setGraph(null);
    setTransactionDetail(null);
    setResultRing(null);
    setResultCase(null);
    refreshRecent();

    // reuses the same existing endpoints the rest of the app already uses —
    // Promise.allSettled so one endpoint failing doesn't blank out the others
    const [graphResult, txnResult, ringsResult, casesResult] = await Promise.allSettled([
      api.graph(prediction.transaction_id),
      api.transaction(prediction.transaction_id),
      api.rings(),
      api.cases(),
    ]);
    if (graphResult.status === "fulfilled") setGraph(graphResult.value);
    if (txnResult.status === "fulfilled") setTransactionDetail(txnResult.value);
    if (ringsResult.status === "fulfilled") {
      setResultRing(ringsResult.value.find((r) => r.transaction_ids.includes(prediction.transaction_id)) ?? null);
    }
    if (casesResult.status === "fulfilled") {
      setResultCase(casesResult.value.find((c) => c.transaction_id === prediction.transaction_id) ?? null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">RiskGraph AI</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Risk Intelligence Dashboard — payment fraud scoring, explainability, and
              fraud-ring detection for the Razorpay AI Risk Manager track.
            </p>
          </div>
          <Link
            href="/cases"
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:underline"
            style={{ borderColor: "var(--border)" }}
          >
            Cases &amp; Review →
          </Link>
        </div>
      </header>

      {loadError && (
        <p
          className="rounded-md border p-3 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          Couldn&apos;t reach the API at {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
          — is the FastAPI server running? ({loadError})
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Model"
          value={modelInfo?.model_name ?? "—"}
          caption="chosen by validation F1"
          loading={loading}
        />
        <StatTile
          label="Test ROC-AUC"
          value={modelInfo ? modelInfo.test_metrics.roc_auc.toFixed(2) : "—"}
          caption="held-out set"
          loading={loading}
        />
        <StatTile
          label="Test precision / recall"
          value={
            modelInfo
              ? `${modelInfo.test_metrics.precision.toFixed(2)} / ${modelInfo.test_metrics.recall.toFixed(2)}`
              : "—"
          }
          loading={loading}
        />
        <StatTile
          label="Fraud rings detected"
          value={String(rings.length)}
          caption="shared device/IP, 3+ users"
          loading={loading}
        />
      </section>

      <LiveTransactionStream />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold">Score a transaction</h2>
          <p className="mt-1 mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            Prefilled with a high-risk example — edit and submit to see the model react.
          </p>
          <TransactionForm onResult={handleResult} />
        </div>

        <div className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold">Result</h2>
          {!result ? (
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              Submit a transaction to see its risk score, explanation, and entity graph.
            </p>
          ) : !transactionDetail ? (
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              Loading full investigation details…
            </p>
          ) : (
            <div className="mt-4">
              <TransactionInvestigationPanel
                transaction={transactionDetail}
                score={result.score}
                riskLevel={result.risk_level}
                recommendedAction={result.recommended_action}
                riskFactors={result.risk_factors}
                graph={graph}
                ring={resultRing}
                caseRecord={resultCase}
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold">Recent transactions</h2>
          <RecentTransactionsTable rows={recent} loading={loading} />
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Detected fraud rings</h2>
            <Link href="/rings" className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
              Full investigation view →
            </Link>
          </div>
          <RingsList rings={rings} loading={loading} />
        </div>
      </section>
    </div>
  );
}
