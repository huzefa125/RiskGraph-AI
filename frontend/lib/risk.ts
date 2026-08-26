import type { RecommendedAction, RiskLevel } from "./types";

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  LOW: "var(--status-good)",
  MEDIUM: "var(--status-warning)",
  HIGH: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

export const RISK_LEVEL_ICON: Record<RiskLevel, string> = {
  LOW: "✓", // check
  MEDIUM: "▲", // triangle
  HIGH: "▲",
  CRITICAL: "✕", // cross
};

// mirrors the backend's deterministic policy table (config.ACTION_BY_LEVEL) — the model
// never decides this, a fixed lookup does
export const ACTION_COLOR: Record<RecommendedAction, string> = {
  Allow: "var(--status-good)",
  Review: "var(--status-warning)",
  Block: "var(--status-critical)",
};

export const ACTION_ICON: Record<RecommendedAction, string> = {
  Allow: "✓",
  Review: "▲",
  Block: "✕",
};
