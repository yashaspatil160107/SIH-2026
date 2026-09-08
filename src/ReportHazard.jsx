import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ReportHazard.css";

function ReportHazard() {
  const navigate = useNavigate();

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [description, setDescription] = useState("");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  // =========================================================
  // OPEN CAMERA
  // =========================================================

  const openCamera = async () => {
    try {
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera is not supported. Please use Chrome on localhost."
        );
        return;
      }

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

      setStream(mediaStream);
      setCameraOpen(true);
    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access in Chrome."
        );
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera was found on this device.");
      } else {
        setCameraError(
          "Unable to open camera. Check browser camera permissions."
        );
      }
    }
  };

  // =========================================================
  // CONNECT STREAM TO VIDEO
  // =========================================================

  useEffect(() => {
    if (cameraOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;

      videoRef.current
        .play()
        .catch((error) => {
          console.log("Video play waiting:", error);
        });
    }
  }, [cameraOpen, stream]);

  // =========================================================
  // CLOSE CAMERA
  // =========================================================

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStream(null);
    setCameraOpen(false);
  };

  // =========================================================
  // CAPTURE PHOTO
  // =========================================================

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setCameraError("Camera is not ready yet.");
      return;
    }

    if (video.readyState < 2) {
      setCameraError("Camera is still loading. Please wait a moment.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Unable to capture photo.");
          return;
        }

        const file = new File(
          [blob],
          `hazard-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

        setImageFile(file);

        const previewURL = URL.createObjectURL(file);
        setSelectedImage(previewURL);

        closeCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  // =========================================================
  // UPLOAD PHOTO
  // =========================================================

  const handleUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    setImageFile(file);

    const previewURL = URL.createObjectURL(file);
    setSelectedImage(previewURL);

    setAnalysis(null);
    setSubmitted(false);
  };

  // =========================================================
  // ANALYZE HAZARD USING FLASK
  // =========================================================

  const analyzeHazard = async () => {
    if (!imageFile) {
      alert("Please upload or capture a hazard photo first.");
      return;
    }

    if (!description.trim()) {
      alert("Please describe the hazard you observed.");
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysis(null);
      setSubmitted(false);

      const formData = new FormData();

      formData.append("image", imageFile);
      formData.append("description", description);

      const response = await fetch(
        "http://127.0.0.1:5000/analyze-image",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      console.log("Flask Analysis:", data);

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Hazard analysis failed."
        );
      }

      setAnalysis(data);
    } catch (error) {
      console.error("Analysis error:", error);

      alert(
        "Unable to analyze hazard.\n\nMake sure Flask is running on port 5000."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // =========================================================
  // SUBMIT REPORT
  // =========================================================

  const submitReport = () => {
    if (!imageFile) {
      alert("Please add a hazard photo.");
      return;
    }

    if (!description.trim()) {
      alert("Please describe the hazard.");
      return;
    }

    if (!analysis) {
      alert("Please analyze the hazard before submitting.");
      return;
    }

    const report = {
      id: Date.now(),
      description: description,
      risk: analysis.risk,
      confidence: analysis.confidence,
      detected_condition: analysis.detected_condition,
      assessment: analysis.assessment,
      reason: analysis.reason,
      precautions: analysis.precautions,
      timestamp: new Date().toISOString(),
    };

    // Save report locally
    const existingReports =
      JSON.parse(
        localStorage.getItem("hazardReports") || "[]"
      );

    existingReports.push(report);

    localStorage.setItem(
      "hazardReports",
      JSON.stringify(existingReports)
    );

    console.log("REPORT SAVED:", report);

    setSubmitted(true);

    alert("✅ Hazard report submitted successfully!");
  };

  // =========================================================
  // CLEAN CAMERA
  // =========================================================

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // =========================================================
  // RISK CLASS
  // =========================================================

  const getRiskClass = () => {
    if (!analysis) return "";

    return analysis.risk.toLowerCase();
  };

  return (
    <div className="report-hazard-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="report-header">

        <div>
          <h1>📸 Report Hazard</h1>

          <p>
            Capture or upload a photo of a possible
            landslide hazard and provide details.
          </p>
        </div>

        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          ← Back to Dashboard
        </button>

      </header>


      {/* =====================================================
          PHOTO SECTION
      ===================================================== */}

      <section className="report-card">

        <h2>📷 Hazard Photo</h2>

        <p>
          Capture a photo using your camera or upload
          an existing image.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >

          {/* UPLOAD */}

          <label className="upload-button">

            📁 Upload Photo

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              style={{ display: "none" }}
            />

          </label>


          {/* CAMERA */}

          <button
            type="button"
            className="upload-button"
            onClick={openCamera}
          >
            📷 Open Camera
          </button>

        </div>


        {/* CAMERA ERROR */}

        {cameraError && (
          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(239,68,68,0.12)",
              border:
                "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5",
            }}
          >
            ⚠️ {cameraError}
          </div>
        )}


        {/* =================================================
            CAMERA
        ================================================= */}

        {cameraOpen && (

          <div
            style={{
              marginTop: "20px",
              maxWidth: "700px",
              background: "#050914",
              borderRadius: "14px",
              padding: "15px",
              border:
                "1px solid rgba(56,189,248,0.4)",
            }}
          >

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                maxHeight: "500px",
                objectFit: "cover",
                borderRadius: "10px",
                display: "block",
                background: "#000",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "12px",
                flexWrap: "wrap",
              }}
            >

              <button
                type="button"
                className="analyze-button"
                onClick={capturePhoto}
              >
                📸 Capture Photo
              </button>

              <button
                type="button"
                className="back-button"
                onClick={closeCamera}
              >
                ✕ Close Camera
              </button>

            </div>

          </div>
        )}


        {/* HIDDEN CANVAS */}

        <canvas
          ref={canvasRef}
          style={{ display: "none" }}
        />


        {/* =================================================
            PHOTO PREVIEW
        ================================================= */}

        {selectedImage && (

          <div className="photo-preview">

            <img
              src={selectedImage}
              alt="Hazard preview"
            />

          </div>

        )}

      </section>


      {/* =====================================================
          DESCRIPTION
      ===================================================== */}

      <section className="report-card">

        <h2>📝 Describe the Hazard</h2>

        <p>
          Explain what you observed at the location.
        </p>

        <textarea
          rows="6"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setAnalysis(null);
            setSubmitted(false);
          }}
          placeholder="Example: Large cracks are visible on the roadside slope and loose soil is falling after rainfall..."
        />

      </section>


      {/* =====================================================
          ANALYZE BUTTON
      ===================================================== */}

      <div className="analyze-section">

        <button
          className="analyze-button"
          onClick={analyzeHazard}
          disabled={analyzing}
        >

          {analyzing
            ? "🤖 Analyzing..."
            : "🔍 Analyze Hazard"}

        </button>

      </div>


      {/* =====================================================
          ANALYSIS RESULT
      ===================================================== */}

      {analysis && (

        <section className="analysis-result">

          {/* HEADER */}

          <div className="result-header">

            <h2>
              🤖 Hazard Analysis Result
            </h2>

            <span
              className={`risk-badge ${getRiskClass()}`}
            >
              {analysis.risk}
            </span>

          </div>


          {/* RISK */}

          <div className="result-box">

            <h3>
              🚨 Risk Level
            </h3>

            <p>
              The detected risk level is{" "}
              <strong>
                {analysis.risk}
              </strong>
            </p>

          </div>


          {/* CONFIDENCE */}

          <div className="result-box">

            <h3>
              🎯 AI Confidence / Accuracy
            </h3>

            <strong>
              {analysis.confidence}%
            </strong>

            <div className="confidence-bar">

              <div
                className="confidence-fill"
                style={{
                  width: `${analysis.confidence}%`,
                }}
              />

            </div>

            <p>
              Confidence of the local hazard
              assessment.
            </p>

          </div>


          {/* DETECTED CONDITION */}

          <div className="result-box">

            <h3>
              🔎 Detected Condition
            </h3>

            <p>
              {analysis.detected_condition}
            </p>

          </div>


          {/* ASSESSMENT */}

          <div className="result-box">

            <h3>
              🧠 Professional Assessment
            </h3>

            <p>
              {analysis.assessment}
            </p>

          </div>


          {/* REASON */}

          <div className="result-box">

            <h3>
              ⚠️ Why This Risk Was Detected
            </h3>

            <p>
              {analysis.reason}
            </p>

          </div>


          {/* PRECAUTIONS */}

          <div
            className="result-box precautions-box"
          >

            <h3>
              🛡️ Recommended Precautions
            </h3>

            <ul>

              {analysis.precautions.map(
                (precaution, index) => (

                  <li key={index}>
                    {precaution}
                  </li>

                )
              )}

            </ul>

          </div>


          {/* =================================================
              SUBMIT REPORT
          ================================================= */}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "25px",
            }}
          >

            <button
              className="analyze-button"
              onClick={submitReport}
            >
              📤 Submit Report
            </button>

          </div>


          {/* SUCCESS */}

          {submitted && (

            <div
              style={{
                marginTop: "18px",
                padding: "15px",
                borderRadius: "10px",
                background:
                  "rgba(16,185,129,0.12)",
                border:
                  "1px solid rgba(16,185,129,0.35)",
                color: "#6ee7b7",
                fontWeight: "700",
              }}
            >
              ✅ Report submitted successfully
              and saved.
            </div>

          )}

        </section>

      )}


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="hazard-footer">

        Landslide Early Warning System
        • SIH 26001 Prototype

      </footer>

    </div>
  );
}

export default ReportHazard;