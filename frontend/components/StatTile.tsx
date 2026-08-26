export function StatTile({
  label,
  value,
  caption,
  loading,
}: {
  label: string;
  value: string;
  caption?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      {loading ? (
        <div
          className="mt-2 h-6 w-16 animate-pulse rounded"
          style={{ background: "var(--gridline)" }}
          aria-hidden
        />
      ) : (
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      )}
      {caption && !loading && (
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {caption}
        </div>
      )}
    </div>
  );
}
