import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import Hazardous from "./Hazardous";
import ReportHazard from "./ReportHazard";

import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ===============================
// Historical Landslide Dataset
// ===============================

const historicalLandslides = [
  {
    location: "Gangtok, Sikkim",
    latitude: 27.3389,
    longitude: 88.6065,
    year: 2024,
    severity: "High",
  },
  {
    location: "Rangpo, Sikkim",
    latitude: 27.1767,
    longitude: 88.5339,
    year: 2023,
    severity: "High",
  },
  {
    location: "Aizawl, Mizoram",
    latitude: 23.7271,
    longitude: 92.7176,
    year: 2023,
    severity: "Medium",
  },
  {
    location: "Shillong, Meghalaya",
    latitude: 25.5788,
    longitude: 91.8933,
    year: 2022,
    severity: "High",
  },
  {
    location: "Cherrapunji, Meghalaya",
    latitude: 25.2841,
    longitude: 91.7211,
    year: 2024,
    severity: "High",
  },
  {
    location: "Kohima, Nagaland",
    latitude: 25.6751,
    longitude: 94.1086,
    year: 2022,
    severity: "Medium",
  },
];

// ===============================
// Safe Zones
// ===============================

const safeZones = [
  {
    name: "Gangtok Emergency Safe Zone",
    region: "Sikkim",
    latitude: 27.3314,
    longitude: 88.6138,
  },
  {
    name: "Rangpo Emergency Safe Zone",
    region: "Sikkim",
    latitude: 27.1775,
    longitude: 88.5332,
  },
  {
    name: "Aizawl Emergency Safe Zone",
    region: "Mizoram",
    latitude: 23.7367,
    longitude: 92.7173,
  },
  {
    name: "Shillong Emergency Safe Zone",
    region: "Meghalaya",
    latitude: 25.5788,
    longitude: 91.8933,
  },
  {
    name: "Cherrapunji Emergency Safe Zone",
    region: "Meghalaya",
    latitude: 25.2841,
    longitude: 91.7211,
  },
  {
    name: "Kohima Emergency Safe Zone",
    region: "Nagaland",
    latitude: 25.6751,
    longitude: 94.1086,
  },
  {
    name: "Yelahanka Emergency Safe Zone",
    region: "Karnataka",
    latitude: 13.1007,
    longitude: 77.5963,
  },
  {
    name: "Bengaluru Emergency Safe Zone",
    region: "Karnataka",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    name: "Guwahati Emergency Safe Zone",
    region: "Assam",
    latitude: 26.1445,
    longitude: 91.7362,
  },
  {
    name: "Dehradun Emergency Safe Zone",
    region: "Uttarakhand",
    latitude: 30.3165,
    longitude: 78.0322,
  },
  {
    name: "Shimla Emergency Safe Zone",
    region: "Himachal Pradesh",
    latitude: 31.1048,
    longitude: 77.1734,
  },
];

// ===============================
// Map Location Updater
// ===============================

function LocationUpdater({ location }) {
  const map = useMap();

  useEffect(() => {
    if (
      location &&
      location.latitude !== undefined &&
      location.longitude !== undefined
    ) {
      map.setView(
        [location.latitude, location.longitude],
        12
      );
    }
  }, [location, map]);

  return null;
}

// ===============================
// DASHBOARD
// ===============================

function Dashboard() {
  const navigate = useNavigate();

  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);

  const [weatherData, setWeatherData] = useState(null);
  const [slope, setSlope] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const [historicalData, setHistoricalData] = useState([]);

  const [showHistorical] = useState(true);

  const [alertSent, setAlertSent] = useState(false);

  // NEW
  const [emergencyLoading, setEmergencyLoading] =
    useState(false);

  const [emergencyResponse, setEmergencyResponse] =
    useState(null);

  // ===============================
  // AI MODEL STATE
  // ===============================

  const [aiPrediction, setAiPrediction] =
    useState(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiAttempted, setAiAttempted] =
    useState(false);

  // ===============================
  // Haversine Distance
  // ===============================

  const calculateDistance = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {
    const R = 6371;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  };

  // ===============================
  // Find Historical Landslides
  // ===============================

  const findHistoricalLandslides =
    useCallback((latitude, longitude) => {
      const nearbyRecords =
        historicalLandslides.filter((record) => {
          const distance =
            calculateDistance(
              latitude,
              longitude,
              record.latitude,
              record.longitude
            );

          return distance <= 50;
        });

      setHistoricalData(nearbyRecords);

      return nearbyRecords;
    }, []);

  // ===============================
  // Find Nearest Safe Zone
  // ===============================

  const getNearestSafeZone =
    useCallback(
      (latitude, longitude) => {
        if (
          latitude === undefined ||
          longitude === undefined
        ) {
          return null;
        }

        let nearest = null;
        let nearestDistance = Infinity;

        safeZones.forEach((zone) => {
          const distance =
            calculateDistance(
              latitude,
              longitude,
              zone.latitude,
              zone.longitude
            );

          if (distance < nearestDistance) {
            nearestDistance = distance;

            nearest = {
              ...zone,
              distance,
            };
          }
        });

        return nearest;
      },
      []
    );

  const nearestSafeZone = location
    ? getNearestSafeZone(
        location.latitude,
        location.longitude
      )
    : null;

  // ===============================
  // Estimated Travel Time
  // ===============================

  const getEstimatedTravelTime = (
    distance
  ) => {
    if (
      distance === null ||
      distance === undefined
    ) {
      return null;
    }

    const speed = 20;

    const minutes = Math.max(
      1,
      Math.round((distance / speed) * 60)
    );

    return minutes;
  };

  const estimatedTravelTime =
    nearestSafeZone
      ? getEstimatedTravelTime(
          nearestSafeZone.distance
        )
      : null;

  // ===============================
  // Slope Calculation
  // ===============================

  const calculateSlope = async (
    lat,
    lon
  ) => {
    try {
      const offset = 0.001;

      const lats =
        `${lat},${lat + offset},${lat},${lat - offset},${lat}`;

      const lons =
        `${lon},${lon},${lon + offset},${lon},${lon - offset}`;

      const res = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`
      );

      const data = await res.json();

      if (
        data?.elevation &&
        data.elevation.length === 5
      ) {
        const [
          center,
          north,
          east,
          south,
          west,
        ] = data.elevation;

        const dist = 111.32;

        const dz_dx =
          (east - west) / (2 * dist);

        const dz_dy =
          (north - south) / (2 * dist);

        const slopeDeg = (
          Math.atan(
            Math.sqrt(
              dz_dx ** 2 +
                dz_dy ** 2
            )
          ) *
          (180 / Math.PI)
        ).toFixed(1);

        setSlope(slopeDeg);

        return Number(slopeDeg);
      }

      setSlope("12.5");

      return 12.5;
    } catch (err) {
      console.warn(
        "Slope fetch fallback:",
        err
      );

      setSlope("14.0");

      return 14.0;
    }
  };

  // ===============================
  // AI PREDICTION
  // ===============================

  const getAIPrediction =
    useCallback(
      async (
        rainfall,
        soilMoisture,
        slopeValue,
        historicalIncidents
      ) => {
        try {
          setAiLoading(true);
          setAiAttempted(true);
          setAiPrediction(null);

          const response = await fetch(
            "http://127.0.0.1:5000/predict",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                rainfall:
                  Number(rainfall) || 0,

                soil_moisture:
                  Number(soilMoisture) || 0,

                slope:
                  Number(slopeValue) || 0,

                historical_incidents:
                  Number(
                    historicalIncidents
                  ) || 0,
              }),
            }
          );

          const data =
            await response.json();

          console.log(
            "AI Prediction:",
            data
          );

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "AI prediction request failed"
            );
          }

          const rawProbabilities =
            data?.probabilities || {};

          const low = Number(
            rawProbabilities.LOW ?? 0
          );

          const moderate = Number(
            rawProbabilities.MODERATE ?? 0
          );

          const high = Number(
            rawProbabilities.HIGH ?? 0
          );

          const safeLow =
            Number.isFinite(low)
              ? Math.max(0, low)
              : 0;

          const safeModerate =
            Number.isFinite(moderate)
              ? Math.max(0, moderate)
              : 0;

          const safeHigh =
            Number.isFinite(high)
              ? Math.max(0, high)
              : 0;

          const totalProbability =
            safeLow +
            safeModerate +
            safeHigh;

          let normalizedLow = 0;
          let normalizedModerate = 0;
          let normalizedHigh = 0;

          if (totalProbability > 0) {
            normalizedLow =
              (safeLow /
                totalProbability) *
              100;

            normalizedModerate =
              (safeModerate /
                totalProbability) *
              100;

            normalizedHigh =
              (safeHigh /
                totalProbability) *
              100;
          }

          const probabilityList = [
            normalizedLow,
            normalizedModerate,
            normalizedHigh,
          ];

          const calculatedConfidence =
            Math.max(
              ...probabilityList
            );

          const cleanedConfidence =
            Number.isFinite(
              calculatedConfidence
            )
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    calculatedConfidence
                  )
                )
              : null;

          const cleanedRisk =
            data?.risk
              ? String(
                  data.risk
                ).toUpperCase()
              : null;

          setAiPrediction({
            ...data,

            risk: cleanedRisk,

            confidence:
              cleanedConfidence,

            probabilities: {
              LOW: normalizedLow,
              MODERATE:
                normalizedModerate,
              HIGH: normalizedHigh,
            },
          });
        } catch (error) {
          console.error(
            "AI prediction error:",
            error
          );

          setAiPrediction(null);
        } finally {
          setAiLoading(false);
        }
      },
      []
    );

  // ===============================
  // Weather Data
  // ===============================

  const fetchLocationData =
    useCallback(
      async (
        latitude,
        longitude
      ) => {
        try {
          setLoadingData(true);

          setAiPrediction(null);
          setAiAttempted(false);

          const nearbyHistorical =
            historicalLandslides.filter(
              (record) => {
                const distance =
                  calculateDistance(
                    latitude,
                    longitude,
                    record.latitude,
                    record.longitude
                  );

                return distance <= 50;
              }
            );

          setHistoricalData(
            nearbyHistorical
          );

          const historicalIncidents =
            nearbyHistorical.length;

          const url =
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&hourly=rain,soil_moisture_0_to_1cm,temperature_2m` +
            `&past_hours=24` +
            `&forecast_hours=1` +
            `&timezone=auto`;

          const response =
            await fetch(url);

          if (!response.ok) {
            throw new Error(
              "Weather request failed"
            );
          }

          const data =
            await response.json();

          const rainValues =
            data.hourly?.rain || [];

          const rainfall =
            rainValues
              .slice(0, 24)
              .reduce(
                (sum, value) =>
                  sum + (value || 0),
                0
              );

          const moistureValues =
            data.hourly
              ?.soil_moisture_0_to_1cm ||
            [];

          const latestMoisture =
            moistureValues.length > 0
              ? moistureValues[
                  moistureValues.length - 1
                ]
              : undefined;

          const temperatureValues =
            data.hourly?.temperature_2m ||
            [];

          const latestTemperature =
            temperatureValues.length > 0
              ? temperatureValues[
                  temperatureValues.length - 1
                ]
              : 25;

          const temperatureValue =
            Number(
              latestTemperature
            ) || 25;

          const rainfallValue =
            Number(
              rainfall.toFixed(1)
            );

          const moistureValue =
            latestMoisture !==
              undefined &&
            latestMoisture !== null
              ? Number(
                  (
                    latestMoisture * 100
                  ).toFixed(1)
                )
              : 0;

          setWeatherData({
            rainfall:
              rainfallValue.toFixed(1),

            soilMoisture:
              latestMoisture !==
                undefined &&
              latestMoisture !== null
                ? moistureValue.toFixed(1)
                : "--",

            temperature:
              temperatureValue.toFixed(1),
          });

          const slopeValue =
            await calculateSlope(
              latitude,
              longitude
            );

          await getAIPrediction(
            rainfallValue,
            moistureValue,
            slopeValue,
            historicalIncidents
          );
        } catch (err) {
          console.error(
            "Sensor fetch error:",
            err
          );

          setWeatherData(null);
          setSlope(null);
          setAiPrediction(null);
        } finally {
          setLoadingData(false);
        }
      },
      [getAIPrediction]
    );

  // ===============================
  // UPDATE DATA
  // ===============================

  useEffect(() => {
    if (
      location?.latitude !== undefined &&
      location?.longitude !== undefined
    ) {
      fetchLocationData(
        location.latitude,
        location.longitude
      );

      findHistoricalLandslides(
        location.latitude,
        location.longitude
      );
    }
  }, [
    location,
    fetchLocationData,
    findHistoricalLandslides,
  ]);

  // ===============================
  // LIVE GPS TRACKING
  // ===============================

  useEffect(() => {
    let watchId;

    if (tracking) {
      if (!navigator.geolocation) {
        setError(
          "GPS is not supported by this browser."
        );

        return;
      }

      watchId =
        navigator.geolocation.watchPosition(
          (position) => {
            const lat =
              position.coords.latitude;

            const lon =
              position.coords.longitude;

            setLocation({
              latitude: lat,
              longitude: lon,
            });

            setError("");

            setMessage(
              "Live GPS coordinates detected"
            );
          },
          (err) => {
            console.error(err);

            setError(
              "Unable to retrieve GPS coordinates."
            );
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          }
        );
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(
          watchId
        );
      }
    };
  }, [tracking]);

  // ===============================
  // DETECT LOCATION
  // ===============================

  const detectLocation = () => {
    setError("");

    setTracking(true);

    setMessage(
      "Detecting your location..."
    );
  };

  const stopTracking = () => {
    setTracking(false);

    setMessage(
      "Live GPS tracking stopped"
    );
  };

  // ===============================
  // REVERSE GEOCODER
  // ===============================

  const reverseGeocodeName =
    async (lat, lon) => {
      try {
        const revRes =
          await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );

        const revData =
          await revRes.json();

        const addr =
          revData.address;

        if (addr) {
          const place =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.suburb ||
            addr.state_district ||
            addr.county ||
            addr.state;

          const state = addr.state
            ? `, ${addr.state}`
            : "";

          if (place) {
            return `${place}${state}`;
          }
        }
      } catch (e) {
        console.warn(
          "Reverse geocode failed:",
          e
        );
      }

      return null;
    };

  // ===============================
  // SEARCH LOCATION
  // ===============================

  const searchLocation = async () => {
    const query = search.trim();

    if (!query) {
      setMessage(
        "Please enter a location or 6-digit PIN."
      );

      return;
    }

    try {
      setMessage(
        "Searching nationwide registry..."
      );

      setError("");

      const isPincode =
        /^\d{6}$/.test(query);

      let searchedLocation = null;

      if (isPincode) {
        let accurateName = "";

        try {
          const postRes =
            await fetch(
              `https://api.postalpincode.in/pincode/${query}`
            );

          const postData =
            await postRes.json();

          if (
            postData?.[0]?.Status ===
              "Success" &&
            postData[0].PostOffice
              ?.length > 0
          ) {
            const offices =
              postData[0].PostOffice;

            const office =
              offices.find(
                (o) =>
                  o.BranchType ===
                    "Head Post Office" ||
                  o.BranchType ===
                    "Sub Post Office"
              ) || offices[0];

            accurateName =
              `${office.Name}, ${office.District}, ${office.State}`;

            try {
              const geoRes =
                await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(
                    `${office.District}, ${office.State}, India`
                  )}`
                );

              const geoData =
                await geoRes.json();

              if (
                geoData &&
                geoData.length > 0
              ) {
                searchedLocation = {
                  latitude:
                    parseFloat(
                      geoData[0].lat
                    ),

                  longitude:
                    parseFloat(
                      geoData[0].lon
                    ),

                  name:
                    accurateName,
                };
              }
            } catch (
              geoErr
            ) {
              console.warn(
                "District geocoding failed:",
                geoErr
              );
            }
          }
        } catch (err) {
          console.warn(
            "Postal API error:",
            err
          );
        }

        if (!searchedLocation) {
          try {
            const osmRes =
              await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&postalcode=${query}&country=India&limit=1`
              );

            const osmData =
              await osmRes.json();

            if (
              osmData &&
              osmData.length > 0
            ) {
              const lat =
                parseFloat(
                  osmData[0].lat
                );

              const lon =
                parseFloat(
                  osmData[0].lon
                );

              const resolvedName =
                (await reverseGeocodeName(
                  lat,
                  lon
                )) ||
                accurateName ||
                `PIN ${query}`;

              searchedLocation = {
                latitude: lat,
                longitude: lon,
                name: resolvedName,
              };
            }
          } catch (
            osmErr
          ) {
            console.warn(
              "OSM Postal error:",
              osmErr
            );
          }
        }

        if (!searchedLocation) {
          try {
            const zipRes =
              await fetch(
                `https://api.zippopotam.us/IN/${query}`
              );

            if (zipRes.ok) {
              const zipData =
                await zipRes.json();

              if (
                zipData.places &&
                zipData.places.length > 0
              ) {
                const place =
                  zipData.places[0];

                searchedLocation = {
                  latitude:
                    parseFloat(
                      place.latitude
                    ),

                  longitude:
                    parseFloat(
                      place.longitude
                    ),

                  name:
                    `${place["place name"]}, ${place.state}`,
                };
              }
            }
          } catch (
            zipErr
          ) {
            console.warn(
              "Zippo fallback error:",
              zipErr
            );
          }
        }
      } else {
        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&q=${encodeURIComponent(
              query
            )}&limit=1`
          );

        const data =
          await response.json();

        if (
          data &&
          data.length > 0
        ) {
          searchedLocation = {
            latitude:
              parseFloat(
                data[0].lat
              ),

            longitude:
              parseFloat(
                data[0].lon
              ),

            name: data[0]
              .display_name
              .split(",")
              .slice(0, 2)
              .join(", "),
          };
        }
      }

      if (searchedLocation) {
        setTracking(false);

        setLocation({
          latitude:
            searchedLocation.latitude,

          longitude:
            searchedLocation.longitude,

          name:
            searchedLocation.name,
        });

        setMessage(
          `Found: ${searchedLocation.name}`
        );
      } else {
        setMessage(
          "Location not found."
        );
      }
    } catch (err) {
      console.error(
        "Search execution failure:",
        err
      );

      setMessage(
        "Search failed. Check your network."
      );
    }
  };

  // ===============================
  // ENVIRONMENTAL VALUES
  // ===============================

  const rainNum =
    parseFloat(
      weatherData?.rainfall || 0
    );

  const moistureNum =
    parseFloat(
      weatherData?.soilMoisture || 0
    );

  const slopeNum =
    parseFloat(
      slope || 0
    );

  // ===============================
  // HISTORICAL RISK
  // ===============================

  const nearestHistoricalDistance =
    location &&
    historicalData.length > 0
      ? Math.min(
          ...historicalData.map(
            (record) =>
              calculateDistance(
                location.latitude,
                location.longitude,
                record.latitude,
                record.longitude
              )
          )
        )
      : null;

  const hasHighSeverityHistorical =
    historicalData.some(
      (record) =>
        record.severity === "High"
    );

  const historicalRisk =
    historicalData.length === 0
      ? "NONE"
      : hasHighSeverityHistorical
      ? "HIGH"
      : "MODERATE";

  const mostRecentHistoricalYear =
    historicalData.length > 0
      ? Math.max(
          ...historicalData.map(
            (record) =>
              record.year
          )
        )
      : null;

  const hasHistoricalRisk =
    historicalData.length > 0;

  const historicalRiskBoost =
    hasHistoricalRisk;

  // ===============================
  // CURRENT ENVIRONMENTAL RISK
  // ===============================

  const isHighHistoricalRisk =
    hasHighSeverityHistorical &&
    nearestHistoricalDistance !== null &&
    nearestHistoricalDistance <= 50;

  const isHighRisk =
    rainNum > 60 ||
    moistureNum > 70 ||
    (slopeNum > 30 &&
      rainNum > 25) ||
    isHighHistoricalRisk;

  const isModerateRisk =
    !isHighRisk &&
    (
      rainNum > 20 ||
      moistureNum > 45 ||
      slopeNum > 25 ||
      historicalRiskBoost
    );

  const environmentalRisk =
    isHighRisk
      ? "HIGH"
      : isModerateRisk
      ? "MODERATE"
      : "LOW";

  // ===============================
  // COMBINED AI + ENVIRONMENTAL RISK
  // ===============================

  const aiRisk =
    aiPrediction?.risk
      ? String(
          aiPrediction.risk
        ).toUpperCase()
      : null;

  let combinedRisk =
    environmentalRisk;

  if (aiRisk === "HIGH") {
    combinedRisk = "HIGH";
  } else if (
    aiRisk === "MODERATE" &&
    environmentalRisk !== "HIGH"
  ) {
    combinedRisk = "MODERATE";
  }

  // ===============================
  // RISK LABEL
  // ===============================

  const riskLabel =
    !weatherData
      ? "--"
      : combinedRisk;

  // ===============================
  // CAUSES
  // ===============================

  const causes = [];

  if (rainNum > 20) {
    causes.push(
      `Heavy or prolonged rainfall (${rainNum} mm in the last 24 hours)`
    );
  }

  if (moistureNum > 45) {
    causes.push(
      `High soil moisture (${moistureNum}%) may reduce ground stability`
    );
  }

  if (slopeNum > 25) {
    causes.push(
      `Steep terrain detected (${slopeNum}° slope)`
    );
  }

  if (hasHistoricalRisk) {
    causes.push(
      "Previous landslide incidents were recorded within 50 km"
    );
  }

  if (causes.length === 0) {
    causes.push(
      "No major environmental trigger detected from the available data."
    );
  }

  // ===============================
  // PRECAUTIONS
  // ===============================

  const precautions = [];

  if (combinedRisk === "HIGH") {
    precautions.push(
      "Evacuate immediately from steep or unstable slopes."
    );

    precautions.push(
      "Move toward the recommended safe zone."
    );

    precautions.push(
      "Avoid roads, valleys and areas showing cracks or falling rocks."
    );
  } else if (
    combinedRisk === "MODERATE"
  ) {
    precautions.push(
      "Monitor rainfall and slope conditions closely."
    );

    precautions.push(
      "Keep emergency supplies and communication devices ready."
    );

    precautions.push(
      "Be prepared to move toward the recommended safe zone if conditions worsen."
    );
  } else {
    precautions.push(
      "Continue monitoring environmental conditions."
    );

    precautions.push(
      "Avoid unnecessary travel through steep or unstable terrain."
    );
  }

  // ============================================================
  // NEW EMERGENCY ALERT SYSTEM
  // ============================================================
  //
  // FLOW:
  //
  // 1. User clicks emergency button.
  // 2. Browser requests fresh/high-accuracy GPS.
  // 3. Current location is updated.
  // 4. Current location is cross-checked against:
  //      - rainfall
  //      - soil moisture
  //      - slope
  //      - historical incidents
  //      - AI prediction
  //      - final combined risk
  // 5. Complete emergency packet is sent to Flask.
  // 6. Flask records the emergency alert.
  // 7. Frontend displays backend response.
  //
  // ============================================================

  const sendEmergencyAlert = async () => {
    if (emergencyLoading) {
      return;
    }

    setEmergencyLoading(true);
    setEmergencyResponse(null);
    setAlertSent(false);
    setError("");

    setMessage(
      "🚨 Emergency activated. Getting your current GPS location..."
    );

    try {
      // ========================================================
      // STEP 1: GET FRESH CURRENT GPS
      // ========================================================

      if (!navigator.geolocation) {
        throw new Error(
          "GPS is not supported by this browser."
        );
      }

      const currentPosition =
        await new Promise(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000,
              }
            );
          }
        );

      const currentLatitude =
        currentPosition.coords.latitude;

      const currentLongitude =
        currentPosition.coords.longitude;

      // ========================================================
      // STEP 2: UPDATE CURRENT LOCATION
      // ========================================================

      setLocation((previous) => ({
        latitude:
          currentLatitude,

        longitude:
          currentLongitude,

        name:
          previous?.name ||
          "Current GPS Location",
      }));

      // ========================================================
      // STEP 3: CROSS-CHECK HISTORICAL DATA
      // ========================================================

      const currentHistorical =
        historicalLandslides.filter(
          (record) => {
            const distance =
              calculateDistance(
                currentLatitude,
                currentLongitude,
                record.latitude,
                record.longitude
              );

            return distance <= 50;
          }
        );

      setHistoricalData(
        currentHistorical
      );

      const currentHistoricalCount =
        currentHistorical.length;

      // ========================================================
      // STEP 4: FETCH CURRENT ENVIRONMENTAL DATA
      // ========================================================

      setMessage(
        "📡 GPS acquired. Cross-checking current environmental conditions..."
      );

      let currentRainfall = rainNum;
      let currentMoisture = moistureNum;
      let currentSlope = slopeNum;
      let currentTemperature =
        Number(
          weatherData?.temperature || 25
        );

      try {
        const emergencyWeatherUrl =
          `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${currentLatitude}` +
          `&longitude=${currentLongitude}` +
          `&hourly=rain,soil_moisture_0_to_1cm,temperature_2m` +
          `&past_hours=24` +
          `&forecast_hours=1` +
          `&timezone=auto`;

        const weatherResponse =
          await fetch(
            emergencyWeatherUrl
          );

        if (weatherResponse.ok) {
          const emergencyWeather =
            await weatherResponse.json();

          const rainValues =
            emergencyWeather.hourly?.rain ||
            [];

          currentRainfall =
            Number(
              rainValues
                .slice(0, 24)
                .reduce(
                  (sum, value) =>
                    sum +
                    (Number(value) || 0),
                  0
                ).toFixed(1)
            );

          const moistureValues =
            emergencyWeather.hourly
              ?.soil_moisture_0_to_1cm ||
            [];

          if (
            moistureValues.length > 0
          ) {
            const latest =
              moistureValues[
                moistureValues.length - 1
              ];

            currentMoisture =
              Number(
                (
                  Number(latest) * 100
                ).toFixed(1)
              );
          }

          const temperatureValues =
            emergencyWeather.hourly
              ?.temperature_2m ||
            [];

          if (
            temperatureValues.length > 0
          ) {
            currentTemperature =
              Number(
                temperatureValues[
                  temperatureValues.length - 1
                ]
              ) || 25;
          }
        }
      } catch (weatherError) {
        console.warn(
          "Emergency weather refresh failed. Using latest dashboard values.",
          weatherError
        );
      }

      // ========================================================
      // STEP 5: FRESH SLOPE
      // ========================================================

      try {
        currentSlope =
          await calculateSlope(
            currentLatitude,
            currentLongitude
          );
      } catch (slopeError) {
        console.warn(
          "Emergency slope refresh failed.",
          slopeError
        );
      }

      // ========================================================
      // STEP 6: CROSS-CHECK ENVIRONMENTAL RISK
      // ========================================================

      const emergencyHistoricalHigh =
        currentHistorical.some(
          (record) =>
            record.severity === "High"
        );

      const emergencyHistoricalDistance =
        currentHistorical.length > 0
          ? Math.min(
              ...currentHistorical.map(
                (record) =>
                  calculateDistance(
                    currentLatitude,
                    currentLongitude,
                    record.latitude,
                    record.longitude
                  )
              )
            )
          : null;

      const emergencyHighHistoricalRisk =
        emergencyHistoricalHigh &&
        emergencyHistoricalDistance !== null &&
        emergencyHistoricalDistance <= 50;

      const emergencyEnvironmentalRisk =
        currentRainfall > 60 ||
        currentMoisture > 70 ||
        (currentSlope > 30 &&
          currentRainfall > 25) ||
        emergencyHighHistoricalRisk
          ? "HIGH"
          : currentRainfall > 20 ||
            currentMoisture > 45 ||
            currentSlope > 25 ||
            currentHistoricalCount > 0
          ? "MODERATE"
          : "LOW";

      // ========================================================
      // STEP 7: ASK BACKEND AI MODEL AGAIN
      // ========================================================

      setMessage(
        "🤖 Cross-checking ML prediction with current conditions..."
      );

      let emergencyAIRisk = null;
      let emergencyAIConfidence = 0;
      let emergencyProbabilities = {
        LOW: 0,
        MODERATE: 0,
        HIGH: 0,
      };

      try {
        const aiResponse =
          await fetch(
            "http://127.0.0.1:5000/predict",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                rainfall:
                  currentRainfall,

                soil_moisture:
                  currentMoisture,

                slope:
                  Number(
                    currentSlope
                  ) || 0,

                historical_incidents:
                  currentHistoricalCount,
              }),
            }
          );

        const aiData =
          await aiResponse.json();

        if (aiResponse.ok) {
          emergencyAIRisk =
            aiData?.risk
              ? String(
                  aiData.risk
                ).toUpperCase()
              : null;

          emergencyAIConfidence =
            Number(
              aiData?.confidence || 0
            );

          emergencyProbabilities =
            aiData?.probabilities || {
              LOW: 0,
              MODERATE: 0,
              HIGH: 0,
            };
        }
      } catch (aiError) {
        console.warn(
          "Emergency AI cross-check failed:",
          aiError
        );
      }

      // ========================================================
      // STEP 8: FINAL CROSS-CHECKED RISK
      // ========================================================

      let emergencyFinalRisk =
        emergencyEnvironmentalRisk;

      if (emergencyAIRisk === "HIGH") {
        emergencyFinalRisk = "HIGH";
      } else if (
        emergencyAIRisk ===
          "MODERATE" &&
        emergencyEnvironmentalRisk !==
          "HIGH"
      ) {
        emergencyFinalRisk =
          "MODERATE";
      }

      // ========================================================
      // STEP 9: FIND NEAREST SAFE ZONE
      // ========================================================

      const emergencySafeZone =
        getNearestSafeZone(
          currentLatitude,
          currentLongitude
        );

      // ========================================================
      // STEP 10: REVERSE GEOCODE CURRENT LOCATION
      // ========================================================

      let currentLocationName =
        "Current GPS Location";

      try {
        const reverseName =
          await reverseGeocodeName(
            currentLatitude,
            currentLongitude
          );

        if (reverseName) {
          currentLocationName =
            reverseName;
        }
      } catch (geocodeError) {
        console.warn(
          "Emergency reverse geocoding failed:",
          geocodeError
        );
      }

      // ========================================================
      // STEP 11: SEND COMPLETE EMERGENCY PACKET TO FLASK
      // ========================================================

      setMessage(
        "🚨 Sending verified emergency alert to monitoring backend..."
      );

      const emergencyPayload = {
        latitude:
          currentLatitude,

        longitude:
          currentLongitude,

        location_name:
          currentLocationName,

        risk:
          emergencyFinalRisk,

        environmental_risk:
          emergencyEnvironmentalRisk,

        ai_risk:
          emergencyAIRisk,

        ai_confidence:
          emergencyAIConfidence,

        ai_probabilities:
          emergencyProbabilities,

        rainfall:
          currentRainfall,

        soil_moisture:
          currentMoisture,

        slope:
          Number(
            currentSlope
          ) || 0,

        temperature:
          currentTemperature,

        historical_incidents:
          currentHistoricalCount,

        historical_high_severity:
          emergencyHistoricalHigh,

        nearest_historical_distance:
          emergencyHistoricalDistance,

        safe_zone:
          emergencySafeZone
            ? {
                name:
                  emergencySafeZone.name,

                distance:
                  emergencySafeZone.distance,

                latitude:
                  emergencySafeZone.latitude,

                longitude:
                  emergencySafeZone.longitude,
              }
            : null,

        source:
          "Landslide Early Warning System",
      };

      console.log(
        "🚨 Emergency Payload:",
        emergencyPayload
      );

      const backendResponse =
        await fetch(
          "http://127.0.0.1:5000/emergency-alert",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              emergencyPayload
            ),
          }
        );

      const backendData =
        await backendResponse.json();

      if (!backendResponse.ok) {
        throw new Error(
          backendData?.error ||
            "Emergency backend request failed."
        );
      }

      // ========================================================
      // STEP 12: SUCCESS RESPONSE
      // ========================================================

      setAlertSent(true);

      setEmergencyResponse(
        backendData
      );

      setMessage(
        `🚨 Emergency alert recorded successfully for ${currentLocationName}.`
      );

      // Keep success indicator visible
      // for 5 seconds.
      setTimeout(() => {
        setAlertSent(false);
      }, 5000);
    } catch (error) {
      console.error(
        "Emergency alert failed:",
        error
      );

      if (
        error?.code === 1
      ) {
        setError(
          "GPS permission denied. Please allow location access and try again."
        );
      } else if (
        error?.code === 2
      ) {
        setError(
          "Unable to determine your current GPS location."
        );
      } else if (
        error?.code === 3
      ) {
        setError(
          "GPS request timed out. Please try again."
        );
      } else {
        setError(
          error?.message ||
            "Emergency alert could not be recorded."
        );
      }

      setMessage(
        "❌ Emergency alert process failed."
      );
    } finally {
      setEmergencyLoading(false);
    }
  };

  // ===============================
  // GO TO SAFE ZONE
  // ===============================

  const goToSafeZone = () => {
    if (!nearestSafeZone) {
      setMessage(
        "Safe zone information is unavailable."
      );

      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${nearestSafeZone.latitude},${nearestSafeZone.longitude}`,
      "_blank"
    );
  };

  // ===============================
  // CONFIDENCE DISPLAY
  // ===============================

  const confidenceValue =
    aiPrediction?.confidence;

  const confidenceText =
    confidenceValue !== null &&
    confidenceValue !== undefined &&
    Number.isFinite(
      Number(confidenceValue)
    )
      ? `${Number(
          confidenceValue
        ).toFixed(1)}%`
      : "N/A";

  // ===============================
  // PROBABILITY DISPLAY
  // ===============================

  const lowProbability =
    Number(
      aiPrediction?.probabilities
        ?.LOW || 0
    );

  const moderateProbability =
    Number(
      aiPrediction?.probabilities
        ?.MODERATE || 0
    );

  const highProbability =
    Number(
      aiPrediction?.probabilities
        ?.HIGH || 0
    );

  // ===============================
  // RETURN DASHBOARD
  // ===============================

  return (
    <div className="dashboard">

      {/* HEADER */}
        
      <header className="header">

        <div>
          <h3>
            🌧️ Landslide Early Warning System
          </h3>

          <p> 
            SIH 26001 • Prototype Dashboard
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >

          <button
            onClick={() =>
              navigate("/report-hazard")
            }
          >
            📸 Report Hazard
          </button>

          <button
            onClick={() =>
              navigate("/hazardous", {
                state: {
                  location,
                  weatherData,
                  slope,
                  riskLabel,
                  causes,
                  precautions,
                },
              })
            }
          >
            ⚠️ Hazardous Conditions
          </button>

          <div className="online">
            🟢 System Online
          </div>

        </div>

      </header>
        {/* 🌍 FUTURISTIC EARTH HERO */}

      <section className="earth-hero">

        <div className="earth-info">

          <div className="earth-status">
            <span className="status-dot"></span>
            LIVE PLANETARY MONITORING
          </div>

          <h1>
            LANDSLIDE
            <br />
            MONITORING
          </h1>

          <p>
            AI-powered terrain intelligence &amp;
            real-time hazard detection
          </p>

        </div>

        <div className="earth-system">

          <div className="earth-glow"></div>

          <div className="orbit orbit-1"></div>
          <div className="orbit orbit-2"></div>
          <div className="orbit orbit-3"></div>

          <div className="earth">
            <div className="earth-surface"></div>
            <div className="earth-shine"></div>
          </div>

          <div className="earth-ring ring-back"></div>
          <div className="earth-ring ring-front"></div>

        </div>

      </section>

      {/* CURRENT LOCATION */}

      <section className="location">

        <h2>
          📍Current Target
        </h2>

        <div className="location-info">

          <div>
            <span>
              Latitude
            </span>

            <strong>
              {location
                ? location.latitude.toFixed(4)
                : "--"}
            </strong>
          </div>

          <div>
            <span>
              Longitude
            </span>

            <strong>
              {location
                ? location.longitude.toFixed(4)
                : "--"}
            </strong>
          </div>

          {!tracking ? (
            <button
              onClick={detectLocation}
            >
              📍Detect My Location
            </button>
          ) : (
            <button
              onClick={stopTracking}
            >
              ⏹️ Stop Live Tracking
            </button>
          )}

        </div>

        {/* SEARCH */}

        <div
          className="search-box"
          style={{
            marginTop: "14px",
            display: "flex",
            gap: "8px",
          }}
        >

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                searchLocation();
              }
            }}
            placeholder="Enter Place or Indian Pincode (e.g. 495001, 560064, Gangtok)..."
            style={{
              flex: 1,
              padding: "8px",
            }}
          />

          <button
            onClick={searchLocation}
          >
            🔍 Search
          </button>

        </div>

        {tracking && (
          <p className="status-text">
            🟢 Live GPS tracking active
          </p>
        )}

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        {message && (
          <p className="status-text">
            {message}
          </p>
        )}

      </section>

      {/* METRIC CARDS */}

      <section className="cards">

        {/* 🌧️ RAINFALL */}

        <div className="card rainfall-card">

          {location && (
            <div className="rain-animation">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}

          <h3>🌧️ Rainfall</h3>

          <strong>
            {loadingData
              ? "..."
              : weatherData
              ? `${weatherData.rainfall} mm`
              : "--"}
          </strong>

          <p>
            Last 24 hours
          </p>

        </div>


        {/* 💧 SOIL MOISTURE */}

        <div className="card moisture-card">

          {location && (
            <div className="moisture-animation">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}

          <h3>💧 Soil Moisture</h3>

          <strong>
            {loadingData
              ? "..."
              : weatherData
              ? `${weatherData.soilMoisture}%`
              : "--"}
          </strong>

          <p>
            Current level
          </p>

        </div>


        {/* ⛰️ SLOPE */}

        <div className="card slope-card">

          {location && (
            <div className="slope-animation">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}

          <h3>⛰️ Slope</h3>

          <strong>
            {loadingData
              ? "..."
              : slope !== null &&
                slope !== undefined
              ? `${slope}°`
              : "--"}
          </strong>

          <p>
            Terrain angle
          </p>

        </div>


        {/* 🚨 CURRENT RISK */}

        <div
          className={`card ai-card ${
            location
              ? "risk-alert-animation"
              : ""
          } ${
            combinedRisk === "HIGH"
              ? "high-risk"
              : combinedRisk === "MODERATE"
              ? "mod-risk"
              : "low-risk"
          }`}
        >

          {location && (
            <>
              <div className="risk-light"></div>

              <div className="risk-siren">
                
              </div>
            </>
          )}

          <h3>
            🚨 Risk Level
          </h3>

          <strong>
            {loadingData
              ? "Updating..."
              : riskLabel}
          </strong>

          <p>
            {combinedRisk === "HIGH"
              ? "Critical landslide risk"
              : combinedRisk === "MODERATE"
              ? "Elevated saturation"
              : "Normal thresholds"}
          </p>

        </div>


        {/* 🤖 AI PREDICTION CARD */}

        <div
          className={`card risk-card ${
            location
      ? "risk-alert-animation"
      : ""
  } ${
    combinedRisk === "HIGH"
      ? "high-risk"
      : combinedRisk === "MODERATE"
      ? "mod-risk"
      : "low-risk"
  }`}
        >

          {location && (
            <div className="ai-scan-line"></div>
          )}

          <h3>
            🤖 AI Environmental Assessment
          </h3>

          {aiLoading ? (
            <>
              <strong>
                Analyzing...
              </strong>

              <p>
                ML model processing environmental data
              </p>
            </>
          ) : aiPrediction ? (
            <>

              <strong>
                ML: {aiPrediction.risk}
              </strong>

              <p>
                Model Confidence:{" "}
                <b>
                  {confidenceText}
                </b>
              </p>

              <div
                style={{
                  marginTop: "8px",
                }}
              >

                <p
                  style={{
                    marginBottom: "5px",
                  }}
                >
                  <b>LOW:</b>{" "}
                  {lowProbability.toFixed(1)}%
                </p>

                <div
                  style={{
                    width: "100%",
                    height: "7px",
                    background:
                      "#e5e7eb",
                    borderRadius:
                      "10px",
                    overflow:
                      "hidden",
                    marginBottom:
                      "8px",
                  }}
                >

                  <div
                    style={{
                      width: `${lowProbability}%`,
                      height: "100%",
                      background:
                        "#22c55e",
                      borderRadius:
                        "10px",
                    }}
                  />

                </div>

                <p
                  style={{
                    marginBottom: "5px",
                  }}
                >
                  <b>MODERATE:</b>{" "}
                  {moderateProbability.toFixed(
                    1
                  )}
                  %
                </p>

                <div
                  style={{
                    width: "100%",
                    height: "7px",
                    background:
                      "#e5e7eb",
                    borderRadius:
                      "10px",
                    overflow:
                      "hidden",
                    marginBottom:
                      "8px",
                  }}
                >

                  <div
                    style={{
                      width: `${moderateProbability}%`,
                      height: "100%",
                      background:
                        "#f59e0b",
                      borderRadius:
                        "10px",
                    }}
                  />

                </div>

                <p
                  style={{
                    marginBottom: "5px",
                  }}
                >
                  <b>HIGH:</b>{" "}
                  {highProbability.toFixed(
                    1
                  )}
                  %
                </p>

                <div
                  style={{
                    width: "100%",
                    height: "7px",
                    background:
                      "#e5e7eb",
                    borderRadius:
                      "10px",
                    overflow:
                      "hidden",
                  }}
                >

                  <div
                    style={{
                      width: `${highProbability}%`,
                      height: "100%",
                      background:
                        "#ef4444",
                      borderRadius:
                        "10px",
                    }}
                  />

                </div>

              </div>

              <p>
                <strong>
                  🚨 Final Assessment:{" "}
                  {combinedRisk}
                </strong>
              </p>

              <p>
                Final assessment considers ML prediction,
                environmental conditions and historical evidence.
              </p>

            </>
          ) : !aiAttempted ? (
            <p>
              Waiting for AI analysis...
            </p>
          ) : (
            <p>
              AI model temporarily unavailable.
              Environmental assessment is still active.
            </p>
          )}

        </div>


        {/* 🌋 HISTORICAL */}

        <div className="card">

          <h3>
            🌋 Historical Evidence
          </h3>

          <strong>
            {historicalData.length > 0
              ? `${historicalData.length} Incidents`
              : "None"}
          </strong>

          <p>
            {historicalData.length > 0 &&
            nearestHistoricalDistance !== null
              ? `Nearest: ${nearestHistoricalDistance.toFixed(
                  1
                )} km`
              : "No incidents within 50 km"}
          </p>

          {mostRecentHistoricalYear && (
            <p>
              Most recent:{" "}
              {mostRecentHistoricalYear}
            </p>
          )}

        </div>

        <p
          style={{
            whiteSpace: "nowrap",
            fontSize: "0.9rem",
            marginTop: "4px",
          }}
        >
          Historical Risk:{" "}

          {historicalRisk === "HIGH"
            ? "🔴 HIGH"
            : historicalRisk === "MODERATE"
            ? "🟠 MODERATE"
            : "🟢 NONE"}

        </p>

      </section>


      {/* HISTORICAL INCIDENT HEADER */}

      {location && (
        <section className="historical-section">

          <div className="section-title-wrap">

            <div className="title-left">

              <span className="icon-badge">
                🌋
              </span>

              <div>

                <h2>
                  Historical Incidents
                </h2>

                <p className="subtitle">
                  {historicalData.length > 0
                    ? `Found ${historicalData.length} recorded events within 50 km radius`
                    : "No historical landslides recorded within 50 km radius."}
                </p>

              </div>

            </div>

            {historicalData.length > 0 && (
              <span className="count-pill">
                {historicalData.length} Detected
              </span>
            )}

          </div>

        </section>
      )}

      {/* HISTORICAL INCIDENT CARDS */}

      {location && (
        <section className="historical-grid-section">

          {historicalData.length > 0 ? (

            <div className="historical-grid">

              {historicalData.map(
                (record, index) => (

                  <div
                    key={`${record.location}-${record.year}-${index}`}
                    className="incident-card"
                    onClick={() => {

                      setTracking(false);

                      setLocation({
                        latitude:
                          record.latitude,

                        longitude:
                          record.longitude,

                        name:
                          record.location,
                      });

                      setMessage(
                        `Inspecting: ${record.location}`
                      );

                    }}
                  >

                    <div className="incident-top">

                      <div className="incident-name">

                        <span className="pin-dot">
                          📍
                        </span>

                        <strong>
                          {record.location}
                        </strong>

                      </div>

                      <span
                        className={`severity-pill ${
                          record.severity.toLowerCase() ===
                          "high"
                            ? "pill-high"
                            : "pill-med"
                        }`}
                      >
                        {record.severity}
                      </span>

                    </div>

                    <div className="incident-meta">

                      <div className="meta-box">

                        <span>
                          Year
                        </span>

                        <strong>
                          {record.year}
                        </strong>

                      </div>

                      <div className="meta-box">

                        <span>
                          Proximity
                        </span>

                        <strong>
                          {location
                            ? `${calculateDistance(
                                location.latitude,
                                location.longitude,
                                record.latitude,
                                record.longitude
                              ).toFixed(
                                1
                              )} km`
                            : "--"}
                        </strong>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          ) : (

            <div className="empty-state">

              <span>
                🌋
              </span>

              <div>

                <h4>
                  No Historical Incidents
                </h4>

                <p>
                  No recorded landslides
                  were found within
                  50 km of the
                  selected location.
                </p>

              </div>

            </div>

          )}

        </section>
      )}

      {/* CAUSES + PRECAUTIONS */}

      {location && (
        <section className="causes-precautions-section">

          <div className="causes-box">

            <h2>
              ⚠️ Possible Causes
            </h2>

            {causes.map(
              (cause, index) => (
                <div
                  key={index}
                  className="cause-item"
                >
                  {cause}
                </div>
              )
            )}

          </div>

          <div className="precautions-box">

            <h2>
              🛡️ Precautions
            </h2>

            {precautions.map(
              (precaution, index) => (
                <div
                  key={index}
                  className="precaution-item"
                >
                  {precaution}
                </div>
              )
            )}

          </div>

        </section>
      )}

      {/* SAFE ZONE */}

      {location &&
        (combinedRisk === "HIGH" ||
          combinedRisk === "MODERATE") &&
        nearestSafeZone && (

          <section className="safe-zone-section">

            <h2>
              🛡️ Recommended Safe Zone
            </h2>

            <div className="safe-zone-info">

              <div className="safe-zone-card">

                <span>
                  📍 Safe Zone
                </span>

                <strong>
                  {nearestSafeZone.name}
                </strong>

              </div>

              <div className="safe-zone-card">

                <span>
                  📏 Distance
                </span>

                <strong>
                  {nearestSafeZone.distance.toFixed(
                    1
                  )} km
                </strong>

              </div>

              <div className="safe-zone-card">

                <span>
                  ⏱️ Estimated travel time
                </span>

                <strong>
                  {estimatedTravelTime} min
                </strong>

              </div>

            </div>

            <p className="safe-zone-message">

              🚶{" "}
              {combinedRisk === "HIGH"
                ? "Evacuate immediately and move toward the recommended safe zone."
                : "Stay alert and be prepared to move toward the recommended safe zone if conditions worsen."}

            </p>

            <button
              className="safe-zone-button"
              onClick={goToSafeZone}
            >
              🧭 Go to Safe Zone
            </button>

          </section>
        )}

      {/* MAP + WARNING */}

      <section className="main-content">

        <div className="map">

          <h2>
            🗺️ Risk Monitoring Map
          </h2>

          <div className="map-wrapper">

            <MapContainer
              center={[
                20.5937,
                78.9629,
              ]}
              zoom={5}
              scrollWheelZoom={true}
              style={{
                width: "100%",
                height: "100%",
              }}
            >

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <LocationUpdater
                location={location}
              />

              {location && (
                <>

                  <Marker
                    position={[
                      location.latitude,
                      location.longitude,
                    ]}
                  >

                    <Popup>

                      <strong>
                        📍{" "}
                        {location.name ||
                          "Selected Location"}
                      </strong>

                      <br />

                      Latitude:{" "}
                      {location.latitude.toFixed(
                        4
                      )}

                      <br />

                      Longitude:{" "}
                      {location.longitude.toFixed(
                        4
                      )}

                    </Popup>

                  </Marker>

                  <Circle
                    center={[
                      location.latitude,
                      location.longitude,
                    ]}
                    radius={50000}
                    pathOptions={{
                      fillOpacity: 0.08,
                    }}
                  />

                </>
              )}

              {showHistorical &&
                historicalData.map(
                  (
                    record,
                    index
                  ) => (

                    <CircleMarker
                      key={`${record.location}-${index}`}
                      center={[
                        record.latitude,
                        record.longitude,
                      ]}
                      radius={8}
                      pathOptions={{
                        fillOpacity: 0.8,
                      }}
                    >

                      <Popup>

                        <strong>
                          🌋{" "}
                          {record.location}
                        </strong>

                        <br />

                        Year:{" "}
                        {record.year}

                        <br />

                        Severity:{" "}
                        {record.severity}

                        <br />

                        {location && (
                          <>
                            Distance:{" "}
                            {calculateDistance(
                              location.latitude,
                              location.longitude,
                              record.latitude,
                              record.longitude
                            ).toFixed(
                              1
                            )} km
                          </>
                        )}

                      </Popup>

                    </CircleMarker>

                  )
                )}

              {nearestSafeZone &&
                location &&
                (combinedRisk === "HIGH" ||
                  combinedRisk ===
                    "MODERATE") && (

                  <CircleMarker
                    center={[
                      nearestSafeZone.latitude,
                      nearestSafeZone.longitude,
                    ]}
                    radius={10}
                    pathOptions={{
                      fillOpacity: 0.9,
                    }}
                  >

                    <Popup>

                      <strong>
                        🛡️{" "}
                        {nearestSafeZone.name}
                      </strong>

                      <br />

                      Distance:{" "}
                      {nearestSafeZone.distance.toFixed(
                        1
                      )} km

                      <br />

                      Estimated travel time:{" "}
                      {estimatedTravelTime} min

                    </Popup>

                  </CircleMarker>

                )}

            </MapContainer>

          </div>

        </div>

        {/* WARNING */}

        <div className="warning">

          <h2>
            🚨 Early Warning
          </h2>

          <div className="warning-box">

            <h3>
              Current Risk:{" "}
              {riskLabel}
            </h3>

            <p>
              {combinedRisk === "HIGH"
                ? "Critical conditions detected. Immediate precautionary action is recommended."
                : combinedRisk === "MODERATE"
                ? "Elevated conditions detected. Monitor the area closely."
                : weatherData
                ? "Current environmental conditions are within normal thresholds."
                : "Waiting for environmental data."}
            </p>

          </div>

          {/* AI RESULT */}

          <div
            className="warning-box"
            style={{
              marginTop: "12px",
            }}
          >

            <h3>
              🤖 AI Model Status
            </h3>

            <p>
              {aiLoading
                ? "AI model is analyzing current environmental conditions..."
                : aiPrediction
                ? `ML Prediction: ${aiPrediction.risk} | Confidence: ${confidenceText}`
                : !aiAttempted
                ? "Waiting for AI analysis..."
                : "AI model temporarily unavailable. Environmental assessment is still active."}
            </p>

            {aiPrediction && (
              <p>
                <strong>
                  🚨 Final Assessment:{" "}
                  {combinedRisk}
                </strong>

                <br />

                <span>
                  ML Prediction:{" "}
                  {aiPrediction.risk} •{" "}
                  Confidence:{" "}
                  {confidenceText}
                </span>
              </p>
            )}

          </div>

          {/* =====================================================
              EMERGENCY BUTTON
              ===================================================== */}

          {combinedRisk === "HIGH" && (
            <button
              className="alert-button"
              onClick={
                sendEmergencyAlert
              }
              disabled={
                emergencyLoading
              }
              style={{
                opacity:
                  emergencyLoading
                    ? 0.7
                    : 1,
                cursor:
                  emergencyLoading
                    ? "wait"
                    : "pointer",
              }}
            >

              {emergencyLoading
                ? "📡 Verifying Location & Sending..."
                : "🚨 Send Emergency Alert"}

            </button>
          )}

          {alertSent && (
            <div
              className="status-text"
              style={{
                fontWeight: "bold",
                marginTop: "12px",
              }}
            >

              ✅ Emergency alert successfully
              triggered and recorded by the
              monitoring backend.

            </div>
          )}

          {/* =====================================================
              EMERGENCY RESPONSE
              ===================================================== */}

          {emergencyResponse?.success &&
            emergencyResponse.alert && (

              <div
                className="warning-box"
                style={{
                  marginTop: "12px",
                }}
              >

                <h3>
                  🚨 Emergency Response
                </h3>

                <p>
                  <strong>
                    Status:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.status
                  }
                </p>

                <p>
                  <strong>
                    📍 Location:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.location
                      ?.name
                  }
                </p>

                <p>
                  <strong>
                    Latitude:
                  </strong>{" "}
                  {Number(
                    emergencyResponse
                      .alert.location
                      ?.latitude
                  ).toFixed(4)}
                </p>

                <p>
                  <strong>
                    Longitude:
                  </strong>{" "}
                  {Number(
                    emergencyResponse
                      .alert.location
                      ?.longitude
                  ).toFixed(4)}
                </p>

                <p>
                  <strong>
                    Risk:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.risk
                  }
                </p>

                <p>
                  <strong>
                    🌧️ Rainfall:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.environment
                      ?.rainfall
                  }{" "}
                  mm
                </p>

                <p>
                  <strong>
                    💧 Soil Moisture:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.environment
                      ?.soil_moisture
                  }
                  %
                </p>

                <p>
                  <strong>
                    ⛰️ Slope:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.environment
                      ?.slope
                  }
                  °
                </p>

                <p>
                  <strong>
                    🌋 Historical Incidents:
                  </strong>{" "}
                  {
                    emergencyResponse
                      .alert.environment
                      ?.historical_incidents
                  }
                </p>

              </div>
            )}

        </div>

      </section>

      {/* FOOTER */}

      <footer>
        Landslide Early Warning System
        • SIH 26001 Prototype
      </footer>

    </div>
  );
}

// ===============================
// ROUTES
// ===============================

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<Dashboard />}
      />

      <Route
        path="/hazardous"
        element={<Hazardous />}
      />

      <Route
        path="/report-hazard"
        element={<ReportHazard />}
      />

    </Routes>
  );
}

export default App;