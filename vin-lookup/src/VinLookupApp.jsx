import React, { useState } from "react";

function VinLookupApp() {
  
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/; // 17 chars, no I, O, Q
    return vinRegex.test(cleaned);
  };

  const decodeVinFromApi = async (vinValue) => {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vinValue}?format=json`
    );

    if (!res.ok) {
      throw new Error("Network response was not ok");
    }

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
      engineDisplacement: extractField("Displacement (L)"),
      fuelTypePrimary: extractField("Fuel Type - Primary"),
      plantCountry: extractField("Plant Country"),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setData(null);
    setRecalls([]);
    setRecallError("");

    const trimmedVin = vin.trim().toUpperCase();

    if (!isValidVin(trimmedVin)) {
      setError("Please enter a valid 17-character VIN (no I, O, or Q).");
      return;
    }

    setLoading(true);

    try {
      // 1) Decode basic vehicle info from NHTSA
      const decoded = await decodeVinFromApi(trimmedVin);
      setData(decoded);

      const makeForRecalls = decoded.make;
      const modelForRecalls = decoded.model;
      const yearForRecalls = decoded.modelYear;

      if (!makeForRecalls || !modelForRecalls || !yearForRecalls) {
        setRecallError("Missing make/model/year; cannot load recalls.");
        return;
      }

      // 2) Fetch recalls from backend using Year / Make / Model
      try {
        const params = new URLSearchParams({
          make: makeForRecalls,
          model: modelForRecalls,
          year: String(yearForRecalls),
        });

        const recallRes = await fetch(
          `${API_BASE.replace(/\/$/, "")}/api/recalls?${params.toString()}`
        );

        if (!recallRes.ok) {
          const msg = `Recall API HTTP ${recallRes.status}`;
          console.error(msg);
          setRecallError(msg);
        } else {
          const recallJson = await recallRes.json();
          const list = recallJson.results || recallJson.Results || [];
          setRecalls(list);
        }
      } catch (recallErr) {
        console.error("Recall fetch failed:", recallErr);
        setRecallError("Recall service not available from backend.");
      }
      } catch (err) {
        console.error("VIN decode failed:", err);
        setError("Error looking up VIN details. Please try again.");
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

      const limitedVins = vins.slice(0, 50);

      const invalidVins = limitedVins.filter((v) => !isValidVin(v));
      if (invalidVins.length > 0) {
        setBulkError(
          `Some VINs are invalid: ${invalidVins
            .slice(0, 5)
            .join(", ")}${invalidVins.length > 5 ? "..." : ""}`
        );
      }

      const validVins = limitedVins.filter((v) => isValidVin(v));
      if (validVins.length === 0) {
        return;
      }

      setBulkLoading(true);
      try {
        const promises = validVins.map((v) =>
          decodeVinFromApi(v).catch((err) => {
            console.error(err);
            return { vin: v, make: "Error", model: "-", modelYear: "-" };
          })
        );
        const results = await Promise.all(promises);
        setBulkResults(results);
      } catch (err) {
        console.error(err);
        setBulkError("Error processing CSV VINs. Please try again.");
      } finally {
        setBulkLoading(false);
      }
    };

    reader.onerror = () => {
      setBulkError("Error reading file. Please try another CSV.");
    };

    reader.readAsText(file);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "#e5e7eb",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
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
        <p style={{ marginBottom: "1.25rem", color: "#9ca3af" }}>
          Type a valid VIN <strong>or</strong> upload a{" "}
          <strong>comma-separated value (.csv) file</strong> with multiple VINs.
        </p>

        {/* Single VIN section */}
        <section
          style={{
            marginBottom: "2rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "#020617",
            border: "1px solid #374151",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
            Single VIN Lookup
          </h2>
          <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="vin"
              style={{
                display: "block",
                fontSize: "0.9rem",
                marginBottom: 4,
              }}
            >
              VIN
            </label>
            <input
              id="vin"
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="e.g. 1HGCM82633A004352"
              maxLength={17}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.75rem",
                padding: "0.55rem 1.25rem",
                borderRadius: "999px",
                border: "none",
                background:
                  "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                color: "#0b1120",
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                fontSize: "0.95rem",
              }}
            >
              {loading ? "Looking up…" : "Decode VIN"}
            </button>
          </form>

          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                background: "#450a0a",
                color: "#fecaca",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          {data && (
            <div
              style={{
                marginTop: "0.5rem",
                padding: "1rem",
                borderRadius: "0.75rem",
                background: "#020617",
                border: "1px solid #374151",
              }}
            >
              <h3 style={{ marginBottom: "0.5rem", fontSize: "1.05rem" }}>
                Decoded Vehicle Info
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                VIN: <span style={{ color: "#e5e7eb" }}>{data.vin}</span>
              </p>
              <hr
                style={{
                  margin: "0.75rem 0",
                  borderColor: "#111827",
                  opacity: 0.6,
                }}
              />
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  columnGap: "1.5rem",
                  rowGap: "0.4rem",
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <dt style={{ color: "#9ca3af" }}>Make</dt>
                  <dd>{data.make}</dd>
                </div>
                <div>
                  <dt style={{ color: "#9ca3af" }}>Model</dt>
                  <dd>{data.model}</dd>
                </div>
                <div>
                  <dt style={{ color: "#9ca3af" }}>Model Year</dt>
                  <dd>{data.modelYear}</dd>
                </div>
                <div>
                  <dt style={{ color: "#9ca3af" }}>Body Class</dt>
                  <dd>{data.bodyClass}</dd>
                </div>
                <div>
                  <dt style={{ color: "#9ca3af" }}>Engine Cylinders</dt>
                  <dd>{data.engineCylinders}</dd>
                </div>
                <div>
                  <dt style={{ color: "#9ca3af" }}>Engine Displacement (L)</dt>
                  <dd>{data.engineDisplacement}</dd>
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

              {/* Recalls section */}
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid #111827",
                }}
              >
                <h4 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
                  Safety Recalls
                </h4>

                {recallError && (
                  <p style={{ fontSize: "0.85rem", color: "#fecaca" }}>
                    {recallError}
                  </p>
                )}

                {!recallError && recalls.length === 0 && (
                  <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                    No recalls found for this VIN in the NHTSA database.
                  </p>
                )}

                {!recallError && recalls.length > 0 && (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      maxHeight: "350px",
                      overflowY: "auto",
                    }}
                  >
                    {recalls.map((recall) => (
                      <li
                        key={recall.NHTSACampaignNumber}
                        style={{
                          marginBottom: "0.75rem",
                          padding: "0.75rem",
                          background: "#020617",
                          border: "1px solid #374151",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                            marginBottom: "0.25rem",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>
                            Campaign: {recall.NHTSACampaignNumber}
                          </span>
                          <span>{recall.ReportReceivedDate || "N/A"}</span>
                        </div>

                        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                          {recall.Component}
                        </div>

                        <div
                          style={{
                            fontSize: "0.8rem",
                            marginTop: "0.25rem",
                            color: "#d1d5db",
                          }}
                        >
                          {recall.Summary}
                        </div>

                        <div
                          style={{
                            fontSize: "0.8rem",
                            marginTop: "0.4rem",
                            color: "#9ca3af",
                          }}
                        >
                          MFR Recall No:{" "}
                          <span style={{ color: "#e5e7eb" }}>
                            {recall.ManufacturerRecallNo || "N/A"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                          }}
                        >
                          Initiator:{" "}
                          <span style={{ color: "#e5e7eb" }}>
                            {recall.RecallInitiator || "N/A"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* CSV Upload section */}
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "#020617",
            border: "1px solid #374151",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
            Bulk Lookup from CSV
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: 8 }}>
            Upload a <strong>.csv</strong> file with VINs separated by commas or
            new lines. (Example: <code>VIN1,VIN2,VIN3</code> or one VIN per
            line.)
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            style={{ marginTop: "0.5rem" }}
          />

          {bulkError && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                background: "#450a0a",
                color: "#fecaca",
                fontSize: "0.9rem",
              }}
            >
              {bulkError}
            </div>
          )}

          {bulkLoading && (
            <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
              Processing VINs…
            </p>
          )}

          {bulkResults.length > 0 && (
            <div style={{ marginTop: "1rem", overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        borderBottom: "1px solid #4b5563",
                        textAlign: "left",
                        padding: "0.4rem",
                      }}
                    >
                      VIN
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #4b5563",
                        textAlign: "left",
                        padding: "0.4rem",
                      }}
                    >
                      Make
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #4b5563",
                        textAlign: "left",
                        padding: "0.4rem",
                      }}
                    >
                      Model
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #4b5563",
                        textAlign: "left",
                        padding: "0.4rem",
                      }}
                    >
                      Year
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((r) => (
                    <tr key={r.vin}>
                      <td
                        style={{
                          borderBottom: "1px solid #111827",
                          padding: "0.4rem",
                        }}
                      >
                        {r.vin}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #111827",
                          padding: "0.4rem",
                        }}
                      >
                        {r.make}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #111827",
                          padding: "0.4rem",
                        }}
                      >
                        {r.model}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #111827",
                          padding: "0.4rem",
                        }}
                      >
                        {r.modelYear}
                      </td>
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
