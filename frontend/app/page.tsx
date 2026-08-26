"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FraudRing, GraphResponse, ModelInfo, PredictionResponse, RecentTransaction } from "@/lib/types";
import { StatTile } from "@/components/StatTile";
import { TransactionForm } from "@/components/TransactionForm";
import { RiskMeter } from "@/components/RiskMeter";
import { RiskFactorList } from "@/components/RiskFactorList";
import { FraudGraph } from "@/components/FraudGraph";
import { RecentTransactionsTable } from "@/components/RecentTransactionsTable";
import { RingsList } from "@/components/RingsList";

export default function Home() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [rings, setRings] = useState<FraudRing[]>([]);
  const [recent, setRecent] = useState<RecentTransaction[]>([]);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
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
    refreshRecent();
    try {
      const g = await api.graph(prediction.transaction_id);
      setGraph(g);
    } catch {
      // transaction has no shared device/IP at all — graph endpoint still works,
      // this only fails if the transaction_id itself is somehow invalid
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">RiskGraph AI</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Risk Intelligence Dashboard — payment fraud scoring, explainability, and fraud-ring
          detection for the Razorpay AI Risk Manager track.
        </p>
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
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              <RiskMeter score={result.score} level={result.risk_level} />
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Risk factors
                </h3>
                <RiskFactorList factors={result.risk_factors} />
              </div>
              {graph && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Entity graph
                  </h3>
                  <FraudGraph graph={graph} focusUserId={result.user_id} />
                </div>
              )}
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
          <h2 className="mb-3 text-sm font-semibold">Detected fraud rings</h2>
          <RingsList rings={rings} loading={loading} />
        </div>
      </section>
    </div>
  );
}
