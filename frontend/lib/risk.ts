import type { RiskLevel } from "./types";

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
