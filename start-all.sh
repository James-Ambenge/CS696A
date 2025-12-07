#!/bin/bash

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend (vin-api-server)…"
cd "$BASE_DIR/vin-api-server"
npm start &

echo "Starting frontend (vin-lookup)…"
cd "$BASE_DIR/vin-lookup"
npm run dev &

echo "✔ Both servers started!"
echo "Backend:  http://localhost:4000"
echo "Frontend: Vite will print the actual port (usually 5173)"
