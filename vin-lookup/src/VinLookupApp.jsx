import React, { useState } from "react";

function VinLookupApp() {
  const [vin, setVin] = useState("");
  
  // Single Lookup State
  const [data, setData] = useState(null);
  const [recalls, setRecalls] = useState([]);
  const [error, setError] = useState("");
  const [recallError, setRecallError] = useState("");
  const [loading, setLoading] = useState(false);

  // Bulk Lookup State
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const isValidVin = (value) => {
    const cleaned = value.trim().toUpperCase();
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/; // 17 chars, no I, O, Q
    return vinRegex.test(cleaned);
  };

  // 1. Decode Basic Info (VPIC API)
  const decodeVinFromApi = async (vinValue) => {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vinValue}?format=json`
    );
    if (!res.ok) throw new Error("VPIC API response not ok");
    const json = await res.json();
    const results = json.Results || [];

    const extractField = (name) =>
      results.find((r) => r.Variable === name)?.Value || "N/A";

    return {
      vin: vinValue,
      make: extractField("Make"), // Note: VPIC sometimes changes "Make:" to "Make"
      model: extractField("Model"),
      modelYear: extractField("Model Year"),
      bodyClass: extractField("Body Class"),
      engineCylinders: extractField("Engine Number of Cylinders"),
      engineDisplacement: extractField("Displacement (in Liters)"),
      fuelTypePrimary: extractField("Fuel Type - Primary"),
      plantCountry: extractField("Plant Country"),
    };
  };

  // 2. Fetch Recalls directly by VIN (NHTSA Recall API)
  const fetchRecallsByVin = async (vinValue) => {
    const res = await fetch(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${vinValue}`
    );
    if (!res.ok) throw new Error("Recall API response not ok");
    const json = await res.json();
    // The endpoint returns lowercase 'results' usually
    return json.results || [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setRecallError("");
    setData(null);
    setRecalls([]);

    const trimmedVin = vin.trim().toUpperCase();

    if (!isValidVin(trimmedVin)) {
      setError("Please enter a valid 17-character VIN (no I, O, or Q).");
      return;
    }

    setLoading(true);

    try {
      // Run both fetch requests in parallel for speed
      const [decodedData, recallData] = await Promise.all([
        decodeVinFromApi(trimmedVin).catch((err) => {
          console.error("Decode Error:", err);
          throw new Error("Could not decode vehicle details.");
        }),
        fetchRecallsByVin(trimmedVin).catch((err) => {
          console.error("Recall Error:", err);
          // Return null so we can show a specific recall error without crashing the main app
          return null; 
        }),
      ]);

      setData(decodedData);

      if (recallData === null) {
        setRecallError("Could not fetch recall data at this time.");
      } else {
        setRecalls(recallData);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "Error processing request.");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    setBulkError("");
    setBulkResults([]);

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setBulkError("Please upload a .csv file containing VINs.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rawTokens = text.split(/[\n,]+/);

      const vins = rawTokens
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0);

      if (vins.length === 0) {
        setBulkError("No VINs found in the file.");
        return;
      }

      // Limit to 50 for demo purposes
      const limitedVins = vins.slice(0, 50);
      const validVins = limitedVins.filter((v) => isValidVin(v));

      if (validVins.length === 0) {
        setBulkError("No valid VINs found in the selection.");
        return;
      }

      setBulkLoading(true);
      try {
        const promises = validVins.map((v) =>
          decodeVinFromApi(v).catch(() => ({
            vin: v,
            make: "Error",
            model: "-",
            modelYear: "-",
          }))
        );
        const results = await Promise.all(promises);
        setBulkResults(results);
      } catch (err) {
        setBulkError("Error processing CSV.");
      } finally {
        setBulkLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Helper for external links
  const googleLink = `https://www.google.com/search?q="${vin}" site:cargurus.com OR site:autotrader.com OR site:cars.com`;
  const waybackLink = `https://web.archive.org/web/*/autotrader.com/*${vin}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "#e5e7eb",
        display: "flex",
        justifyContent: "center",
        padding: "2rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          width: "100%",
          background: "#020617",
          padding: "1.75rem",
          borderRadius: "1rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
          border: "1px solid #1f2937",
        }}
      >
        <h1 style={{ fontSize: "1.9rem", marginBottom: "0.5rem" }}>
          VIN Lookup & Recall Check
        </h1>
        <p style={{ marginBottom: "1.5rem", color: "#9ca3af" }}>
          Powered by NHTSA Public API
        </p>

        {/* Single VIN Input */}
        <section
          style={{
            marginBottom: "2rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "#0f172a",
            border: "1px solid #374151",
          }}
        >
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="vin"
              style={{ display: "block", fontSize: "0.9rem", marginBottom: 4 }}
            >
              Enter VIN (17 Characters)
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="vin"
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="e.g. 1HGCM82633A004352"
                maxLength={17}
                style={{
                  flex: 1,
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #4b5563",
                  background: "#1e293b",
                  color: "#fff",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background:
                    "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {error && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                background: "#450a0a",
                color: "#fecaca",
              }}
            >
              {error}
            </div>
          )}
        </section>

        {/* Results Section */}
        {data && (
          <div
            style={{
              marginBottom: "2rem",
              padding: "1.5rem",
              borderRadius: "0.75rem",
              background: "#1e293b",
              border: "1px solid #374151",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.5rem", margin: 0 }}>
                  {data.modelYear} {data.make} {data.model}
                </h2>
                <p style={{ color: "#9ca3af", margin: "0.25rem 0 0" }}>
                  VIN: {data.vin}
                </p>
              </div>

              {/* External Search Links (Added from reference) */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <a
                  href={googleLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "4px",
                    background: "#0f172a",
                    color: "#38bdf8",
                    textDecoration: "none",
                    border: "1px solid #334155",
                  }}
                >
                  Google Search
                </a>
                <a
                  href={waybackLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "4px",
                    background: "#0f172a",
                    color: "#38bdf8",
                    textDecoration: "none",
                    border: "1px solid #334155",
                  }}
                >
                  Wayback Machine
                </a>
              </div>
            </div>

            <hr style={{ borderColor: "#334155", margin: "1rem 0" }} />

            {/* Vehicle Specs */}
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
                fontSize: "0.9rem",
              }}
            >
              <div>
                <dt style={{ color: "#9ca3af" }}>Body Class</dt>
                <dd>{data.bodyClass}</dd>
              </div>
              <div>
                <dt style={{ color: "#9ca3af" }}>Engine</dt>
                <dd>
                  {data.engineCylinders} Cyl / {data.engineDisplacement}L
                </dd>
              </div>
              <div>
                <dt style={{ color: "#9ca3af" }}>Fuel Type</dt>
                <dd>{data.fuelTypePrimary}</dd>
              </div>
              <div>
                <dt style={{ color: "#9ca3af" }}>Plant Country</dt>
                <dd>{data.plantCountry}</dd>
              </div>
            </dl>

            {/* Recalls Section */}
            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid #334155",
              }}
            >
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                Safety Recalls ({recalls.length})
              </h3>

              {recallError ? (
                <p style={{ color: "#fca5a5" }}>{recallError}</p>
              ) : recalls.length === 0 ? (
                <p style={{ color: "#86efac" }}>
                  No open recalls found for this specific VIN.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: "1rem",
                  }}
                >
                  {recalls.map((recall, idx) => (
                    <li
                      key={idx}
                      style={{
                        background: "#0f172a",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #334155",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "0.5rem",
                          fontSize: "0.85rem",
                          color: "#9ca3af",
                        }}
                      >
                        <span>
                          <strong>Campaign:</strong>{" "}
                          {recall.NHTSACampaignNumber || recall.nhtsaCampaignNumber}
                        </span>
                        <span>
                          {recall.ReportReceivedDate || recall.reportReceivedDate}
                        </span>
                      </div>
                      <div
                        style={{
                          fontWeight: "bold",
                          marginBottom: "0.25rem",
                          color: "#f8fafc",
                        }}
                      >
                        {recall.Component || recall.component}
                      </div>
                      <p
                        style={{
                          fontSize: "0.9rem",
                          color: "#cbd5e1",
                          margin: 0,
                          lineHeight: "1.5",
                        }}
                      >
                        {recall.Summary || recall.summary}
                      </p>
                      {/* Consequence if available */}
                      {(recall.Consequence || recall.consequence) && (
                        <p
                          style={{
                            fontSize: "0.85rem",
                            color: "#fca5a5",
                            marginTop: "0.5rem",
                          }}
                        >
                          <strong>Consequence:</strong>{" "}
                          {recall.Consequence || recall.consequence}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Bulk Upload Section */}
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "#0f172a",
            border: "1px solid #374151",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            Bulk Lookup (CSV)
          </h2>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            style={{ color: "#9ca3af" }}
          />
          {bulkLoading && <p>Processing...</p>}
          {bulkError && <p style={{ color: "#fca5a5" }}>{bulkError}</p>}
          {bulkResults.length > 0 && (
            <div style={{ marginTop: "1rem", overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr style={{ color: "#9ca3af" }}>
                    <th style={{ padding: "0.5rem" }}>VIN</th>
                    <th style={{ padding: "0.5rem" }}>Make</th>
                    <th style={{ padding: "0.5rem" }}>Model</th>
                    <th style={{ padding: "0.5rem" }}>Year</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r) => (
                    <tr key={r.vin} style={{ borderTop: "1px solid #334155" }}>
                      <td style={{ padding: "0.5rem" }}>{r.vin}</td>
                      <td style={{ padding: "0.5rem" }}>{r.make}</td>
                      <td style={{ padding: "0.5rem" }}>{r.model}</td>
                      <td style={{ padding: "0.5rem" }}>{r.modelYear}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default VinLookupApp;