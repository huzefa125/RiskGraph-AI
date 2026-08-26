"""Turns raw transaction rows into the feature matrix used for training and prediction.

Every feature here is point-in-time: computed only from transaction history strictly
BEFORE the row being scored, exactly matching what app/model/predict.py can actually see
at live-scoring time (it queries the DB before inserting the new transaction). This used
to not be true for device_user_count/ip_user_count/amount_ratio_to_user_avg — they were
computed once over the whole dataset, so an early (chronologically first) transaction on
what would eventually become a 6-user fraud-ring device already "saw" all 6 users' worth
of sharing, and a user's amount_ratio used their full history including transactions that
hadn't happened yet. That's train-serving skew: the live /predict path could never see
future data, so training let the model lean on information it will never have in
production. Fixed by computing each feature as a running/expanding value ordered by
occurred_at, mirroring predict.py's "COUNT(DISTINCT user_id) before insert" and
"AVG(amount) before insert" queries row for row.
"""
import numpy as np
import pandas as pd
from sqlalchemy import text

from app.config import FEATURE_COLUMNS, PAYMENT_METHODS
from app.db.connection import engine

NIGHT_HOURS = set(range(0, 6))


def load_raw_transactions() -> pd.DataFrame:
    query = text("""
        SELECT
            t.transaction_id, t.user_id, t.device_id, t.ip_id, t.merchant_id,
            t.amount, t.payment_method, t.occurred_at, t.failed_attempts,
            t.is_new_device, t.is_fraud, u.account_created
        FROM transactions t
        JOIN users u ON u.user_id = t.user_id
        ORDER BY t.user_id, t.occurred_at
    """)
    with engine.connect() as conn:
        return pd.read_sql(query, conn)


def _velocity_24h(group: pd.DataFrame) -> pd.Series:
    """Already point-in-time: times[:i] is strictly prior since group is time-ordered."""
    times = group["occurred_at"].to_numpy()
    counts = np.zeros(len(times), dtype=int)
    window = np.timedelta64(24, "h")
    for i, t in enumerate(times):
        counts[i] = np.sum(times[:i] > (t - window))
    return pd.Series(counts, index=group.index)


def _running_entity_user_count(df: pd.DataFrame, entity_col: str) -> pd.Series:
    """Point-in-time distinct-user count for a device/IP, as of AND including this row —
    matches predict.py's `prior_count + (0 if used_before else 1)` exactly. Processes each
    entity's rows in occurred_at order so "prior" only ever means strictly earlier rows."""
    result = pd.Series(0, index=df.index, dtype=int)
    ordered = df.sort_values("occurred_at")
    for _, group in ordered.groupby(entity_col):
        seen_users = set()
        for idx, user_id in zip(group.index, group["user_id"]):
            is_new = user_id not in seen_users
            result.loc[idx] = len(seen_users) + (1 if is_new else 0)
            seen_users.add(user_id)
    return result


def _running_amount_ratio(df: pd.DataFrame) -> pd.Series:
    """amount / mean(this user's STRICTLY PRIOR amounts) — matches predict.py's
    AVG(amount) query, which runs before the current transaction is inserted. No prior
    history (first transaction ever) falls back to 1.0, same as predict.py's `if avg_amount
    else 1.0`."""
    result = pd.Series(1.0, index=df.index, dtype=float)
    ordered = df.sort_values("occurred_at")
    for _, group in ordered.groupby("user_id"):
        running_sum = 0.0
        running_count = 0
        for idx, amount in zip(group.index, group["amount"]):
            if running_count > 0:
                prior_avg = running_sum / running_count
                result.loc[idx] = amount / prior_avg if prior_avg else 1.0
            running_sum += amount
            running_count += 1
    return result


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["occurred_at"] = pd.to_datetime(df["occurred_at"])
    df["account_created"] = pd.to_datetime(df["account_created"])

    df["hour"] = df["occurred_at"].dt.hour
    df["is_night"] = df["hour"].isin(NIGHT_HOURS).astype(int)
    df["is_new_device"] = df["is_new_device"].astype(int)
    df["account_age_days"] = (df["occurred_at"] - df["account_created"]).dt.days

    df["user_txn_count_24h"] = (
        df.groupby("user_id", group_keys=False).apply(_velocity_24h)
    )

    df["device_user_count"] = _running_entity_user_count(df, "device_id")
    df["ip_user_count"] = _running_entity_user_count(df, "ip_id")
    df["amount_ratio_to_user_avg"] = _running_amount_ratio(df)

    for method in PAYMENT_METHODS:
        df[f"payment_method_{method}"] = (df["payment_method"] == method).astype(int)

    return df[["transaction_id", "is_fraud"] + FEATURE_COLUMNS]
