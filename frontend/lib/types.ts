export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskFactor {
  feature: string;
  description: string;
  contribution: number;
}

export interface PredictionResponse {
  transaction_id: number;
  user_id: number;
  score: number;
  risk_level: RiskLevel;
  risk_factors: RiskFactor[];
}

export interface GraphNode {
  id: string;
  type: "user" | "device" | "ip";
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphResponse {
  transaction_id: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  is_potential_ring: boolean;
}

export interface FraudRing {
  users: string[];
  component_size: number;
  devices: string[];
  ips: string[];
  transaction_ids: number[];
  transaction_count: number;
  total_amount: number;
  risk_score: number;
  risk_level: RiskLevel;
  representative_transaction_id: number | null;
}

export interface RecentTransaction {
  transaction_id: number;
  user_id: number;
  amount: number;
  payment_method: string;
  occurred_at: string;
  score: number | null;
  risk_level: RiskLevel | null;
  risk_factors?: RiskFactor[] | null;
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface ModelMetrics {
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  confusion_matrix: ConfusionMatrix;
}

export interface ModelInfo {
  model_name: string;
  feature_columns: string[];
  validation_metrics: Record<string, ModelMetrics>;
  test_metrics: ModelMetrics;
}

export interface TransactionInput {
  user_id: number;
  device_fingerprint: string;
  ip_address: string;
  merchant_id: number;
  amount: number;
  payment_method: string;
  failed_attempts: number;
  occurred_at?: string;
}
