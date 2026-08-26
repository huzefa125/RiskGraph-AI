"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Case } from "@/lib/types";
import { CasesList } from "@/components/CasesList";

type Filter = "all" | "open" | "resolved";

export default function CasesPage() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api
      .cases()
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to reach the API"));
  }, []);

  const filtered = useMemo(() => {
    if (!cases) return [];
    if (filter === "all") return cases;
    return cases.filter((c) => c.status === filter);
  }, [cases, filter]);

  const openCount = cases?.filter((c) => c.status === "open").length ?? 0;
  const resolvedCount = cases?.filter((c) => c.status === "resolved").length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>
        ← Back to dashboard
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">Cases &amp; Review</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Every analyst decision recorded from a transaction&apos;s investigation panel —
          Review decisions stay open until revisited with Allow or Block.
        </p>
      </header>

      {error && (
        <p
          className="rounded-md border p-3 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          Couldn&apos;t reach the API — is the FastAPI server running? ({error})
        </p>
      )}

      {!error && cases === null && <div className="skeleton h-40 w-full" />}

      {cases !== null && (
        <>
          <div className="flex gap-2 text-sm">
            {([
              ["all", `All (${cases.length})`],
              ["open", `Open (${openCount})`],
              ["resolved", `Resolved (${resolvedCount})`],
            ] as [Filter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="btn rounded-full border px-3 py-1"
                style={{
                  borderColor: filter === value ? "var(--seq-500)" : "var(--border)",
                  color: filter === value ? "var(--seq-500)" : "var(--text-secondary)",
                  background: filter === value ? "color-mix(in srgb, var(--seq-500) 8%, var(--surface))" : "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <CasesList cases={filtered} />
        </>
      )}
    </div>
  );
}
