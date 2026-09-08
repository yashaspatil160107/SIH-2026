import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

import joblib


# ===============================
# LOAD DATASET
# ===============================

data = pd.read_csv("dataset.csv")

print("================================")
print("DATASET INFORMATION")
print("================================")

print("Dataset shape:", data.shape)

print("\nClass distribution:")
print(data["landslide"].value_counts().sort_index())


# ===============================
# INPUT FEATURES
# ===============================

features = [
    "rainfall",
    "soil_moisture",
    "slope",
    "historical_incidents"
]

X = data[features].copy()


# ===============================
# TARGET
# ===============================

y = data["landslide"].copy()


# ===============================
# CHECK FOR MISSING VALUES
# ===============================

print("\nMissing values:")
print(X.isnull().sum())

print("\nTarget missing values:")
print(y.isnull().sum())


# ===============================
# REMOVE INVALID ROWS
# ===============================

valid_rows = (
    X.notnull().all(axis=1)
    & y.notnull()
)

X = X.loc[valid_rows]
y = y.loc[valid_rows]


# ===============================
# CONVERT DATA TYPES
# ===============================

X = X.astype(float)
y = y.astype(int)


# ===============================
# TRAIN / TEST SPLIT
# ===============================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n================================")
print("TRAIN / TEST DATA")
print("================================")

print("Training samples:", len(X_train))
print("Testing samples:", len(X_test))


# ===============================
# BASE RANDOM FOREST
# ===============================

base_model = RandomForestClassifier(

    n_estimators=300,

    max_depth=8,

    min_samples_leaf=3,

    max_features="sqrt",

    class_weight="balanced",

    random_state=42,

    n_jobs=-1
)


# ===============================
# CALIBRATED MODEL
# ===============================

model = CalibratedClassifierCV(
    estimator=base_model,
    method="sigmoid",
    cv=3
)


# ===============================
# TRAIN MODEL
# ===============================

print("\n================================")
print("TRAINING CALIBRATED MODEL")
print("================================")

model.fit(
    X_train,
    y_train
)

print("Training completed.")


# ===============================
# TEST MODEL
# ===============================

predictions = model.predict(
    X_test
)


# ===============================
# ACCURACY
# ===============================

accuracy = accuracy_score(
    y_test,
    predictions
)

print("\n================================")
print("MODEL PERFORMANCE")
print("================================")

print(
    f"Model Accuracy: {accuracy * 100:.2f}%"
)


# ===============================
# CLASSIFICATION REPORT
# ===============================

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)


# ===============================
# CONFUSION MATRIX
# ===============================

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        y_test,
        predictions
    )
)


# ===============================
# FEATURE IMPORTANCE
# ===============================

print("\n================================")
print("FEATURE IMPORTANCE")
print("================================")

# CalibratedClassifierCV stores
# the trained Random Forest models
# inside calibrated_classifiers_

try:

    importances = np.mean(
        [
            calibrated.estimator.feature_importances_
            for calibrated in model.calibrated_classifiers_
        ],
        axis=0
    )

    for feature, importance in zip(
        features,
        importances
    ):

        print(
            f"{feature}: "
            f"{importance * 100:.2f}%"
        )

except Exception as e:

    print(
        "Feature importance unavailable:",
        str(e)
    )


# ===============================
# CHECK CALIBRATED PROBABILITIES
# ===============================

print("\n================================")
print("CALIBRATED MODEL PROBABILITIES")
print("================================")

sample_probabilities = model.predict_proba(
    X_test.iloc[:10]
)

for i, probabilities in enumerate(
    sample_probabilities
):

    print(
        f"Sample {i + 1}: "
        f"{np.round(probabilities, 3)}"
    )


# ===============================
# SAVE MODEL
# ===============================

joblib.dump(
    model,
    "landslide_model.pkl"
)


# ===============================
# FINAL INFORMATION
# ===============================

print("\n================================")
print("MODEL SAVED")
print("================================")

print(
    "File: landslide_model.pkl"
)

print(
    "Features used:"
)

print(features)

print(
    "\nClasses learned:"
)

print(model.classes_)

print("\nDone.")