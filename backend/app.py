"""Flask API for the Landslide Early Warning System."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
import random
import time

import joblib
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "landslide_model.pkl"
METRICS_PATH = BASE_DIR / "model_metrics.json"
REPORTS_PATH = BASE_DIR / "hazard_reports.json"

FEATURES = ["rainfall", "soil_moisture", "slope", "historical_incidents"]
RISK_NAMES = {0: "LOW", 1: "MODERATE", 2: "HIGH"}

app = Flask(__name__)
CORS(app)

try:
    model = joblib.load(MODEL_PATH)
    print("✅ Landslide ML model loaded successfully")
except Exception as exc:
    model = None
    print(f"⚠️ Model could not be loaded: {exc}")

try:
    model_metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
except Exception:
    model_metrics = {
        "model": "Unavailable",
        "warning": "Train the model before relying on predictions.",
    }

try:
    emergency_alerts = []
except Exception:
    emergency_alerts = []

reports_lock = Lock()

# ---------------------------------------------------------------------------
# Sensor simulation layer
# ---------------------------------------------------------------------------
# Hardware is not available in the current prototype, so this produces a
# clearly-labelled simulated sensor stream. The API contract is intentionally
# the same one a future ESP32 gateway can use.
sensor_lock = Lock()
sensor_history = []
sensor_started_at = time.time()
SENSOR_HISTORY_LIMIT = 120


def _clamp(value, low, high):
    return max(low, min(high, value))


def generate_simulated_sensor_reading():
    """Create a believable changing sensor stream for the SIH demo.

    The scenario cycles through stable -> wetting -> instability -> recovery.
    These values are for UI/pipeline demonstration only and are NOT used to
    claim real-world sensor accuracy.
    """
    elapsed = int(time.time() - sensor_started_at)
    phase = (elapsed // 30) % 4

    profiles = [
        # rainfall, moisture, tilt, displacement, pore pressure
        (22, 42, 0.7, 0.3, 38),
        (55, 64, 1.4, 1.1, 52),
        (105, 82, 3.0, 4.6, 76),
        (40, 58, 1.0, 0.7, 45),
    ]
    rainfall, moisture, tilt, displacement, pore_pressure = profiles[phase]

    # Small noise prevents the dashboard from looking static.
    rainfall += random.uniform(-3, 3)
    moisture += random.uniform(-1.5, 1.5)
    tilt += random.uniform(-0.08, 0.08)
    displacement += random.uniform(-0.12, 0.12)
    pore_pressure += random.uniform(-2, 2)

    reading = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "device_id": "SIM-ZONE-01",
        "mode": "SIMULATION",
        "rainfall": round(_clamp(rainfall, 0, 1000), 1),
        "soil_moisture": round(_clamp(moisture, 0, 100), 1),
        "tilt": round(_clamp(tilt, 0, 90), 2),
        "ground_displacement": round(_clamp(displacement, 0, 100), 2),
        "pore_pressure": round(_clamp(pore_pressure, 0, 500), 1),
    }

    # Sensor-only early-warning state. This is deliberately transparent and
    # separate from the trained ML model until validated sensor labels exist.
    score = 0
    reasons = []
    if reading["rainfall"] >= 80:
        score += 2
        reasons.append("heavy rainfall")
    elif reading["rainfall"] >= 40:
        score += 1
        reasons.append("rising rainfall")
    if reading["soil_moisture"] >= 75:
        score += 2
        reasons.append("high soil moisture")
    elif reading["soil_moisture"] >= 55:
        score += 1
        reasons.append("increasing soil moisture")
    if reading["tilt"] >= 2.5:
        score += 2
        reasons.append("slope tilt change")
    elif reading["tilt"] >= 1.5:
        score += 1
        reasons.append("elevated tilt")
    if reading["ground_displacement"] >= 3:
        score += 2
        reasons.append("ground displacement")
    elif reading["ground_displacement"] >= 1:
        score += 1
        reasons.append("increasing ground movement")
    if reading["pore_pressure"] >= 70:
        score += 1
        reasons.append("high pore-water pressure")

    if score >= 6:
        sensor_risk = "CRITICAL"
    elif score >= 4:
        sensor_risk = "HIGH"
    elif score >= 2:
        sensor_risk = "MODERATE"
    else:
        sensor_risk = "LOW"

    reading["risk"] = sensor_risk
    reading["warning"] = bool(score >= 4)
    reading["reasons"] = reasons[:4]
    return reading


def get_latest_sensor_reading():
    with sensor_lock:
        if not sensor_history:
            sensor_history.append(generate_simulated_sensor_reading())
        return dict(sensor_history[-1])


def update_sensor_stream():
    reading = generate_simulated_sensor_reading()
    with sensor_lock:
        sensor_history.append(reading)
        del sensor_history[:-SENSOR_HISTORY_LIMIT]
    return reading


def clean_number(value, default=0.0) -> float:
    try:
        number = float(value)
        return number if np.isfinite(number) else default
    except (TypeError, ValueError):
        return default


def clamp_inputs(rainfall: float, soil_moisture: float, slope: float, history: float):
    # Reject clearly broken client values instead of silently feeding them to ML.
    if not 0 <= rainfall <= 1000:
        raise ValueError("rainfall must be between 0 and 1000 mm")
    if not 0 <= soil_moisture <= 100:
        raise ValueError("soil_moisture must be between 0 and 100 %")
    if not 0 <= slope <= 90:
        raise ValueError("slope must be between 0 and 90 degrees")
    if not 0 <= history <= 100:
        raise ValueError("historical_incidents must be between 0 and 100")


def risk_from_prediction(prediction) -> str:
    if isinstance(prediction, str):
        value = prediction.strip().upper()
        if value in {"LOW", "MODERATE", "HIGH"}:
            return value
        try:
            prediction = float(value)
        except ValueError:
            return "LOW"

    value = int(float(prediction))
    return RISK_NAMES.get(value, "HIGH" if value >= 2 else "LOW")


def probability_map(probabilities, classes) -> dict[str, float]:
    result = {"LOW": 0.0, "MODERATE": 0.0, "HIGH": 0.0}
    for cls, probability in zip(classes, probabilities):
        try:
            name = risk_from_prediction(cls)
            result[name] = max(0.0, float(probability) * 100.0)
        except Exception:
            continue

    total = sum(result.values())
    if total <= 0:
        return {"LOW": 100.0, "MODERATE": 0.0, "HIGH": 0.0}

    normalized = {key: value / total * 100 for key, value in result.items()}
    # Round while preserving a clean 100% total.
    rounded = {key: round(value, 2) for key, value in normalized.items()}
    correction = round(100.0 - sum(rounded.values()), 2)
    rounded["HIGH"] = round(rounded["HIGH"] + correction, 2)
    return rounded


def model_predict(rainfall, soil_moisture, slope, history):
    if model is None:
        raise RuntimeError("ML model is unavailable. Run backend/train-model.py first.")

    features = np.array([[rainfall, soil_moisture, slope, history]], dtype=float)
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    classes = getattr(model, "classes_", [0, 1, 2])
    risk = risk_from_prediction(prediction)
    probs = probability_map(probabilities, classes)
    confidence = probs[risk]

    return risk, probs, round(float(confidence), 2)


@app.get("/")
def home():
    return jsonify({
        "success": True,
        "message": "Landslide Early Warning API is running",
        "model_loaded": model is not None,
    })


@app.get("/health")
def health():
    return jsonify({
        "success": True,
        "status": "online",
        "model_loaded": model is not None,
        "model": model_metrics.get("model", "Unknown"),
    })


@app.get("/model-info")
def model_info():
    return jsonify({"success": True, **model_metrics})


@app.post("/predict")
def predict():
    try:
        data = request.get_json(silent=True) or {}
        rainfall = clean_number(data.get("rainfall"))
        soil_moisture = clean_number(data.get("soil_moisture"))
        slope = clean_number(data.get("slope"))
        historical_incidents = clean_number(data.get("historical_incidents"))
        clamp_inputs(rainfall, soil_moisture, slope, historical_incidents)

        risk, probabilities, confidence = model_predict(
            rainfall, soil_moisture, slope, historical_incidents
        )

        return jsonify({
            "success": True,
            "risk": risk,
            "confidence": confidence,
            "probabilities": probabilities,
            "source": "calibrated_extra_trees",
            "features": {
                "rainfall": rainfall,
                "soil_moisture": soil_moisture,
                "slope": slope,
                "historical_incidents": int(historical_incidents),
            },
            "model_quality": {
                "oof_accuracy": model_metrics.get("cross_validation", {}).get("oof_accuracy"),
                "oof_balanced_accuracy": model_metrics.get("cross_validation", {}).get("oof_balanced_accuracy"),
                "samples": model_metrics.get("samples"),
            },
        })
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        app.logger.exception("Prediction error")
        return jsonify({"success": False, "error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Sensor endpoints
# ---------------------------------------------------------------------------

@app.get("/api/sensor-data/latest")
def sensor_data_latest():
    return jsonify({
        "success": True,
        "mode": "SIMULATION",
        "hardware_ready": True,
        "data": get_latest_sensor_reading(),
    })


@app.get("/api/sensor-data/history")
def sensor_data_history():
    try:
        limit = max(1, min(int(request.args.get("limit", 30)), SENSOR_HISTORY_LIMIT))
    except (TypeError, ValueError):
        limit = 30

    with sensor_lock:
        data = [dict(item) for item in sensor_history[-limit:]]

    if not data:
        data = [get_latest_sensor_reading()]

    return jsonify({
        "success": True,
        "mode": "SIMULATION",
        "data": data,
    })


@app.post("/api/sensor-data")
def receive_sensor_data():
    """Hardware-compatible endpoint for a future ESP32 gateway."""
    try:
        data = request.get_json(silent=True) or {}
        required = ["rainfall", "soil_moisture", "tilt", "ground_displacement"]
        missing = [key for key in required if data.get(key) is None]
        if missing:
            return jsonify({"success": False, "error": f"Missing sensor fields: {', '.join(missing)}"}), 400

        reading = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "device_id": data.get("device_id", "ESP32-ZONE-01"),
            "mode": "HARDWARE",
            "rainfall": round(clean_number(data.get("rainfall")), 1),
            "soil_moisture": round(clean_number(data.get("soil_moisture")), 1),
            "tilt": round(clean_number(data.get("tilt")), 2),
            "ground_displacement": round(clean_number(data.get("ground_displacement")), 2),
            "pore_pressure": round(clean_number(data.get("pore_pressure")), 1),
        }
        if not 0 <= reading["rainfall"] <= 1000 or not 0 <= reading["soil_moisture"] <= 100:
            raise ValueError("Sensor values are outside supported ranges.")

        # Store hardware data; risk remains explicitly a sensor rule until
        # labelled sensor data is available to retrain the ML model.
        sensor_history.append(reading)
        del sensor_history[:-SENSOR_HISTORY_LIMIT]
        reading["risk"] = "UNASSESSED"
        reading["warning"] = False
        reading["reasons"] = []

        return jsonify({"success": True, "data": reading})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


# Background simulation tick. It keeps the dashboard stream moving even when
# nobody is making requests.
def _sensor_simulation_loop():
    while True:
        try:
            update_sensor_stream()
        except Exception:
            app.logger.exception("Sensor simulation error")
        time.sleep(3)


# ---------------------------------------------------------------------------
# Camera / hazard report endpoint
# ---------------------------------------------------------------------------
# The current project does not contain a trained computer-vision dataset.
# Therefore this endpoint validates and records the camera evidence, while
# classifying the written observation with a transparent keyword heuristic.
# It intentionally does NOT pretend that a photo alone is an ML prediction.

LANDSLIDE_TERMS = {
    "landslide", "mudslide", "rockfall", "rocks falling", "soil movement",
    "soil moved", "slope failure", "slope collapsed", "ground movement",
    "crack", "cracks", "fissure", "debris", "mud", "earth slipped",
}
HIGH_TERMS = {"collapsed", "collapse", "falling rocks", "rapid movement", "large crack", "evacuate"}
MODERATE_TERMS = {"seepage", "water seepage", "tilting", "erosion", "small crack", "saturated", "unstable"}


def analyse_description(description: str) -> dict:
    text = re.sub(r"[^a-z0-9\s]", " ", description.lower())
    text = re.sub(r"\s+", " ", text).strip()

    matched_landslide = sorted(term for term in LANDSLIDE_TERMS if term in text)
    matched_high = sorted(term for term in HIGH_TERMS if term in text)
    matched_moderate = sorted(term for term in MODERATE_TERMS if term in text)

    if matched_high or len(matched_landslide) >= 2:
        risk = "HIGH"
        confidence = 88
        condition = "Strong landslide warning indicators were described."
        assessment = "The observation contains multiple indicators associated with unstable ground. Treat the report as a high-priority field observation and verify it with current environmental data."
        reason = "Multiple high-risk ground-movement indicators were detected in the written observation."
    elif matched_landslide or matched_moderate:
        risk = "MODERATE"
        confidence = 78
        condition = "Potential ground-instability indicators were described."
        assessment = "The report contains an indicator that can be associated with slope instability. Cross-check rainfall, soil moisture and slope conditions before making an operational decision."
        reason = "One or more ground, drainage or erosion warning indicators were detected."
    else:
        risk = "LOW"
        confidence = 72
        condition = "No strong landslide-related warning indicator was identified from the written observation."
        assessment = "The written observation does not establish a clear landslide condition. Continue monitoring, especially during heavy rainfall or rapidly changing terrain conditions."
        reason = "No strong landslide warning indicators were identified in the written observation."

    precautions = [
        "Do not approach an unstable slope, falling-rock area or fresh ground cracks.",
        "Keep people and vehicles away from visibly changing terrain.",
        "Cross-check the report with rainfall, soil moisture and terrain information.",
        "Report urgent hazards to the appropriate local authorities or emergency service.",
    ]

    return {
        "risk": risk,
        "confidence": confidence,
        "detected_condition": condition,
        "assessment": assessment,
        "reason": reason,
        "precautions": precautions,
        "matched_indicators": matched_landslide + matched_high + matched_moderate,
        "source": "camera_evidence_plus_text_heuristic",
    }


@app.post("/analyze-image")
def analyze_image():
    try:
        image = request.files.get("image")
        description = (request.form.get("description") or "").strip()

        if image is None:
            return jsonify({"success": False, "error": "No image was uploaded."}), 400
        if not image.mimetype or not image.mimetype.startswith("image/"):
            return jsonify({"success": False, "error": "Only image files are accepted."}), 400
        if not description:
            return jsonify({"success": False, "error": "Please describe the observed hazard."}), 400

        result = analyse_description(description)
        return jsonify({"success": True, **result, "image_received": True, "image_name": image.filename})
    except Exception as exc:
        app.logger.exception("Image analysis error")
        return jsonify({"success": False, "error": str(exc)}), 500


@app.post("/emergency-alert")
def emergency_alert():
    try:
        data = request.get_json(silent=True) or {}
        latitude = clean_number(data.get("latitude"), np.nan)
        longitude = clean_number(data.get("longitude"), np.nan)
        if not np.isfinite(latitude) or not np.isfinite(longitude):
            raise ValueError("Valid latitude and longitude are required.")

        risk = str(data.get("risk", "UNKNOWN")).upper()
        alert = {
            "id": len(emergency_alerts) + 1,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "name": data.get("location_name", "Current Location"),
            },
            "risk": risk,
            "environment": {
                "rainfall": clean_number(data.get("rainfall")),
                "soil_moisture": clean_number(data.get("soil_moisture")),
                "slope": clean_number(data.get("slope")),
                "historical_incidents": int(clean_number(data.get("historical_incidents"))),
            },
            "status": "EMERGENCY ALERT RECORDED",
        }
        emergency_alerts.append(alert)
        return jsonify({
            "success": True,
            "message": "Emergency alert recorded successfully.",
            "alert": alert,
        })
    except Exception as exc:
        app.logger.exception("Emergency alert error")
        return jsonify({"success": False, "error": str(exc)}), 400


# Start the simulator when the module is loaded. Flask debug reloader is off by default.
_sensor_thread = __import__("threading").Thread(target=_sensor_simulation_loop, daemon=True, name="sensor-simulator")
_sensor_thread.start()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
