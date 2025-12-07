import React, { useState } from "react";

function VinLookupApp() {
  const [vin, setVin] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [bulkResults, setBulkResults] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [recalls, setRecalls] = useState([]);
  const [recallError, setRecallError] = useState("");

  const isValidVin = (value) => {
    const cleaned = value.trim().toUpperCase();
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    return vinRegex.test(cleaned);
  };

  // CSV bulk decode helper
  const decodeVinFromApi = async (vinValue) => {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vinValue}?format=json`;
    const res = await fetch(url);

    if (!res.ok) throw new Error("Decode API error");

    const json = await res.json();
    const results = json.Results || [];

    const getVal = (name) =>
      results.find((r) => r.Variable === name)?.Value || "N/A";

    return {
      vin: vinValue,
      make: getVal("Make"),
      model: getVal("Model"),
      modelYear: getVal("Model Year"),
      bodyClass: getVal("Body Class"),
      engineCylinders: getVal("Engine Number of Cylinders"),
      engineDisplacement: getVal("Displacement (in Liters)"),
      fuelTypePrimary: getVal("Fuel Type - Primary"),
      plantCountry: getVal("Plant Country"),
    };
  };

  // Single VIN LOOKUP
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setData(null);
    setRecalls([]);
    setRecallError("");

    const cleanedVin = vin.trim().toUpperCase();
    if (!isValidVin(cleanedVin)) {
      setError("Please enter a valid 17-character VIN (no I, O, or Q).");
      return;
    }

    setLoading(true);

    const decodeURL = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${cleanedVin}?format=json`;
    const recallURL = `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${cleanedVin}`;

    try {
      const [decodeRes, recallRes] = await Promise.all([
        fetch(decodeURL),
        fetch(recallURL, {
          headers: {
            Accept: "application/json",
          },
        }),
      ]);

      if (!decodeRes.ok) throw new Error("Decode API error");

      let recallJson = { results: [] };

      if (recallRes.ok) {
        recallJson = await recallRes.json();
      } else {
        if (recallRes.status === 400) {
          setRecallError(
            "NHTSA recall service returned 400 for this VIN. No recall data is available."
          );
        } else {
          setRecallError(`Recall API HTTP ${recallRes.status}`);
        }
      }

      const decodeJson = await decodeRes.json();
      const results = decodeJson.Results || [];
      const getVal = (name) =>
        results.find((r) => r.Variable === name)?.Value || "N/A";

      setData({
        vin: cleanedVin,
        make: getVal("Make"),
        model: getVal("Model"),
        modelYear: getVal("Model Year"),
        bodyClass: getVal("Body Class"),
        engineCylinders: getVal("Engine Number of Cylinders"),
        engineDisplacement: getVal("Displacement (in Liters)"),
        fuelTypePrimary: getVal("Fuel Type - Primary"),
        plantCountry: getVal("Plant Country"),
      });

      setRecalls(recallJson.results || []);
    } catch (err) {
      console.error("VIN lookup error:", err);
      setError("Error looking up VIN details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // CSV Upload
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    setBulkError("");
    setBulkResults([]);

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setBulkError("Please upload a .csv file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") {
        setBulkError("Unreadable CSV file.");
        return;
      }

      const lines = text.split(/[\n,]+/);
      const vins = lines
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0)
        .slice(0, 50);

      const invalid = vins.filter((v) => !isValidVin(v));
      if (invalid.length > 0) {
        setBulkError(
          `Invalid VINs: ${invalid.slice(0, 5).join(", ")}${
            invalid.length > 5 ? "..." : ""
          }`
        );
      }

      const valid = vins.filter((v) => isValidVin(v));
      if (valid.length === 0) return;

      setBulkLoading(true);

      try {
        const results = await Promise.all(
          valid.map((v) =>
            decodeVinFromApi(v).catch(() => ({
              vin: v,
              make: "Error",
              model: "-",
              modelYear: "-",
            }))
          )
        );

        setBulkResults(results);
      } catch (err) {
        console.error(err);
        setBulkError("CSV processing error.");
      } finally {
        setBulkLoading(false);
      }
    };

    reader.readAsText(file);
  };

  // UI
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e5e7eb",
        fontFamily: "system-ui",
        padding: "2rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          background: "#020617",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #1f2937",
        }}
      >
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
          VIN Lookup Tool
        </h1>

        {/* Single VIN LOOKUP */}
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Single VIN Lookup</h2>

          <form onSubmit={handleSubmit}>
            <input
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid #4b5563",
                background: "#0f172a",
                color: "#fff",
                fontSize: "1rem",
              }}
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              placeholder="Enter 17-character VIN"
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 1.2rem",
                borderRadius: "0.5rem",
                border: "none",
                fontWeight: "600",
                background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>

          {error && (
            <p style={{ color: "#fecaca", marginTop: "0.75rem" }}>{error}</p>
          )}

          {/* VEHICLE INFO */}
          {data && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: "0.75rem",
                background: "#1e293b",
              }}
            >
              <h3 style={{ fontSize: "1.2rem" }}>Vehicle Information</h3>

              <p>VIN: {data.vin}</p>
              <p>
                <strong>
                  {data.modelYear} {data.make} {data.model}
                </strong>
              </p>

              <div style={{ marginTop: "0.5rem" }}>
                <p>Body Class: {data.bodyClass}</p>
                <p>
                  Engine: {data.engineCylinders} Cyl / {data.engineDisplacement}L
                </p>
                <p>Fuel: {data.fuelTypePrimary}</p>
                <p>Plant Country: {data.plantCountry}</p>
              </div>

              {/* SAFETY RECALLS */}
              <h3 style={{ marginTop: "1rem" }}>Safety Recalls</h3>

              {/* No recalls */}
              {recalls.length === 0 && !recallError && (
                <p style={{ fontSize: "1rem", color: "#9ca3af" }}>
                  0 (No recalls open)
                </p>
              )}

              {/* Error */}
              {recallError && (
                <p style={{ color: "#fecaca" }}>{recallError}</p>
              )}

              {/* Recalls Found */}
              {recalls.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {recalls.map((r) => (
                    <li
                      key={r.NHTSACampaignNumber}
                      style={{
                        marginBottom: "0.75rem",
                        padding: "0.75rem",
                        background: "#0f172a",
                        border: "1px solid #374151",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        <strong>NHTSA Campaign Number: </strong>
                        {r.NHTSACampaignNumber}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* BULK CSV */}
        <section>
          <h2>Bulk CSV Lookup</h2>

          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            style={{ marginTop: "0.5rem" }}
          />

          {bulkError && (
            <p style={{ color: "#fecaca", marginTop: "0.5rem" }}>
              {bulkError}
            </p>
          )}

          {bulkLoading && <p>Processing VINs…</p>}

          {bulkResults.length > 0 && (
            <table
              style={{
                width: "100%",
                marginTop: "1rem",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #374151" }}>VIN</th>
                  <th style={{ borderBottom: "1px solid #374151" }}>Make</th>
                  <th style={{ borderBottom: "1px solid #374151" }}>Model</th>
                  <th style={{ borderBottom: "1px solid #374151" }}>Year</th>
                </tr>
              </thead>
              <tbody>
                {bulkResults.map((r) => (
                  <tr key={r.vin}>
                    <td>{r.vin}</td>
                    <td>{r.make}</td>
                    <td>{r.model}</td>
                    <td>{r.modelYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default VinLookupApp;
