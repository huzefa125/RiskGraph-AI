import type { RecommendedAction } from "@/lib/types";
import { ACTION_COLOR, ACTION_ICON } from "@/lib/risk";

const ACTION_COPY: Record<RecommendedAction, string> = {
  Allow: "No friction — proceed normally.",
  Review: "Route to a human analyst before completing.",
  Block: "Stop the transaction — do not process.",
};

export function RecommendedActionBadge({ action }: { action: RecommendedAction }) {
  const color = ACTION_COLOR[action];
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 sm:min-w-52.5"
      style={{ borderColor: color, background: "color-mix(in srgb, currentColor 7%, var(--surface))", color }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold"
        style={{ background: "color-mix(in srgb, currentColor 18%, transparent)" }}
        aria-hidden
      >
        {ACTION_ICON[action]}
      </span>
      <div className="min-w-0">
        <div className="eyebrow" style={{ color: "currentColor", opacity: 0.85 }}>
          Recommended action
        </div>
        <div className="text-lg leading-tight font-semibold">{action}</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {ACTION_COPY[action]}
        </div>
      </div>
    </div>
  );
}
