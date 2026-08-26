import type { GraphResponse } from "@/lib/types";

function idsOfType(graph: GraphResponse, type: "user" | "device" | "ip") {
  return graph.nodes.filter((n) => n.type === type).map((n) => n.id.split(":")[1]);
}

export function ConnectedEntitiesSummary({
  graph,
  focusUserId,
}: {
  graph: GraphResponse;
  focusUserId?: number;
}) {
  const users = idsOfType(graph, "user").filter((id) => Number(id) !== focusUserId);
  const devices = idsOfType(graph, "device");
  const ips = idsOfType(graph, "ip");

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Connected users
        </div>
        <div className="mt-0.5 text-sm">
          {users.length > 0 ? users.map((u) => `#${u}`).join(", ") : "none"}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Devices
        </div>
        <div className="mt-0.5 text-sm">{devices.length > 0 ? devices.join(", ") : "none"}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          IPs
        </div>
        <div className="mt-0.5 text-sm">{ips.length > 0 ? ips.join(", ") : "none"}</div>
      </div>
    </div>
  );
}
