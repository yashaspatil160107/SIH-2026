import React from "react";
import { useLocation } from "react-router-dom";
import "./Hazardous.css";

function Hazardous() {
  const routerLocation = useLocation();

  const {
    location,
    weatherData,
    slope,
    riskLabel,
    causes,
    precautions,
  } = routerLocation.state || {};

  // LOCATION-BASED HAZARDS
  const getLocationHazards = () => {
    const detectedHazards = [];

    const rainfall = Number(weatherData?.rainfall || 0);
    const soilMoisture = Number(weatherData?.soilMoisture || 0);
    const slopeValue = Number(slope || 0);

    // Rainfall
    if (rainfall >= 50) {
      detectedHazards.push({
        icon: "🌧️",
        title: "Heavy Rainfall",
        description:
          `Heavy rainfall of ${rainfall} mm has been detected. Intense rainfall can saturate the soil and increase slope instability.`,
        risk: "High",
      });
    } else if (rainfall >= 20) {
      detectedHazards.push({
        icon: "🌧️",
        title: "Elevated Rainfall",
        description:
          `Rainfall of ${rainfall} mm has been recorded. Continued rainfall may increase landslide susceptibility.`,
        risk: "Moderate",
      });
    }

    // Soil Moisture
    if (soilMoisture >= 70) {
      detectedHazards.push({
        icon: "💧",
        title: "High Soil Moisture",
        description:
          `Soil moisture is ${soilMoisture}%. Excess water can increase soil weight and reduce slope stability.`,
        risk: "High",
      });
    } else if (soilMoisture >= 45) {
      detectedHazards.push({
        icon: "💧",
        title: "Elevated Soil Moisture",
        description:
          `Soil moisture is ${soilMoisture}%. Increasing moisture may weaken the soil structure.`,
        risk: "Moderate",
      });
    }

    // Slope
    if (slopeValue >= 35) {
      detectedHazards.push({
        icon: "⛰️",
        title: "Very Steep Slope",
        description:
          `The terrain slope is ${slopeValue}°. Very steep terrain has increased potential for slope failure.`,
        risk: "High",
      });
    } else if (slopeValue >= 20) {
      detectedHazards.push({
        icon: "⛰️",
        title: "Steep Slope",
        description:
          `The terrain slope is ${slopeValue}°. Steeper terrain can become unstable during rainfall.`,
        risk: "Moderate",
      });
    }

    // Historical incidents
    const hasHistoricalIncident = causes?.some((cause) => {
      const text = cause.toLowerCase();

      return (
        text.includes("previous") ||
        text.includes("historical") ||
        text.includes("incident") ||
        text.includes("landslide")
      );
    });

    if (hasHistoricalIncident) {
      detectedHazards.push({
        icon: "⚠️",
        title: "Previous Landslide Activity",
        description:
          "Previous landslide incidents have been recorded around this selected location. Historical activity indicates increased local susceptibility.",
        risk: "High",
      });
    }

    // Other location-specific causes
    if (causes && causes.length > 0) {
      causes.forEach((cause) => {
        const causeText = cause.toLowerCase();

        if (
          causeText.includes("previous") ||
          causeText.includes("historical") ||
          causeText.includes("incident") ||
          causeText.includes("landslide")
        ) {
          return;
        }

        let icon = "⚠️";

        if (causeText.includes("rain")) {
          icon = "🌧️";
        } else if (causeText.includes("soil")) {
          icon = "💧";
        } else if (causeText.includes("slope")) {
          icon = "⛰️";
        } else if (causeText.includes("deforest")) {
          icon = "🌳";
        } else if (
          causeText.includes("construction") ||
          causeText.includes("road") ||
          causeText.includes("human")
        ) {
          icon = "🏗️";
        }

        detectedHazards.push({
          icon,
          title: "Location-Specific Hazard",
          description: cause,
          risk: "Moderate",
        });
      });
    }

    return detectedHazards;
  };

  const hazards = getLocationHazards();

  return (
    <div className="hazardous-page">

      {/* HEADER */}
      <div className="hazardous-header">
        <div>
          <h1>⚠️ Hazardous Conditions</h1>

          <p>
            Location-based landslide hazard analysis
          </p>
        </div>

        <div className="hazard-status">
          🟢 Monitoring Active
        </div>
      </div>

      {/* CURRENT RISK DATA */}
      {location && (
        <section className="hazard-intro">

          <div className="intro-icon">
            {riskLabel === "HIGH"
              ? "🔴"
              : riskLabel === "MODERATE"
              ? "🟠"
              : "🟢"}
          </div>

          <div>
            <h2>
              Current Risk: {riskLabel || "--"}
            </h2>

            <p>
              Monitoring location:{" "}
              <strong>
                {location.name || "Selected Location"}
              </strong>
            </p>

            <p>
              Latitude:{" "}
              {location.latitude?.toFixed(4)}
              {" | "}
              Longitude:{" "}
              {location.longitude?.toFixed(4)}
            </p>
          </div>

        </section>
      )}

      {/* CURRENT ENVIRONMENTAL DATA */}
      {location && (
        <section className="hazard-grid">

          <div className="hazard-card">
            <div className="hazard-card-top">
              <span className="hazard-icon">
                🌧️
              </span>
            </div>

            <h3>Rainfall</h3>

            <p>
              {weatherData?.rainfall !== undefined
                ? `${weatherData.rainfall} mm`
                : "--"}
            </p>

            <p>
              Last 24 hours
            </p>
          </div>

          <div className="hazard-card">
            <div className="hazard-card-top">
              <span className="hazard-icon">
                💧
              </span>
            </div>

            <h3>Soil Moisture</h3>

            <p>
              {weatherData?.soilMoisture !== undefined
                ? `${weatherData.soilMoisture}%`
                : "--"}
            </p>

            <p>
              Current level
            </p>
          </div>

          <div className="hazard-card">
            <div className="hazard-card-top">
              <span className="hazard-icon">
                ⛰️
              </span>
            </div>

            <h3>Slope</h3>

            <p>
              {slope !== null &&
              slope !== undefined
                ? `${slope}°`
                : "--"}
            </p>

            <p>
              Terrain angle
            </p>
          </div>

          <div className="hazard-card">
            <div className="hazard-card-top">
              <span className="hazard-icon">
                🚨
              </span>

              <span
                className={`hazard-risk ${
                  riskLabel === "HIGH"
                    ? "risk-high"
                    : riskLabel === "MODERATE"
                    ? "risk-moderate"
                    : ""
                }`}
              >
                {riskLabel || "--"}
              </span>
            </div>

            <h3>Current Risk</h3>

            <p>
              {riskLabel === "HIGH"
                ? "Critical landslide risk"
                : riskLabel === "MODERATE"
                ? "Elevated conditions"
                : riskLabel === "LOW"
                ? "Normal conditions"
                : "Waiting for data"}
            </p>
          </div>

        </section>
      )}

      {/* INTRODUCTION */}
      <section className="hazard-intro">

        <div className="intro-icon">
          🌋
        </div>

        <div>
          <h2>
            Understanding Landslide Hazards
          </h2>

          <p>
            Landslides can occur when natural or
            human-induced factors weaken the
            stability of a slope. Rainfall, soil
            moisture, terrain slope and previous
            landslide activity are considered when
            assessing the selected location.
          </p>
        </div>

      </section>

      {/* LOCATION-BASED HAZARDS */}
      <section className="hazard-grid">

        {hazards.length > 0 ? (

          hazards.map((hazard, index) => (

            <div
              className="hazard-card"
              key={index}
            >

              <div className="hazard-card-top">

                <span className="hazard-icon">
                  {hazard.icon}
                </span>

                <span
                  className={`hazard-risk ${
                    hazard.risk === "High"
                      ? "risk-high"
                      : "risk-moderate"
                  }`}
                >
                  {hazard.risk}
                </span>

              </div>

              <h3>
                {hazard.title}
              </h3>

              <p>
                {hazard.description}
              </p>

            </div>

          ))

        ) : (

          <div className="hazard-card">

            <div className="hazard-card-top">

              <span className="hazard-icon">
                ✅
              </span>

              <span className="hazard-risk">
                Low
              </span>

            </div>

            <h3>
              No Significant Hazard Detected
            </h3>

            <p>
              Current environmental conditions at
              this location do not indicate any
              significant hazardous condition.
            </p>

          </div>

        )}

      </section>

      {/* DETECTED CAUSES */}
      {location && (
        <section className="warning-signs">

          <h2>
            ⚠️ Possible Causes at Selected Location
          </h2>

          <div className="warning-list">

            {causes && causes.length > 0 ? (

              causes.map((cause, index) => (

                <div
                  className="warning-item"
                  key={index}
                >
                  <span>
                    ⚠️
                  </span>

                  <p>
                    {cause}
                  </p>
                </div>

              ))

            ) : (

              <div className="warning-item">

                <span>
                  ℹ️
                </span>

                <p>
                  No major environmental trigger
                  detected from the available data.
                </p>

              </div>

            )}

          </div>

        </section>
      )}

      {/* WARNING SIGNS */}
      <section className="warning-signs">

        <h2>
          🚨 Warning Signs of a Possible Landslide
        </h2>

        <div className="warning-list">

          <div className="warning-item">
            <span>裂</span>
            <p>
              New cracks appearing on roads,
              walls or the ground.
            </p>
          </div>

          <div className="warning-item">
            <span>🌳</span>
            <p>
              Trees, poles or fences beginning
              to tilt unexpectedly.
            </p>
          </div>

          <div className="warning-item">
            <span>💦</span>
            <p>
              Sudden changes in drainage or
              unusual water seepage.
            </p>
          </div>

          <div className="warning-item">
            <span>🪨</span>
            <p>
              Falling rocks, soil movement or
              small slope failures.
            </p>
          </div>

          <div className="warning-item">
            <span>🌧️</span>
            <p>
              Continuous heavy rainfall followed
              by ground instability.
            </p>
          </div>

          <div className="warning-item">
            <span>🔊</span>
            <p>
              Unusual cracking, rumbling or
              movement sounds from a slope.
            </p>
          </div>

        </div>

      </section>

      {/* DYNAMIC PRECAUTIONS */}
      {location && (
        <section className="safety-section">

          <h2>
            🛡️ Recommended Precautions
          </h2>

          <div className="safety-grid">

            {precautions &&
            precautions.length > 0 ? (

              precautions.map(
                (precaution, index) => (

                  <div
                    className="safety-card"
                    key={index}
                  >

                    <span>
                      {index + 1}️⃣
                    </span>

                    <h3>
                      Safety Action
                    </h3>

                    <p>
                      {precaution}
                    </p>

                  </div>
                )
              )

            ) : (

              <div className="safety-card">

                <span>
                  🛡️
                </span>

                <h3>
                  Continue Monitoring
                </h3>

                <p>
                  Continue monitoring environmental
                  conditions and official warnings.
                </p>

              </div>

            )}

          </div>

        </section>
      )}

      {/* GENERAL SAFETY ACTIONS */}
      <section className="safety-section">

        <h2>
          🛡️ What To Do During Hazardous Conditions
        </h2>

        <div className="safety-grid">

          <div className="safety-card">

            <span>1️⃣</span>

            <h3>
              Move Away
            </h3>

            <p>
              Stay away from steep slopes,
              unstable ground and areas showing
              cracks or falling rocks.
            </p>

          </div>

          <div className="safety-card">

            <span>2️⃣</span>

            <h3>
              Monitor Alerts
            </h3>

            <p>
              Keep checking rainfall, risk levels
              and official emergency warnings.
            </p>

          </div>

          <div className="safety-card">

            <span>3️⃣</span>

            <h3>
              Follow Evacuation Routes
            </h3>

            <p>
              If authorities issue an evacuation
              order, move toward the designated
              safe zone immediately.
            </p>

          </div>

          <div className="safety-card">

            <span>4️⃣</span>

            <h3>
              Stay Connected
            </h3>

            <p>
              Keep your phone charged and maintain
              communication with emergency services
              and family members.
            </p>

          </div>

        </div>

      </section>

      {/* FOOTER NOTE */}
      <div className="hazard-footer">

        <p>
          ⚠️ This page is part of the SIH 26001
          Landslide Early Warning System prototype.
        </p>

      </div>

    </div>
  );
}

export default Hazardous;