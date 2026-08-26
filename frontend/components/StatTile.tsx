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
      className="rounded-lg border p-3.5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="eyebrow">{label}</div>
      {loading ? (
        <div className="skeleton mt-2 h-6 w-16" aria-hidden />
      ) : (
        <div className="mt-1 text-xl font-semibold tabular-nums" style={{ letterSpacing: "-0.01em" }}>
          {value}
        </div>
      )}
      {caption && !loading && (
        <div className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
          {caption}
        </div>
      )}
    </div>
  );
}
