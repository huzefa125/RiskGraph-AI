from pathlib import Path

# risk thresholds from README section 10 — configurable, revisit after evaluation
RISK_LEVELS = [
    (30, "LOW"),
    (60, "MEDIUM"),
    (80, "HIGH"),
    (100, "CRITICAL"),
]

ARTIFACTS_DIR = Path(__file__).parent / "model" / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model.joblib"
METADATA_PATH = ARTIFACTS_DIR / "metadata.json"

RANDOM_SEED = 42

# shared between the data generator, feature builder and prediction schema so
# one-hot encoding stays consistent everywhere
PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet"]

FEATURE_COLUMNS = [
    "amount",
    "hour",
    "is_night",
    "failed_attempts",
    "is_new_device",
    "account_age_days",
    "user_txn_count_24h",
    "device_user_count",
    "ip_user_count",
    "amount_ratio_to_user_avg",
] + [f"payment_method_{m}" for m in PAYMENT_METHODS]


def score_to_level(score: float) -> str:
    for threshold, level in RISK_LEVELS:
        if score <= threshold:
            return level
    return "CRITICAL"


# Deterministic policy layer (README section 11): the model produces a score, this table
# decides the action — the model itself never authorizes/blocks anything. HIGH and
# CRITICAL both warrant human attention; CRITICAL escalates straight to blocking rather
# than queuing for review.
ACTION_BY_LEVEL = {
    "LOW": "Allow",
    "MEDIUM": "Review",
    "HIGH": "Review",
    "CRITICAL": "Block",
}


def level_to_action(risk_level: str) -> str:
    return ACTION_BY_LEVEL.get(risk_level, "Review")
