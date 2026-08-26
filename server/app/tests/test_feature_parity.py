"""Confirms training-time features (build_features.py) and live-prediction-time features
(predict.py's SQL) produce IDENTICAL point-in-time values for the same real transactions.

This is an integration test against the dev Postgres database (no mocking) — consistent
with the rest of this project's philosophy of testing against the real, reproducible
pipeline rather than a parallel test double. Run with the DB populated
(`python -m app.data.generate_synthetic_data`):

    python -m pytest app/tests/test_feature_parity.py -v

Guards against train-serving skew silently coming back: device_user_count, ip_user_count,
and amount_ratio_to_user_avg must only ever reflect transaction history strictly BEFORE
the row being scored, in both the training path and the live /predict path.
"""
import pytest
from sqlalchemy import text

from app.db.connection import engine
from app.features.build_features import compute_features, load_raw_transactions


def _predict_time_values(conn, user_id: int, device_id: int, ip_id: int, amount: float, occurred_at):
    """Replicates predict.py's score_transaction queries exactly, using this
    transaction's own occurred_at as "now" — i.e. what predict.py would have computed
    had this transaction been scored live at that moment."""
    prior_device_users = conn.execute(
        text("SELECT COUNT(DISTINCT user_id) FROM transactions WHERE device_id=:did AND occurred_at < :now"),
        {"did": device_id, "now": occurred_at},
    ).scalar()
    used_device_before = conn.execute(
        text("SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id=:uid AND device_id=:did AND occurred_at < :now)"),
        {"uid": user_id, "did": device_id, "now": occurred_at},
    ).scalar()
    device_user_count = prior_device_users + (0 if used_device_before else 1)

    prior_ip_users = conn.execute(
        text("SELECT COUNT(DISTINCT user_id) FROM transactions WHERE ip_id=:iid AND occurred_at < :now"),
        {"iid": ip_id, "now": occurred_at},
    ).scalar()
    used_ip_before = conn.execute(
        text("SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id=:uid AND ip_id=:iid AND occurred_at < :now)"),
        {"uid": user_id, "iid": ip_id, "now": occurred_at},
    ).scalar()
    ip_user_count = prior_ip_users + (0 if used_ip_before else 1)

    avg_amount = conn.execute(
        text("SELECT AVG(amount) FROM transactions WHERE user_id=:uid AND occurred_at < :now"),
        {"uid": user_id, "now": occurred_at},
    ).scalar()
    amount_ratio = float(amount) / float(avg_amount) if avg_amount else 1.0

    return device_user_count, ip_user_count, amount_ratio


def _sample_transaction_ids(conn) -> list[int]:
    """A representative spread: earliest, latest, and (if any exist) rows on a
    device/IP shared by 2+ users — the exact case that used to leak future information."""
    shared_device = conn.execute(text("""
        SELECT device_id FROM transactions GROUP BY device_id
        HAVING COUNT(DISTINCT user_id) >= 2 LIMIT 1
    """)).scalar()

    ids = set(conn.execute(text("""
        (SELECT transaction_id FROM transactions ORDER BY occurred_at ASC LIMIT 2)
        UNION
        (SELECT transaction_id FROM transactions ORDER BY occurred_at DESC LIMIT 2)
    """)).scalars().all())

    if shared_device is not None:
        ids.update(conn.execute(
            text("""
                (SELECT transaction_id FROM transactions WHERE device_id=:d ORDER BY occurred_at ASC LIMIT 1)
                UNION
                (SELECT transaction_id FROM transactions WHERE device_id=:d ORDER BY occurred_at DESC LIMIT 1)
            """),
            {"d": shared_device},
        ).scalars().all())

    return sorted(ids)


@pytest.fixture(scope="module")
def sample_transaction_ids():
    with engine.connect() as conn:
        ids = _sample_transaction_ids(conn)
    if not ids:
        pytest.skip("no transactions in the database — run app.data.generate_synthetic_data first")
    return ids


@pytest.fixture(scope="module")
def training_features():
    return compute_features(load_raw_transactions())


def test_device_ip_amount_features_match_predict_time(sample_transaction_ids, training_features):
    with engine.connect() as conn:
        for transaction_id in sample_transaction_ids:
            train_row = training_features[training_features["transaction_id"] == transaction_id].iloc[0]
            txn = conn.execute(
                text("SELECT user_id, device_id, ip_id, amount, occurred_at FROM transactions WHERE transaction_id=:tid"),
                {"tid": transaction_id},
            ).mappings().first()

            predict_device_count, predict_ip_count, predict_ratio = _predict_time_values(
                conn, txn["user_id"], txn["device_id"], txn["ip_id"], float(txn["amount"]), txn["occurred_at"]
            )

            assert train_row["device_user_count"] == predict_device_count, (
                f"transaction {transaction_id}: device_user_count train="
                f"{train_row['device_user_count']} predict={predict_device_count}"
            )
            assert train_row["ip_user_count"] == predict_ip_count, (
                f"transaction {transaction_id}: ip_user_count train="
                f"{train_row['ip_user_count']} predict={predict_ip_count}"
            )
            assert round(float(train_row["amount_ratio_to_user_avg"]), 6) == round(predict_ratio, 6), (
                f"transaction {transaction_id}: amount_ratio_to_user_avg train="
                f"{train_row['amount_ratio_to_user_avg']} predict={predict_ratio}"
            )
