import type {
  Case,
  CaseDecisionInput,
  CaseStatus,
  FraudRing,
  GraphResponse,
  ModelInfo,
  PredictionResponse,
  RecentTransaction,
  TransactionInput,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  predict: (input: TransactionInput) =>
    request<PredictionResponse>("/predict", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  graph: (transactionId: number) =>
    request<GraphResponse>(`/graph/${transactionId}`),
  rings: () => request<FraudRing[]>("/rings"),
  modelInfo: () => request<ModelInfo>("/model/info"),
  recentTransactions: (limit = 20) =>
    request<RecentTransaction[]>(`/transactions/recent?limit=${limit}`),
  transaction: (transactionId: number) =>
    request<RecentTransaction>(`/transactions/${transactionId}`),
  recordDecision: (input: CaseDecisionInput) =>
    request<Case>("/cases", { method: "POST", body: JSON.stringify(input) }),
  cases: (status?: CaseStatus) =>
    request<Case[]>(`/cases${status ? `?status=${status}` : ""}`),
};
