"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Case, CaseDecision } from "@/lib/types";
import { ACTION_COLOR, ACTION_ICON } from "@/lib/risk";

const DECISIONS: CaseDecision[] = ["Allow", "Review", "Block"];

export function CaseDecisionForm({
  transactionId,
  initialCase,
}: {
  transactionId: number;
  initialCase: Case | null;
}) {
  const [current, setCurrent] = useState(initialCase);
  const [reason, setReason] = useState(initialCase?.reason ?? "");
  const [submitting, setSubmitting] = useState<CaseDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: CaseDecision) {
    setSubmitting(decision);
    setError(null);
    try {
      const result = await api.recordDecision({ transaction_id: transactionId, decision, reason });
      setCurrent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
      {current && (
        <div
          className="mb-3 rounded-md p-2 text-xs"
          style={{
            background: "color-mix(in srgb, var(--gridline) 60%, transparent)",
            color: "var(--text-secondary)",
          }}
        >
          Current case:{" "}
          <span className="font-semibold" style={{ color: ACTION_COLOR[current.decision] }}>
            {current.decision}
          </span>{" "}
          · <span className="uppercase">{current.status}</span> · last updated{" "}
          {new Date(current.updated_at).toLocaleString()}
          {current.reason && <div className="mt-1 italic">&ldquo;{current.reason}&rdquo;</div>}
        </div>
      )}

      <label className="block text-xs" style={{ color: "var(--text-secondary)" }}>
        Reason (optional)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Why are you making this decision?"
          className="mt-1 w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>

      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {DECISIONS.map((decision) => (
          <button
            key={decision}
            onClick={() => submit(decision)}
            disabled={submitting !== null}
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: ACTION_COLOR[decision] }}
          >
            {submitting === decision ? "…" : `${ACTION_ICON[decision]} ${decision}`}
          </button>
        ))}
      </div>
    </div>
  );
}
