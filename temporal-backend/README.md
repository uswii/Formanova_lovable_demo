# Jewelry Generation Temporal Backend

This is the Temporal workflow backend that orchestrates the jewelry virtual try-on image generation pipeline.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                              │
│  - Start workflow with image + mask points                              │
│  - Poll workflow status every 2 seconds                                 │
│  - Display results when complete                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        TEMPORAL API GATEWAY                             │
│  POST /workflow/start     - Start new generation workflow               │
│  POST /workflow/preprocess - Start preprocessing only                   │
│  POST /workflow/generate  - Start generation only                       │
│  GET  /workflow/{id}      - Get workflow status and results             │
│  POST /workflow/{id}/cancel - Cancel running workflow                   │
│  GET  /health             - Health check                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEMPORAL SERVER                                 │
│  - Workflow execution engine                                            │
│  - Durable state persistence                                            │
│  - Retry orchestration                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEMPORAL WORKER                                 │
│  - Executes JewelryGenerationWorkflow                                   │
│  - Runs activity implementations                                        │
│  - Calls external microservices                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Temporal Infrastructure (Docker)

```bash
# Start Temporal server, PostgreSQL, and Web UI
docker-compose up -d temporal temporal-web postgres

# Wait for Temporal to be ready (about 30 seconds)
docker-compose logs -f temporal
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your Azure credentials
nano .env
```

### 3. Run Worker and API Locally

```bash
# Install dependencies and run
chmod +x run_local.sh
./run_local.sh
```

### 4. Or Run Everything in Docker

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# - API Gateway: http://localhost:8001
# - Temporal UI: http://localhost:8088
```

## API Endpoints

### POST /workflow/start

Start a full jewelry generation workflow.

```bash
curl -X POST http://localhost:8001/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "originalImageBase64": "base64-encoded-image-data",
    "maskPoints": [
      {"x": 0.5, "y": 0.3, "label": 1},
      {"x": 0.1, "y": 0.8, "label": 0}
    ]
  }'
```

Response:
```json
{
  "workflowId": "jewelry-gen-uuid",
  "status": "RUNNING"
}
```

### POST /workflow/preprocess

Start preprocessing only (upload, resize, mask generation).

```bash
curl -X POST http://localhost:8001/workflow/preprocess \
  -H "Content-Type: application/json" \
  -d '{
    "originalImageBase64": "base64-encoded-image-data",
    "maskPoints": [{"x": 0.5, "y": 0.3, "label": 1}]
  }'
```

### POST /workflow/generate

Start generation only (needs preprocessed image and mask URIs).

```bash
curl -X POST http://localhost:8001/workflow/generate \
  -H "Content-Type: application/json" \
  -d '{
    "imageUri": "azure://jewelry-uploads/image.jpg",
    "maskUri": "azure://jewelry-uploads/mask.png",
    "brushStrokes": [
      {
        "points": [{"x": 0.5, "y": 0.5}, {"x": 0.52, "y": 0.51}],
        "mode": "add",
        "size": 20
      }
    ]
  }'
```

### GET /workflow/{workflowId}

Get workflow status and results.

```bash
curl http://localhost:8001/workflow/jewelry-gen-uuid
```

Response (running):
```json
{
  "workflowId": "jewelry-gen-uuid",
  "status": "RUNNING",
  "progress": 45,
  "currentStep": "GENERATING_MASK"
}
```

Response (completed):
```json
{
  "workflowId": "jewelry-gen-uuid",
  "status": "COMPLETED",
  "progress": 100,
  "currentStep": "COMPLETED",
  "result": {
    "flux_result_base64": "base64-jpeg",
    "gemini_result_base64": "base64-jpeg or null",
    "flux_metrics": {
      "precision": 0.98,
      "recall": 0.95,
      "iou": 0.92,
      "growth_ratio": 1.02
    }
  }
}
```

### POST /workflow/{workflowId}/cancel

Cancel a running workflow.

```bash
curl -X POST http://localhost:8001/workflow/jewelry-gen-uuid/cancel
```

### GET /health

Health check endpoint.

```bash
curl http://localhost:8001/health
```

Response:
```json
{
  "status": "healthy",
  "temporal": "connected",
  "services": {
    "a100": "online",
    "imageManipulator": "online",
    "birefnet": "unknown",
    "sam3": "unknown"
  }
}
```

## Workflow Steps

The main `JewelryGenerationWorkflow` executes these steps:

| Step | Progress | Description |
|------|----------|-------------|
| UPLOADING_IMAGE | 5% | Upload original image to Azure |
| RESIZING_IMAGE | 15% | Resize to 2000x2667 |
| CHECKING_ZOOM | 20% | Check if background removal needed |
| REMOVING_BACKGROUND | 30% | Remove background (if needed) |
| GENERATING_MASK | 45% | Generate mask with SAM3 |
| REFINING_MASK | 55% | Refine mask with brush strokes |
| UPLOADING_MASK | 60% | Upload final mask |
| GENERATING_IMAGES | 70% | Generate with Flux + Gemini |
| COMPLETED | 100% | Done! |

## External Services

The workflow calls these existing microservices:

| Service | URL | Purpose |
|---------|-----|---------|
| Azure Blob Storage | - | Image storage |
| Image Manipulator | http://20.106.235.80:8005 | Resize, zoom check |
| BiRefNet | Modal | Background removal |
| SAM3 | Modal | Mask generation |
| A100 Server | Configurable | Mask refinement, image generation |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| TEMPORAL_ADDRESS | localhost:7233 | Temporal server address |
| TEMPORAL_NAMESPACE | default | Temporal namespace |
| AZURE_ACCOUNT_NAME | - | Azure storage account |
| AZURE_ACCOUNT_KEY | - | Azure storage key |
| AZURE_CONTAINER_NAME | jewelry-uploads | Azure container |
| IMAGE_MANIPULATOR_URL | http://20.106.235.80:8005 | Image service URL |
| BIREFNET_URL | Modal URL | BiRefNet service URL |
| SAM3_URL | Modal URL | SAM3 service URL |
| A100_SERVER_URL | http://localhost:8000 | A100 server URL |
| API_PORT | 8001 | API gateway port |

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run worker only
python -m src.worker

# Run API only
python -m src.api_gateway

# Run tests
pytest
```

## Troubleshooting

### Temporal not connecting

```bash
# Check Temporal logs
docker-compose logs temporal

# Restart Temporal
docker-compose restart temporal
```

### Worker not processing workflows

```bash
# Check worker logs
docker-compose logs worker

# Verify task queue matches
# Both worker and API must use same task queue
```

### API returning 503

```bash
# Temporal client not connected
# Wait for Temporal to be fully ready
docker-compose logs temporal | grep "ready"
```
