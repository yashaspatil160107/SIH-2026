from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ============================================================
# LOAD MODEL
# ============================================================

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "landslide_model.pkl"
)

try:
    model = joblib.load(MODEL_PATH)
    print("✅ Landslide ML model loaded successfully")
except Exception as e:
    model = None
    print("⚠️ Model could not be loaded:", e)


# ============================================================
# EMERGENCY ALERT STORAGE
# ============================================================

emergency_alerts = []


# ============================================================
# HELPER
# ============================================================

def clean_number(value, default=0):
    try:
        number = float(value)

        if not np.isfinite(number):
            return default

        return number

    except Exception:
        return default


# ============================================================
# PREDICTION
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.get_json(silent=True) or {}

        rainfall = clean_number(
            data.get("rainfall"),
            0
        )

        soil_moisture = clean_number(
            data.get("soil_moisture"),
            0
        )

        slope = clean_number(
            data.get("slope"),
            0
        )

        historical_incidents = clean_number(
            data.get("historical_incidents"),
            0
        )

        print("\n==============================")
        print("AI PREDICTION REQUEST")
        print("==============================")

        print("Rainfall:", rainfall)
        print("Soil Moisture:", soil_moisture)
        print("Slope:", slope)
        print("Historical:", historical_incidents)

        # ====================================================
        # MODEL UNAVAILABLE FALLBACK
        # ====================================================

        if model is None:

            print("⚠️ ML model unavailable - using rule-based fallback")

            # Simple fallback risk calculation
            score = 0

            if rainfall > 60:
                score += 40
            elif rainfall > 20:
                score += 20

            if soil_moisture > 70:
                score += 30
            elif soil_moisture > 45:
                score += 15

            if slope > 30:
                score += 20
            elif slope > 25:
                score += 10

            if historical_incidents > 0:
                score += 10

            if score >= 60:
                risk = "HIGH"

            elif score >= 30:
                risk = "MODERATE"

            else:
                risk = "LOW"

            if risk == "HIGH":
                probabilities = {
                    "LOW": 5.0,
                    "MODERATE": 15.0,
                    "HIGH": 80.0
                }

            elif risk == "MODERATE":
                probabilities = {
                    "LOW": 15.0,
                    "MODERATE": 70.0,
                    "HIGH": 15.0
                }

            else:
                probabilities = {
                    "LOW": 80.0,
                    "MODERATE": 15.0,
                    "HIGH": 5.0
                }

            return jsonify({
                "success": True,
                "risk": risk,
                "confidence": probabilities[risk],
                "probabilities": probabilities,
                "source": "fallback"
            })


        # ====================================================
        # ML MODEL INPUT
        # ====================================================

        features = np.array([[
            rainfall,
            soil_moisture,
            slope,
            historical_incidents
        ]])

        # ====================================================
        # MODEL PREDICTION
        # ====================================================

        prediction = model.predict(features)[0]

        print("Raw model prediction:", prediction)

        # ====================================================
        # CONVERT MODEL OUTPUT TO RISK
        # ====================================================

        if isinstance(prediction, str):

            prediction_string = prediction.upper().strip()

            if prediction_string in [
                "HIGH",
                "MODERATE",
                "LOW"
            ]:
                risk = prediction_string

            elif prediction_string in [
                "2",
                "2.0"
            ]:
                risk = "HIGH"

            elif prediction_string in [
                "1",
                "1.0"
            ]:
                risk = "MODERATE"

            else:
                risk = "LOW"

        else:

            numeric_prediction = int(
                float(prediction)
            )

            if numeric_prediction >= 2:
                risk = "HIGH"

            elif numeric_prediction == 1:
                risk = "MODERATE"

            else:
                risk = "LOW"


        # ====================================================
        # PROBABILITIES
        # ====================================================

        probabilities = {
            "LOW": 0.0,
            "MODERATE": 0.0,
            "HIGH": 0.0
        }

        if hasattr(model, "predict_proba"):

            try:

                probability_array = model.predict_proba(
                    features
                )[0]

                classes = model.classes_

                for cls, probability in zip(
                    classes,
                    probability_array
                ):

                    cls_string = str(cls).upper().strip()

                    if cls_string in [
                        "LOW",
                        "MODERATE",
                        "HIGH"
                    ]:

                        probabilities[
                            cls_string
                        ] = float(probability * 100)

                    elif cls_string in [
                        "0",
                        "0.0"
                    ]:

                        probabilities[
                            "LOW"
                        ] = float(probability * 100)

                    elif cls_string in [
                        "1",
                        "1.0"
                    ]:

                        probabilities[
                            "MODERATE"
                        ] = float(probability * 100)

                    elif cls_string in [
                        "2",
                        "2.0"
                    ]:

                        probabilities[
                            "HIGH"
                        ] = float(probability * 100)

            except Exception as probability_error:

                print(
                    "Probability error:",
                    probability_error
                )


        # ====================================================
        # SAFETY CHECK
        # ====================================================

        probability_total = sum(
            probabilities.values()
        )

        if probability_total <= 0:

            if risk == "HIGH":

                probabilities = {
                    "LOW": 5.0,
                    "MODERATE": 15.0,
                    "HIGH": 80.0
                }

            elif risk == "MODERATE":

                probabilities = {
                    "LOW": 15.0,
                    "MODERATE": 70.0,
                    "HIGH": 15.0
                }

            else:

                probabilities = {
                    "LOW": 80.0,
                    "MODERATE": 15.0,
                    "HIGH": 5.0
                }


        # ====================================================
        # NORMALIZE
        # ====================================================

        total = sum(
            probabilities.values()
        )

        if total > 0:

            probabilities = {
                key: round(
                    (value / total) * 100,
                    2
                )

                for key, value
                in probabilities.items()
            }


        confidence = probabilities.get(
            risk,
            max(probabilities.values())
        )


        print("Final risk:", risk)
        print("Probabilities:", probabilities)
        print("Confidence:", confidence)

        print("==============================\n")


        return jsonify({

            "success": True,

            "risk": risk,

            "confidence": round(
                confidence,
                2
            ),

            "probabilities": probabilities,

            "source": "ml_model"

        })


    except Exception as e:

        print(
            "❌ Prediction error:",
            str(e)
        )

        return jsonify({

            "success": False,

            "error": str(e),

            "risk": "LOW",

            "confidence": 0,

            "probabilities": {
                "LOW": 100,
                "MODERATE": 0,
                "HIGH": 0
            }

        }), 500


# ============================================================
# EMERGENCY ALERT
# ============================================================

@app.route("/emergency-alert", methods=["POST"])
def emergency_alert():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        latitude = clean_number(
            data.get("latitude")
        )

        longitude = clean_number(
            data.get("longitude")
        )

        risk = str(
            data.get(
                "risk",
                "UNKNOWN"
            )
        ).upper()

        rainfall = clean_number(
            data.get("rainfall")
        )

        soil_moisture = clean_number(
            data.get("soil_moisture")
        )

        slope = clean_number(
            data.get("slope")
        )

        historical_incidents = int(
            clean_number(
                data.get(
                    "historical_incidents"
                )
            )
        )

        location_name = data.get(
            "location_name",
            "Current Location"
        )

        alert = {

            "id": len(
                emergency_alerts
            ) + 1,

            "timestamp":
                datetime.now().isoformat(),

            "location": {

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "name":
                    location_name
            },

            "risk":
                risk,

            "environment": {

                "rainfall":
                    rainfall,

                "soil_moisture":
                    soil_moisture,

                "slope":
                    slope,

                "historical_incidents":
                    historical_incidents
            },

            "status":
                "EMERGENCY ALERT RECORDED"

        }

        emergency_alerts.append(
            alert
        )

        print("\n🚨 ==============================")
        print("🚨 EMERGENCY ALERT RECEIVED")
        print("🚨 ==============================")
        print("Location:", location_name)
        print("Latitude:", latitude)
        print("Longitude:", longitude)
        print("Risk:", risk)
        print("Rainfall:", rainfall)
        print("Soil Moisture:", soil_moisture)
        print("Slope:", slope)
        print(
            "Historical Incidents:",
            historical_incidents
        )
        print("🚨 ==============================\n")

        return jsonify({

            "success": True,

            "message":
                "Emergency alert recorded successfully.",

            "alert": alert

        })


    except Exception as e:

        print(
            "❌ Emergency alert error:",
            str(e)
        )

        return jsonify({

            "success": False,

            "error": str(e)

        }), 500


# ============================================================
# VIEW RECORDED ALERTS
# ============================================================

@app.route("/emergency-alerts", methods=["GET"])
def get_emergency_alerts():

    return jsonify({

        "success": True,

        "count":
            len(emergency_alerts),

        "alerts":
            emergency_alerts

    })


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({

        "status":
            "Landslide Early Warning Backend Online",

        "predict_endpoint":
            "/predict",

        "emergency_endpoint":
            "/emergency-alert"

    })


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )