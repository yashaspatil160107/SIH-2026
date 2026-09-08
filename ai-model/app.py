from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle

app = Flask(__name__)
CORS(app)

# Load trained AI model
with open("landslide_model.pkl", "rb") as file:
    model = pickle.load(file)


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        rainfall = float(data.get("rainfall", 0))
        soil_moisture = float(data.get("soil_moisture", 0))
        slope = float(data.get("slope", 0))
        historical_incidents = int(
            data.get("historical_incidents", 0)
        )

        # AI prediction
        prediction = model.predict([
            [
                rainfall,
                soil_moisture,
                slope,
                historical_incidents,
            ]
        ])[0]

        # Prediction probability
        probabilities = model.predict_proba([
            [
                rainfall,
                soil_moisture,
                slope,
                historical_incidents,
            ]
        ])[0]

        probability = float(
            probabilities[1] * 100
        )

        # Risk classification
        if probability >= 60:
            risk = "HIGH"
        elif probability >= 30:
            risk = "MODERATE"
        else:
            risk = "LOW"

        return jsonify({
            "prediction": int(prediction),
            "probability": round(
                probability, 2
            ),
            "risk": risk,
        })

    except Exception as error:
        return jsonify({
            "error": str(error)
        }), 400


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Landslide AI API is running"
    })


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )