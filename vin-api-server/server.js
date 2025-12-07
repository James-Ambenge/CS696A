const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Proxy endpoint for recalls by VIN
app.get('/api/recalls', async (req, res) => {
  const vin = (req.query.vin || '').trim().toUpperCase();

  if (!vin) {
    return res.status(400).json({ error: 'vin query param is required' });
  }

  try {
    const upstreamUrl = `https://api.nhtsa.gov/recalls/recallsByVin?vin=${vin}`;
    console.log('Fetching recalls from:', upstreamUrl);

    const upstreamRes = await fetch(upstreamUrl);

    const data = await upstreamRes.json();

    // Forward status & JSON back to frontend
    res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error('Error fetching recalls:', err);
    res.status(500).json({ error: 'Failed to fetch recalls from NHTSA' });
  }
});

app.listen(PORT, () => {
  console.log(`VIN API server listening on http://localhost:${PORT}`);
});
