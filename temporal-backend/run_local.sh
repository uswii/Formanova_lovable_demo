#!/bin/bash

# Local development script for Temporal backend
# Run this AFTER starting docker-compose up temporal temporal-web postgres

set -e

echo "=== Jewelry Generation Temporal Backend ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your Azure credentials!"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt -q

# Start worker and API in background
echo ""
echo "Starting Temporal Worker..."
python -m src.worker &
WORKER_PID=$!

sleep 2

echo "Starting API Gateway..."
python -m src.api_gateway &
API_PID=$!

echo ""
echo "=== Services Started ==="
echo "  Worker PID: $WORKER_PID"
echo "  API PID: $API_PID"
echo ""
echo "  API Gateway: http://localhost:${API_PORT:-8001}"
echo "  Health Check: http://localhost:${API_PORT:-8001}/health"
echo "  Temporal UI: http://localhost:8088"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $WORKER_PID 2>/dev/null || true
    kill $API_PID 2>/dev/null || true
    echo "Done"
}
trap cleanup EXIT

# Wait
wait
