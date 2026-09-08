import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# ==========================================
# LOAD DATASET
# ==========================================

data = pd.read_csv("dataset.csv")

print("================================")
print("LANDSLIDE ML MODEL TRAINING")
print("================================")

print("Dataset shape:", data.shape)

# ==========================================
# FEATURES
# ==========================================

features = [
    "rainfall",
    "soil_moisture",
    "slope",
    "historical_incidents"
]

target = "landslide"

# ==========================================
# CHECK REQUIRED COLUMNS
# ==========================================

missing_columns = [
    column
    for column in features + [target]
    if column not in data.columns
]

if missing_columns:
    raise ValueError(
        f"Missing columns in dataset: {missing_columns}"
    )

# ==========================================
# CLEAN DATA
# ==========================================

X = data[features].copy()
y = data[target].copy()

X = X.apply(
    pd.to_numeric,
    errors="coerce"
)

y = pd.to_numeric(
    y,
    errors="coerce"
)

valid_rows = (
    X.notnull().all(axis=1)
    & y.notnull()
)

X = X.loc[valid_rows].reset_index(drop=True)

y = y.loc[valid_rows].reset_index(drop=True)

y = y.astype(int)

# ==========================================
# VALIDATE TARGET CLASSES
# ==========================================

valid_classes = {0, 1, 2}

actual_classes = set(
    y.unique()
)

if not actual_classes.issubset(
    valid_classes
):
    raise ValueError(
        "Target must contain only 0, 1 and 2."
    )

print("\nClass distribution:")

print(
    y.value_counts()
    .sort_index()
)

# ==========================================
# TRAIN / TEST SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n================================")
print("TRAIN / TEST")
print("================================")

print(
    "Training samples:",
    len(X_train)
)

print(
    "Testing samples:",
    len(X_test)
)

# ==========================================
# RANDOM FOREST
# ==========================================

model = RandomForestClassifier(

    n_estimators=400,

    max_depth=8,

    min_samples_leaf=2,

    min_samples_split=4,

    max_features="sqrt",

    class_weight="balanced",

    random_state=42,

    n_jobs=-1
)

# ==========================================
# TRAIN MODEL
# ==========================================

print("\n================================")
print("TRAINING MODEL")
print("================================")

model.fit(
    X_train,
    y_train
)

print(
    "Training completed."
)

# ==========================================
# TEST MODEL
# ==========================================

predictions = model.predict(
    X_test
)

probabilities = model.predict_proba(
    X_test
)

# ==========================================
# ACCURACY
# ==========================================

accuracy = accuracy_score(
    y_test,
    predictions
)

print("\n================================")
print("MODEL PERFORMANCE")
print("================================")

print(
    f"Accuracy: {accuracy * 100:.2f}%"
)

# ==========================================
# CLASSIFICATION REPORT
# ==========================================

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        predictions,
        labels=[0, 1, 2],
        target_names=[
            "LOW",
            "MODERATE",
            "HIGH"
        ],
        zero_division=0
    )
)

# ==========================================
# CONFUSION MATRIX
# ==========================================

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1, 2]
    )
)

# ==========================================
# FEATURE IMPORTANCE
# ==========================================

print("\n================================")
print("FEATURE IMPORTANCE")
print("================================")

feature_importances = (
    model.feature_importances_
)

for feature, importance in zip(
    features,
    feature_importances
):

    print(
        f"{feature}: "
        f"{importance * 100:.2f}%"
    )

# ==========================================
# RISK FUNCTION
# ==========================================

risk_names = {
    0: "LOW",
    1: "MODERATE",
    2: "HIGH"
}

# ==========================================
# REALISTIC TEST CASES
# ==========================================

print("\n================================")
print("REALISTIC TEST CASES")
print("================================")

test_cases = pd.DataFrame(

    [
        # ----------------------------------
        # LOW
        # ----------------------------------
        [
            2,
            20,
            5,
            0
        ],

        # ----------------------------------
        # LOW / EARLY WARNING
        # ----------------------------------
        [
            18,
            40,
            20,
            0
        ],

        # ----------------------------------
        # MODERATE
        # ----------------------------------
        [
            30,
            50,
            25,
            1
        ],

        # ----------------------------------
        # MODERATE / HIGH BORDER
        # ----------------------------------
        [
            50,
            70,
            35,
            1
        ],

        # ----------------------------------
        # HIGH
        # ----------------------------------
        [
            80,
            85,
            45,
            1
        ],

        # ----------------------------------
        # YOUR PREVIOUS REAL LOCATION
        # ----------------------------------
        [
            2.6,
            30.4,
            14.7,
            2
        ]
    ],

    columns=features
)

test_predictions = model.predict(
    test_cases
)

test_probabilities = model.predict_proba(
    test_cases
)

for i in range(
    len(test_cases)
):

    prediction = int(
        test_predictions[i]
    )

    probs = test_probabilities[i]

    print(
        f"\nTest Case {i + 1}"
    )

    print(
        "Rainfall:",
        test_cases.iloc[i][
            "rainfall"
        ]
    )

    print(
        "Soil Moisture:",
        test_cases.iloc[i][
            "soil_moisture"
        ]
    )

    print(
        "Slope:",
        test_cases.iloc[i][
            "slope"
        ]
    )

    print(
        "Historical Incidents:",
        test_cases.iloc[i][
            "historical_incidents"
        ]
    )

    print(
        "Prediction:",
        risk_names.get(
            prediction,
            "UNKNOWN"
        )
    )

    print("Probabilities:")

    for class_number, probability in zip(
        model.classes_,
        probs
    ):

        class_name = risk_names.get(
            int(class_number),
            "UNKNOWN"
        )

        print(
            f"{class_name}: "
            f"{probability * 100:.1f}%"
        )

# ==========================================
# SAVE MODEL
# ==========================================

joblib.dump(
    model,
    "landslide_model.pkl"
)

print("\n================================")
print("MODEL SAVED")
print("================================")

print(
    "File: landslide_model.pkl"
)

print(
    "Features:",
    features
)

print(
    "Classes:",
    model.classes_
)

print(
    "\nTraining completed successfully."
)

print(
    "Restart Flask after this training."
)