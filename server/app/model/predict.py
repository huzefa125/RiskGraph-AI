"""Scores one incoming transaction: resolves device/IP, computes the same feature set
used at training time from live history, inserts the transaction, and persists the
resulting risk score (README Phase 2)."""
import json
from datetime import datetime, timedelta

import joblib
from sqlalchemy import text

from app.config import FEATURE_COLUMNS, MODEL_PATH, PAYMENT_METHODS, score_to_level
from app.db.connection import engine
from app.model.explain import explain

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


def _get_or_create_device(conn, fingerprint: str) -> int:
    row = conn.execute(text("SELECT device_id FROM devices WHERE fingerprint = :fp"), {"fp": fingerprint}).first()
    if row:
        return row[0]
    return conn.execute(
        text("INSERT INTO devices (fingerprint) VALUES (:fp) RETURNING device_id"), {"fp": fingerprint}
    ).scalar()


def _get_or_create_ip(conn, address: str) -> int:
    row = conn.execute(text("SELECT ip_id FROM ip_addresses WHERE address = CAST(:addr AS INET)"), {"addr": address}).first()
    if row:
        return row[0]
    return conn.execute(
        text("INSERT INTO ip_addresses (address) VALUES (CAST(:addr AS INET)) RETURNING ip_id"), {"addr": address}
    ).scalar()


def score_transaction(
    user_id: int,
    device_fingerprint: str,
    ip_address: str,
    merchant_id: int,
    amount: float,
    payment_method: str,
    failed_attempts: int,
    occurred_at: datetime | None = None,
) -> dict:
    occurred_at = occurred_at or datetime.utcnow()

    with engine.begin() as conn:
        user = conn.execute(text("SELECT account_created FROM users WHERE user_id = :uid"), {"uid": user_id}).first()
        if not user:
            raise ValueError(f"unknown user_id {user_id}")
        account_created = user[0]

        device_id = _get_or_create_device(conn, device_fingerprint)
        ip_id = _get_or_create_ip(conn, ip_address)

        used_device_before = conn.execute(
            text("SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id = :uid AND device_id = :did)"),
            {"uid": user_id, "did": device_id},
        ).scalar()
        used_ip_before = conn.execute(
            text("SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id = :uid AND ip_id = :iid)"),
            {"uid": user_id, "iid": ip_id},
        ).scalar()
        prior_device_users = conn.execute(
            text("SELECT COUNT(DISTINCT user_id) FROM transactions WHERE device_id = :did"), {"did": device_id}
        ).scalar()
        prior_ip_users = conn.execute(
            text("SELECT COUNT(DISTINCT user_id) FROM transactions WHERE ip_id = :iid"), {"iid": ip_id}
        ).scalar()
        recent_txn_count = conn.execute(
            text("""
                SELECT COUNT(*) FROM transactions
                WHERE user_id = :uid AND occurred_at > :start AND occurred_at < :now
            """),
            {"uid": user_id, "start": occurred_at - timedelta(hours=24), "now": occurred_at},
        ).scalar()
        avg_amount = conn.execute(
            text("SELECT AVG(amount) FROM transactions WHERE user_id = :uid"), {"uid": user_id}
        ).scalar()

        is_new_device = not used_device_before
        device_user_count = prior_device_users + (0 if used_device_before else 1)
        ip_user_count = prior_ip_users + (0 if used_ip_before else 1)
        account_age_days = (occurred_at - account_created).days
        amount_ratio_to_user_avg = float(amount) / float(avg_amount) if avg_amount else 1.0

        feature_row = {
            "amount": float(amount),
            "hour": occurred_at.hour,
            "is_night": int(occurred_at.hour < 6),
            "failed_attempts": failed_attempts,
            "is_new_device": int(is_new_device),
            "account_age_days": account_age_days,
            "user_txn_count_24h": recent_txn_count,
            "device_user_count": device_user_count,
            "ip_user_count": ip_user_count,
            "amount_ratio_to_user_avg": amount_ratio_to_user_avg,
        }
        for method in PAYMENT_METHODS:
            feature_row[f"payment_method_{method}"] = int(payment_method == method)

        model = _get_model()
        X = [[feature_row[col] for col in FEATURE_COLUMNS]]
        probability = model.predict_proba(X)[0][1]
        score = round(float(probability) * 100, 2)
        risk_level = score_to_level(score)
        risk_factors = explain(feature_row)

        transaction_id = conn.execute(
            text("""
                INSERT INTO transactions
                    (user_id, device_id, ip_id, merchant_id, amount, payment_method,
                     occurred_at, failed_attempts, is_new_device, is_fraud)
                VALUES
                    (:user_id, :device_id, :ip_id, :merchant_id, :amount, :payment_method,
                     :occurred_at, :failed_attempts, :is_new_device, FALSE)
                RETURNING transaction_id
            """),
            {
                "user_id": user_id, "device_id": device_id, "ip_id": ip_id,
                "merchant_id": merchant_id, "amount": amount, "payment_method": payment_method,
                "occurred_at": occurred_at, "failed_attempts": failed_attempts,
                "is_new_device": is_new_device,
            },
        ).scalar()

        conn.execute(
            text("""
                INSERT INTO risk_scores (transaction_id, score, risk_level, risk_factors)
                VALUES (:tid, :score, :level, CAST(:factors AS JSONB))
            """),
            {
                "tid": transaction_id, "score": score, "level": risk_level,
                "factors": json.dumps(risk_factors),
            },
        )

    return {
        "transaction_id": transaction_id,
        "score": score,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
    }
