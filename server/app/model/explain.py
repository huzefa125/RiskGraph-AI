"""SHAP-based explanation: turns a scored transaction's feature contributions into
human-readable risk factors (README Phase 4)."""
import joblib
import pandas as pd
import shap

from app.config import FEATURE_COLUMNS, MODEL_PATH, PAYMENT_METHODS
from app.features.build_features import compute_features, load_raw_transactions

FEATURE_DESCRIPTIONS = {
    "amount": "Unusually high transaction amount",
    "hour": "Unusual transaction hour",
    "is_night": "Unusual transaction time",
    "failed_attempts": "Multiple failed attempts",
    "is_new_device": "New device",
    "account_age_days": "New or young account",
    "user_txn_count_24h": "High transaction velocity",
    "device_user_count": "Device shared across many users",
    "ip_user_count": "IP address shared across many users",
    "amount_ratio_to_user_avg": "Amount much higher than this user's usual spend",
    **{f"payment_method_{m}": f"Paid via {m}" for m in PAYMENT_METHODS},
}

_explainer = None


def _get_explainer():
    global _explainer
    if _explainer is None:
        model = joblib.load(MODEL_PATH)
        # passing the model itself (not model.predict_proba) lets shap dispatch to the
        # fast exact TreeExplainer/LinearExplainer instead of the slow generic/permutation path
        background = compute_features(load_raw_transactions())[FEATURE_COLUMNS].sample(
            n=100, random_state=0
        )
        _explainer = shap.Explainer(model, background)
    return _explainer


def explain(feature_row: dict, top_n: int = 5) -> list[dict]:
    explainer = _get_explainer()
    X = pd.DataFrame([feature_row])[FEATURE_COLUMNS]
    shap_values = explainer(X)

    # index 1 = positive (fraud) class output
    contributions = shap_values.values[0, :, 1] if shap_values.values.ndim == 3 else shap_values.values[0]

    ranked = sorted(
        zip(FEATURE_COLUMNS, contributions), key=lambda pair: pair[1], reverse=True
    )
    factors = []
    for feature, contribution in ranked:
        # one-hot payment-method dummies: SHAP explains every dummy, including the ones
        # that are 0 for this transaction (e.g. "paid via upi" when payment was card).
        # Only the method actually used is meaningful to show a human.
        if feature.startswith("payment_method_") and feature_row.get(feature) != 1:
            continue
        if contribution <= 0:
            continue
        factors.append({
            "feature": feature,
            "description": FEATURE_DESCRIPTIONS.get(feature, feature),
            "contribution": round(float(contribution), 4),
        })
        if len(factors) >= top_n:
            break
    return factors
