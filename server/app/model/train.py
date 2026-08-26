"""Trains LR/RF/XGBoost, picks the winner by validation F1, reports held-out test metrics.

Run: python -m app.model.train
"""
import json

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from app.config import ARTIFACTS_DIR, FEATURE_COLUMNS, METADATA_PATH, MODEL_PATH, RANDOM_SEED
from app.features.build_features import compute_features, load_raw_transactions
from app.model.evaluate import evaluate_model

CANDIDATES = {
    "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced"),
    "random_forest": RandomForestClassifier(
        n_estimators=200, max_depth=8, class_weight="balanced", random_state=RANDOM_SEED
    ),
    "xgboost": XGBClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.1,
        eval_metric="logloss", random_state=RANDOM_SEED,
    ),
}


def main():
    raw = load_raw_transactions()
    features = compute_features(raw)

    X = features[FEATURE_COLUMNS]
    y = features["is_fraud"].astype(int)

    # 70% train / 15% validation / 15% held-out test, stratified so fraud rate is
    # consistent across splits given how rare fraud is
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=RANDOM_SEED
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=RANDOM_SEED
    )

    validation_results = {}
    for name, model in CANDIDATES.items():
        model.fit(X_train, y_train)
        validation_results[name] = evaluate_model(model, X_val, y_val)
        print(f"[{name}] validation: {validation_results[name]}")

    best_name = max(validation_results, key=lambda n: validation_results[n]["f1"])
    best_model = CANDIDATES[best_name]
    test_metrics = evaluate_model(best_model, X_test, y_test)
    print(f"\nSelected model: {best_name}")
    print(f"Held-out test metrics: {test_metrics}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps({
        "model_name": best_name,
        "feature_columns": FEATURE_COLUMNS,
        "validation_metrics": validation_results,
        "test_metrics": test_metrics,
    }, indent=2))
    print(f"\nSaved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
