"""Turns raw transaction rows into the feature matrix used for training and prediction.

NOTE: device_user_count / ip_user_count are computed over the whole dataset rather than
"as of transaction time" — a known simplification for the synthetic-data MVP. Fine here since
the model is a demo/evaluation artifact, not a live-leakage-sensitive production model.
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
    times = group["occurred_at"].to_numpy()
    counts = np.zeros(len(times), dtype=int)
    window = np.timedelta64(24, "h")
    for i, t in enumerate(times):
        counts[i] = np.sum(times[:i] > (t - window))
    return pd.Series(counts, index=group.index)


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

    device_user_count = df.groupby("device_id")["user_id"].nunique()
    ip_user_count = df.groupby("ip_id")["user_id"].nunique()
    df["device_user_count"] = df["device_id"].map(device_user_count)
    df["ip_user_count"] = df["ip_id"].map(ip_user_count)

    user_avg_amount = df.groupby("user_id")["amount"].transform("mean")
    df["amount_ratio_to_user_avg"] = df["amount"] / user_avg_amount.replace(0, np.nan)
    df["amount_ratio_to_user_avg"] = df["amount_ratio_to_user_avg"].fillna(1.0)

    for method in PAYMENT_METHODS:
        df[f"payment_method_{method}"] = (df["payment_method"] == method).astype(int)

    return df[["transaction_id", "is_fraud"] + FEATURE_COLUMNS]
