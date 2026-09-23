"""Train the landslide risk classifier.

The project dataset is intentionally small, so the script uses stratified
cross-validation for model selection and probability calibration before the
final model is fitted on all available samples.
"""

from pathlib import Path
import json
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict, cross_val_score


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "dataset.csv"
MODEL_PATH = BASE_DIR / "landslide_model.pkl"
METRICS_PATH = BASE_DIR / "model_metrics.json"

FEATURES = [
    "rainfall",
    "soil_moisture",
    "slope",
    "historical_incidents",
]
TARGET = "landslide"
CLASS_NAMES = {0: "LOW", 1: "MODERATE", 2: "HIGH"}


# This model is deliberately regularised for the tiny dataset. More trees
# improve stability without pretending the 60-row dataset contains more
# information than it actually does.
BASE_MODEL = ExtraTreesClassifier(
    n_estimators=700,
    max_depth=8,
    min_samples_split=4,
    min_samples_leaf=2,
    max_features=None,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)


def load_dataset() -> tuple[pd.DataFrame, pd.Series]:
    data = pd.read_csv(DATASET_PATH)

    missing = [column for column in FEATURES + [TARGET] if column not in data.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    X = data[FEATURES].apply(pd.to_numeric, errors="coerce")
    y = pd.to_numeric(data[TARGET], errors="coerce")

    valid = X.notna().all(axis=1) & y.notna()
    X = X.loc[valid].reset_index(drop=True)
    y = y.loc[valid].astype(int).reset_index(drop=True)

    if not set(y.unique()).issubset(CLASS_NAMES):
        raise ValueError("Target must contain only 0 (LOW), 1 (MODERATE), or 2 (HIGH).")

    if len(X) < 30:
        raise ValueError("At least 30 valid training rows are recommended.")

    return X, y


def main() -> None:
    print("=" * 58)
    print("      LANDSLIDE RISK MODEL TRAINING")
    print("=" * 58)

    X, y = load_dataset()
    print(f"Dataset: {DATASET_PATH}")
    print(f"Valid samples: {len(X)}")
    print("Class distribution:")
    print(y.value_counts().sort_index().rename(index=CLASS_NAMES).to_string())

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    print("\nCross-validating ExtraTrees (5-fold)...")
    cv_accuracy = cross_val_score(BASE_MODEL, X, y, cv=cv, scoring="accuracy", n_jobs=1)
    cv_balanced = cross_val_score(
        BASE_MODEL, X, y, cv=cv, scoring="balanced_accuracy", n_jobs=1
    )

    # Out-of-fold predictions are useful for an honest development metric.
    oof = cross_val_predict(BASE_MODEL, X, y, cv=cv, method="predict", n_jobs=1)
    oof_accuracy = accuracy_score(y, oof)
    oof_balanced = balanced_accuracy_score(y, oof)

    print(f"5-fold accuracy:          {cv_accuracy.mean() * 100:.2f}% ± {cv_accuracy.std() * 100:.2f}%")
    print(f"5-fold balanced accuracy: {cv_balanced.mean() * 100:.2f}% ± {cv_balanced.std() * 100:.2f}%")
    print(f"OOF accuracy:             {oof_accuracy * 100:.2f}%")
    print(f"OOF balanced accuracy:    {oof_balanced * 100:.2f}%")

    print("\nOut-of-fold classification report:")
    print(
        classification_report(
            y,
            oof,
            labels=[0, 1, 2],
            target_names=[CLASS_NAMES[i] for i in [0, 1, 2]],
            zero_division=0,
        )
    )
    print("Out-of-fold confusion matrix:")
    print(confusion_matrix(y, oof, labels=[0, 1, 2]))

    # Fit the final probability-calibrated model on all available data.
    # Sigmoid calibration is less data-hungry than isotonic for this dataset.
    print("\nFitting probability-calibrated final model...")
    final_model = CalibratedClassifierCV(
        estimator=BASE_MODEL,
        method="sigmoid",
        cv=3,
    )
    final_model.fit(X, y)

    # Feature importance is averaged over the calibrated ExtraTrees models.
    importances = np.mean(
        [calibrated.estimator.feature_importances_ for calibrated in final_model.calibrated_classifiers_],
        axis=0,
    )
    feature_importance = {
        feature: round(float(value * 100), 2)
        for feature, value in zip(FEATURES, importances)
    }

    joblib.dump(final_model, MODEL_PATH)

    metrics = {
        "model": "Calibrated ExtraTrees",
        "features": FEATURES,
        "classes": CLASS_NAMES,
        "samples": int(len(X)),
        "cross_validation": {
            "folds": 5,
            "accuracy_mean": round(float(cv_accuracy.mean()), 4),
            "accuracy_std": round(float(cv_accuracy.std()), 4),
            "balanced_accuracy_mean": round(float(cv_balanced.mean()), 4),
            "balanced_accuracy_std": round(float(cv_balanced.std()), 4),
            "oof_accuracy": round(float(oof_accuracy), 4),
            "oof_balanced_accuracy": round(float(oof_balanced), 4),
        },
        "feature_importance_percent": feature_importance,
        "warning": "Metrics are development metrics on a small project dataset; they are not a field-validation guarantee.",
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("\nFeature importance:")
    for feature, value in feature_importance.items():
        print(f"  {feature:24s} {value:6.2f}%")

    print("\nSaved:")
    print(f"  {MODEL_PATH}")
    print(f"  {METRICS_PATH}")
    print("\nTraining completed successfully.")


if __name__ == "__main__":
    warnings.filterwarnings("ignore", category=UserWarning)
    main()
