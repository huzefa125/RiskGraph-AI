"""Analyst decision + case tracking — the deterministic policy layer's audit trail.

The model recommends an action (config.level_to_action); a human analyst makes the
actual call. Every decision is persisted with a SNAPSHOT of the risk score/level at
decision time (copied in, not live-joined) — what the analyst saw never changes even if
the transaction were somehow rescored later. One case per transaction (transaction_id is
UNIQUE): recording a new decision for the same transaction updates the existing case
rather than creating a duplicate, so a case's history is "the latest decision," matching
the simple scope asked for here rather than a full audit-log table.
"""
from sqlalchemy import text

from app.db.connection import engine

VALID_DECISIONS = {"Allow", "Review", "Block"}


def _status_for_decision(decision: str) -> str:
    # Review means "flagged, needs a human to look again" — Allow/Block are both terminal
    # outcomes as far as this transaction is concerned
    return "open" if decision == "Review" else "resolved"


def record_decision(transaction_id: int, decision: str, reason: str | None) -> dict:
    if decision not in VALID_DECISIONS:
        raise ValueError(f"decision must be one of {sorted(VALID_DECISIONS)}")

    with engine.begin() as conn:
        risk_row = conn.execute(
            text("SELECT score, risk_level FROM risk_scores WHERE transaction_id = :tid"),
            {"tid": transaction_id},
        ).first()
        if not risk_row:
            raise ValueError(f"transaction {transaction_id} has not been scored yet — cannot open a case")
        score, risk_level = risk_row
        status = _status_for_decision(decision)

        conn.execute(
            text("""
                INSERT INTO cases (transaction_id, risk_score, risk_level, decision, reason, status, updated_at)
                VALUES (:tid, :score, :level, :decision, :reason, :status, now())
                ON CONFLICT (transaction_id) DO UPDATE SET
                    risk_score = EXCLUDED.risk_score,
                    risk_level = EXCLUDED.risk_level,
                    decision = EXCLUDED.decision,
                    reason = EXCLUDED.reason,
                    status = EXCLUDED.status,
                    updated_at = now()
            """),
            {
                "tid": transaction_id, "score": score, "level": risk_level,
                "decision": decision, "reason": reason, "status": status,
            },
        )

    return get_case_for_transaction(transaction_id)


_CASE_SELECT = """
    SELECT c.case_id, c.transaction_id, t.user_id, t.amount, c.risk_score, c.risk_level,
           c.decision, c.reason, c.status, c.created_at, c.updated_at
    FROM cases c
    JOIN transactions t ON t.transaction_id = c.transaction_id
"""


def get_case_for_transaction(transaction_id: int) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(f"{_CASE_SELECT} WHERE c.transaction_id = :tid"), {"tid": transaction_id}
        ).mappings().first()
    return dict(row) if row else None


def list_cases(status: str | None = None) -> list[dict]:
    query = _CASE_SELECT
    params = {}
    if status:
        query += " WHERE c.status = :status"
        params["status"] = status
    query += " ORDER BY c.updated_at DESC"

    with engine.connect() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return [dict(r) for r in rows]
