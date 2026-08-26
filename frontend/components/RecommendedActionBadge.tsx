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
      className="flex items-center gap-3 rounded-lg border p-3"
      style={{ borderColor: color, background: "color-mix(in srgb, currentColor 8%, transparent)", color }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold"
        style={{ background: "color-mix(in srgb, currentColor 18%, transparent)" }}
        aria-hidden
      >
        {ACTION_ICON[action]}
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide">Recommended action</div>
        <div className="text-lg font-semibold">{action}</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {ACTION_COPY[action]}
        </div>
      </div>
    </div>
  );
}
