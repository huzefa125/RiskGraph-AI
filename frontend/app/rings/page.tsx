"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { FraudRing } from "@/lib/types";
import { FraudRingCard } from "@/components/FraudRingCard";

export default function RingsPage() {
  const [rings, setRings] = useState<FraudRing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .rings()
      .then((data) => setRings([...data].sort((a, b) => b.risk_score - a.risk_score)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to reach the API"));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/" className="text-sm hover:underline" style={{ color: "var(--text-secondary)" }}>
        ← Back to dashboard
      </Link>

      <header>
        <h1 className="text-xl font-semibold">Fraud Ring Investigation</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Every coordinated cluster the entity graph has detected — devices/IPs shared by
          3+ distinct users — ranked by model-scored severity. Click a ring to inspect its
          entity graph.
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

      {!error && rings === null && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 w-full animate-pulse rounded-lg" style={{ background: "var(--gridline)" }} />
          ))}
        </div>
      )}

      {rings !== null && rings.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          No coordinated fraud rings detected in the current dataset.
        </p>
      )}

      {rings !== null && rings.length > 0 && (
        <div className="flex flex-col gap-4">
          {rings.map((ring, i) => (
            <FraudRingCard key={i} ring={ring} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
