"""Lightweight graph analysis with networkx instead of standing up Neo4j (README Phase 6,
descoped per PLAN.md). Only devices/IPs shared by 2+ distinct users are graphed — singleton
devices/IPs used by exactly one user carry no ring signal and would just be noise."""
import networkx as nx
from sqlalchemy import text

from app.config import FEATURE_COLUMNS, score_to_level
from app.db.connection import engine
from app.features.build_features import compute_features, load_raw_transactions
from app.model.predict import get_model


def _shared_entity_ids(conn, column: str, min_users: int) -> set[int]:
    rows = conn.execute(
        text(f"""
            SELECT {column} FROM transactions
            GROUP BY {column}
            HAVING COUNT(DISTINCT user_id) >= :min_users
        """),
        {"min_users": min_users},
    ).all()
    return {r[0] for r in rows}


def build_shared_entity_graph(min_users: int = 2) -> nx.Graph:
    with engine.connect() as conn:
        shared_devices = _shared_entity_ids(conn, "device_id", min_users)
        shared_ips = _shared_entity_ids(conn, "ip_id", min_users)

        if not shared_devices and not shared_ips:
            return nx.Graph()

        rows = conn.execute(
            text("""
                SELECT DISTINCT user_id, device_id, ip_id FROM transactions
                WHERE device_id = ANY(:devices) OR ip_id = ANY(:ips)
            """),
            {"devices": list(shared_devices) or [-1], "ips": list(shared_ips) or [-1]},
        ).all()

    G = nx.Graph()
    for user_id, device_id, ip_id in rows:
        user_node = f"user:{user_id}"
        G.add_node(user_node, type="user")
        if device_id in shared_devices:
            device_node = f"device:{device_id}"
            G.add_node(device_node, type="device")
            G.add_edge(user_node, device_node)
        if ip_id in shared_ips:
            ip_node = f"ip:{ip_id}"
            G.add_node(ip_node, type="ip")
            G.add_edge(user_node, ip_node)
    return G


def _to_json(G: nx.Graph) -> dict:
    nodes = [{"id": n, "type": data["type"]} for n, data in G.nodes(data=True)]
    edges = [{"source": u, "target": v} for u, v in G.edges()]
    users = [n for n in G.nodes if G.nodes[n]["type"] == "user"]
    return {"nodes": nodes, "edges": edges, "is_potential_ring": len(users) > 1}


def get_transaction_subgraph(transaction_id: int) -> dict:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT user_id, device_id, ip_id FROM transactions WHERE transaction_id = :tid"),
            {"tid": transaction_id},
        ).first()
    if not row:
        raise ValueError(f"unknown transaction_id {transaction_id}")
    user_id, device_id, ip_id = row

    G = build_shared_entity_graph()
    start = f"user:{user_id}"
    subgraph = G.subgraph(nx.node_connected_component(G, start)).copy() if G.has_node(start) else nx.Graph()

    # always include the transaction's own user/device/ip so the UI has context even
    # when this particular device/ip isn't shared with anyone else
    subgraph.add_node(start, type="user")
    subgraph.add_node(f"device:{device_id}", type="device")
    subgraph.add_node(f"ip:{ip_id}", type="ip")
    subgraph.add_edge(start, f"device:{device_id}")
    subgraph.add_edge(start, f"ip:{ip_id}")

    result = _to_json(subgraph)
    result["transaction_id"] = transaction_id
    return result


def _entity_ids(node_ids, prefix: str) -> list[int]:
    return sorted(int(n.split(":")[1]) for n in node_ids if n.startswith(f"{prefix}:"))


def detect_fraud_rings(min_users: int = 3) -> list[dict]:
    """Connected components with 3+ distinct users sharing a device/IP — the threshold
    that separates coordinated rings from incidental 2-user overlap in the synthetic data.

    Severity (risk_score/risk_level) reuses the actual trained model rather than a new
    ad hoc formula: every transaction belonging to the ring is scored with the same
    point-in-time features used everywhere else, and the ring's severity is the mean of
    those scores. representative_transaction_id lets the UI reuse the existing
    /graph/{transaction_id} endpoint to inspect the ring — no new graph endpoint needed."""
    G = build_shared_entity_graph(min_users=2)
    components = [
        c for c in nx.connected_components(G)
        if sum(1 for n in c if G.nodes[n]["type"] == "user") >= min_users
    ]
    if not components:
        return []

    model = get_model()
    features = compute_features(load_raw_transactions()).set_index("transaction_id")

    rings = []
    with engine.connect() as conn:
        for component in components:
            users = sorted(n for n in component if G.nodes[n]["type"] == "user")
            device_ids = _entity_ids(component, "device")
            ip_ids = _entity_ids(component, "ip")

            txns = conn.execute(
                text("""
                    SELECT transaction_id, amount FROM transactions
                    WHERE device_id = ANY(:devices) OR ip_id = ANY(:ips)
                """),
                {"devices": device_ids or [-1], "ips": ip_ids or [-1]},
            ).all()
            transaction_ids = sorted(t[0] for t in txns)
            total_amount = round(float(sum(float(t[1]) for t in txns)), 2)

            ring_features = features.loc[features.index.intersection(transaction_ids), FEATURE_COLUMNS]
            risk_score = round(float(model.predict_proba(ring_features)[:, 1].mean()) * 100, 2) if len(ring_features) else 0.0

            rings.append({
                "users": users,
                "component_size": len(component),
                "devices": [f"device:{d}" for d in device_ids],
                "ips": [f"ip:{i}" for i in ip_ids],
                "transaction_ids": transaction_ids,
                "transaction_count": len(transaction_ids),
                "total_amount": total_amount,
                "risk_score": risk_score,
                "risk_level": score_to_level(risk_score),
                "representative_transaction_id": transaction_ids[0] if transaction_ids else None,
            })
    return rings
