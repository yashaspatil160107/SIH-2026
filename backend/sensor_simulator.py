import time
import math
import random
from datetime import datetime


# ============================================================
# LANDSLIDE SENSOR SIMULATOR
# ============================================================
#
# DEMO ONLY
#
# This simulates how physical IoT sensors could behave.
#
# Normal → Warning → High → Critical → Normal
#
# In future, this file can be replaced by ESP32 sensor data.
# ============================================================


START_TIME = time.time()


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def get_simulated_sensor_data():

    elapsed = time.time() - START_TIME

    # Repeat the complete demo every 120 seconds
    cycle = elapsed % 120

    # Small natural variation
    wave = math.sin(elapsed / 4)

    # ========================================================
    # PHASE 1 — NORMAL
    # 0–30 seconds
    # ========================================================

    if cycle < 30:

        phase = "NORMAL"

        rainfall = 8 + wave * 2 + random.uniform(-1, 1)
        soil_moisture = 38 + wave * 2 + random.uniform(-1, 1)
        tilt = 0.4 + wave * 0.03
        ground_movement = 0.3 + wave * 0.05
        pore_pressure = 25 + wave * 1


    # ========================================================
    # PHASE 2 — WARNING
    # 30–60 seconds
    # ========================================================

    elif cycle < 60:

        phase = "WARNING"

        progress = (cycle - 30) / 30

        rainfall = 25 + progress * 45 + wave * 2
        soil_moisture = 48 + progress * 20 + wave * 2
        tilt = 0.7 + progress * 0.8
        ground_movement = 0.7 + progress * 1.5
        pore_pressure = 35 + progress * 20


    # ========================================================
    # PHASE 3 — HIGH RISK
    # 60–90 seconds
    # ========================================================

    elif cycle < 90:

        phase = "HIGH"

        progress = (cycle - 60) / 30

        rainfall = 70 + progress * 35 + wave * 3
        soil_moisture = 70 + progress * 12
        tilt = 1.5 + progress * 1.3
        ground_movement = 2.2 + progress * 2.5
        pore_pressure = 55 + progress * 20


    # ========================================================
    # PHASE 4 — CRITICAL
    # 90–105 seconds
    # ========================================================

    elif cycle < 105:

        phase = "CRITICAL"

        progress = (cycle - 90) / 15

        rainfall = 105 + progress * 35
        soil_moisture = 82 + progress * 10
        tilt = 2.8 + progress * 1.2
        ground_movement = 4.7 + progress * 4
        pore_pressure = 75 + progress * 15


    # ========================================================
    # PHASE 5 — RECOVERY
    # 105–120 seconds
    # ========================================================

    else:

        phase = "RECOVERY"

        progress = (cycle - 105) / 15

        rainfall = 120 - progress * 90
        soil_moisture = 90 - progress * 40
        tilt = 4.0 - progress * 2.8
        ground_movement = 8.0 - progress * 6
        pore_pressure = 90 - progress * 50


    # ========================================================
    # CLEAN VALUES
    # ========================================================

    rainfall = round(clamp(rainfall, 0, 200), 2)

    soil_moisture = round(
        clamp(soil_moisture, 0, 100),
        2
    )

    tilt = round(
        clamp(tilt, 0, 10),
        2
    )

    ground_movement = round(
        clamp(ground_movement, 0, 20),
        2
    )

    pore_pressure = round(
        clamp(pore_pressure, 0, 150),
        2
    )


    # ========================================================
    # EARLY WARNING LOGIC
    # ========================================================

    warning_score = 0

    if rainfall >= 70:
        warning_score += 25
    elif rainfall >= 30:
        warning_score += 10

    if soil_moisture >= 75:
        warning_score += 25
    elif soil_moisture >= 55:
        warning_score += 10

    if tilt >= 2.5:
        warning_score += 20
    elif tilt >= 1.2:
        warning_score += 10

    if ground_movement >= 4:
        warning_score += 20
    elif ground_movement >= 1.5:
        warning_score += 10

    if pore_pressure >= 75:
        warning_score += 10
    elif pore_pressure >= 50:
        warning_score += 5


    if warning_score >= 70:

        risk = "CRITICAL"

        warning = (
            "Rapid multi-sensor instability detected."
        )

    elif warning_score >= 45:

        risk = "HIGH"

        warning = (
            "Increasing slope instability detected."
        )

    elif warning_score >= 20:

        risk = "MODERATE"

        warning = (
            "Environmental conditions are becoming unstable."
        )

    else:

        risk = "LOW"

        warning = (
            "No significant instability detected."
        )


    return {

        "timestamp":
            datetime.now().isoformat(),

        "mode":
            "SIMULATION",

        "phase":
            phase,

        "rainfall":
            rainfall,

        "soil_moisture":
            soil_moisture,

        "tilt":
            tilt,

        "ground_displacement":
            ground_movement,

        "pore_pressure":
            pore_pressure,

        "risk":
            risk,

        "warning":
            warning,

        "warning_score":
            warning_score
    }