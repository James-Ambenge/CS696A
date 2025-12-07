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

  // --- API HELPER FUNCTIONS ---

  // 1. Decode VIN (VPIC API)
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
      make: extractField("Make"),
      model: extractField("Model"),
      modelYear: extractField("Model Year"),
      bodyClass: extractField("Body Class"),
      engineCylinders: extractField("Engine Number of Cylinders"),
      engineDisplacement: extractField("Displacement (in Liters)"),
      fuelTypePrimary: extractField("Fuel Type - Primary"),
      plantCountry: extractField("Plant Country"),
    };
  };

  // 2. Fetch Recalls (NHTSA Recall API) - FIXED to use direct VIN endpoint
  const fetchRecallsByVin = async (vinValue) => {
    // This is the endpoint used in your reference HTML example
    const res = await fetch(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${vinValue}`
    );

    if (!res.ok) {
      // If 404, it usually means invalid VIN or API issue, but we treat it as empty or error
      throw new Error(`Recall API returned ${res.status}`);
    }

    const json = await res.json();
    // The API returns lowercase "results"
    return json.results || [];
  };

  // --- HANDLERS ---

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
      // Run both fetches in parallel
      const [decodedData, recallData] = await Promise.all([
        decodeVinFromApi(trimmedVin),
        fetchRecallsByVin(trimmedVin).catch((err) => {
          console.error("Recall fetch failed:", err);
          setRecallError("Could not fetch recalls (Service unavailable).");
          return []; // Return empty array so the app doesn't crash
        }),
      ]);

      setData(decodedData);
      setRecalls(recallData);
      
    } catch (err) {
      console.error("Critical Error:", err);
      setError("Error looking up VIN details. Please verify the VIN and try again.");
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

      // Limit to 50
      const limitedVins = vins.slice(0, 50);
      const validVins = limitedVins.filter((v) => isValidVin(v));

      if (validVins.length === 0) {
        setBulkError("No valid VINs found.");
        return;
      }

      setBulkLoading(true);
      try {
        // We only decode basic info for bulk to save bandwidth
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

  // Helper variables for external links
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
          VIN Lookup
        </h1>
        <p style={{ marginBottom: "1.5rem", color: "#9ca3af" }}>
          Enter a VIN to decode specs and check for official safety recalls.
        </p>

        {/* --- INPUT SECTION --- */}
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
              Vehicle Identification Number (VIN)
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="vin"
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="e.g. 5XY... (17 characters)"
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
                  background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Searching..." : "Decode"}
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

        {/* --- RESULTS SECTION --- */}
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
            {/* Header with Links */}
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.6rem", margin: 0, color: "#fff" }}>
                  {data.modelYear} {data.make} {data.model}
                </h2>
                <p style={{ color: "#9ca3af", marginTop: "0.25rem" }}>VIN: {data.vin}</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <a href={googleLink} target="_blank" rel="noreferrer" style={linkButtonStyle}>Google Search</a>
                <a href={waybackLink} target="_blank" rel="noreferrer" style={linkButtonStyle}>Wayback Machine</a>
              </div>
            </div>

            <hr style={{ borderColor: "#334155", opacity: 0.5, margin: "1rem 0" }} />

            {/* Vehicle Specs Grid */}
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", fontSize: "0.9rem" }}>
              <SpecItem label="Body Class" value={data.bodyClass} />
              <SpecItem label="Engine" value={`${data.engineCylinders || "?"} Cyl / ${data.engineDisplacement || "?"}L`} />
              <SpecItem label="Fuel Type" value={data.fuelTypePrimary} />
              <SpecItem label="Plant Country" value={data.plantCountry} />
            </dl>

            {/* RECALLS SECTION */}
            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #334155" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
                Safety Recalls <span style={{fontSize:"0.8em", opacity: 0.7}}>({recalls.length})</span>
              </h3>

              {recallError && <p style={{ color: "#fca5a5" }}>{recallError}</p>}
              
              {!recallError && recalls.length === 0 && (
                <div style={{ padding: "1rem", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "0.5rem", color: "#86efac" }}>
                  ✅ No open recalls found for this VIN.
                </div>
              )}

              {recalls.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "1rem" }}>
                  {recalls.map((recall, idx) => (
                    <li key={idx} style={{ background: "#0f172a", padding: "1rem", borderRadius: "0.5rem", border: "1px solid #334155" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem", color: "#64748b" }}>
                        <span><strong>Campaign:</strong> {recall.NHTSACampaignNumber}</span>
                        <span>{recall.ReportReceivedDate}</span>
                      </div>
                      <div style={{ fontWeight: "bold", marginBottom: "0.4rem", color: "#f1f5f9" }}>
                        {recall.Component}
                      </div>
                      <p style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: 0, lineHeight: "1.5" }}>
                        {recall.Summary}
                      </p>
                      {recall.Consequence && (
                        <p style={{ fontSize: "0.85rem", color: "#fca5a5", marginTop: "0.75rem" }}>
                          <strong>Consequence:</strong> {recall.Consequence}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* --- BULK UPLOAD --- */}
        <section style={{ padding: "1rem", borderRadius: "0.75rem", background: "#0f172a", border: "1px solid #374151" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Bulk Lookup (CSV)</h2>
          <input type="file" accept=".csv" onChange={handleCsvUpload} style={{ color: "#9ca3af" }} />
          {bulkLoading && <p style={{marginTop: "0.5rem"}}>Processing CSV...</p>}
          {bulkError && <p style={{ color: "#fca5a5", marginTop: "0.5rem" }}>{bulkError}</p>}
          
          {bulkResults.length > 0 && (
            <div style={{ marginTop: "1rem", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ color: "#9ca3af" }}>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #334155" }}>VIN</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #334155" }}>Make</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #334155" }}>Model</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #334155" }}>Year</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r) => (
                    <tr key={r.vin}>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #1e293b" }}>{r.vin}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #1e293b" }}>{r.make}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #1e293b" }}>{r.model}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #1e293b" }}>{r.modelYear}</td>
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

// Mini sub-components for styling cleanup
const SpecItem = ({ label, value }) => (
  <div>
    <dt style={{ color: "#9ca3af", fontSize: "0.85rem" }}>{label}</dt>
    <dd style={{ margin: 0, fontWeight: 500 }}>{value}</dd>
  </div>
);

const linkButtonStyle = {
  fontSize: "0.8rem",
  padding: "0.4rem 0.8rem",
  borderRadius: "4px",
  background: "#0f172a",
  color: "#38bdf8",
  textDecoration: "none",
  border: "1px solid #334155",
  transition: "background 0.2s",
};

export default VinLookupApp;