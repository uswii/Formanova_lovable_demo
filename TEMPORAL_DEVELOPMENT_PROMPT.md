# Temporal Backend Development Prompt

## Give This Entire Document to Your Coding Agent

---

## Project Overview

Build a Temporal workflow backend that orchestrates a jewelry virtual try-on image generation pipeline. The system takes user photos, processes them through multiple ML microservices, and returns AI-generated images with jewelry composited onto the person.

**Tech Stack Required:**
- Temporal (workflow orchestration)
- Python or TypeScript/Node.js (your choice for workers)
- FastAPI or Express (for REST API gateway)
- Docker (for deployment)

---

## What You're Building

### 1. REST API Gateway

A simple HTTP server that:
- Receives requests from a React frontend
- Starts Temporal workflows
- Returns workflow status and results

### 2. Temporal Workflow

A single workflow `JewelryGenerationWorkflow` that orchestrates these steps:
1. Upload image to Azure Blob Storage
2. Resize image (max 1536px)
3. Check if background removal is needed
4. Remove background (if needed) via BiRefNet service
5. Generate segmentation mask via SAM3 service
6. Refine mask with brush strokes (if provided)
7. Generate final images via A100 server (Flux + Gemini models)

### 3. Temporal Activities

Individual functions that call external services:
- `upload_to_azure` - Upload base64 image to Azure
- `resize_image` - Call image manipulator service
- `check_zoom` - Determine if bg removal needed
- `remove_background` - Call BiRefNet (async job pattern)
- `generate_mask` - Call SAM3 (async job pattern)
- `refine_mask` - Call A100 server
- `generate_images` - Call A100 server for final generation

---

## API Endpoints to Implement

### POST /workflow/start

**Request:**
```json
{
  "originalImageBase64": "string (base64 JPEG/PNG)",
  "maskPoints": [
    {"x": 0.5, "y": 0.3, "label": 1},
    {"x": 0.1, "y": 0.8, "label": 0}
  ],
  "brushStrokes": [
    {
      "points": [{"x": 0.5, "y": 0.5}, {"x": 0.52, "y": 0.51}],
      "mode": "add",
      "size": 20
    }
  ],
  "sessionId": "optional-string"
}
```

**Response (202 Accepted):**
```json
{
  "workflowId": "uuid-string",
  "status": "RUNNING"
}
```

### GET /workflow/{workflowId}

**Response (Running):**
```json
{
  "workflowId": "uuid",
  "status": "RUNNING",
  "progress": 45,
  "currentStep": "GENERATING_MASK"
}
```

**Response (Completed):**
```json
{
  "workflowId": "uuid",
  "status": "COMPLETED",
  "result": {
    "fluxResultBase64": "base64-jpeg",
    "geminiResultBase64": "base64-jpeg or null",
    "fluxMetrics": {
      "precision": 0.98,
      "recall": 0.95,
      "iou": 0.92,
      "growthRatio": 1.02
    },
    "geminiMetrics": {...} or null,
    "fluxFidelityVizBase64": "base64-jpeg or null",
    "geminiFidelityVizBase64": "base64-jpeg or null"
  }
}
```

**Response (Failed):**
```json
{
  "workflowId": "uuid",
  "status": "FAILED",
  "error": {
    "code": "A100_UNAVAILABLE",
    "message": "A100 server is offline",
    "failedStep": "GENERATING_IMAGES"
  }
}
```

### POST /workflow/{workflowId}/cancel

**Response:**
```json
{
  "workflowId": "uuid",
  "status": "CANCELLED"
}
```

### GET /health

**Response:**
```json
{
  "status": "healthy",
  "temporal": "connected",
  "services": {
    "a100": "online",
    "imageManipulator": "online",
    "birefnet": "online",
    "sam3": "online"
  }
}
```

---

## External Services You Need to Call

### 1. Azure Blob Storage (for image uploads)

**Upload Pattern:**
```python
# Use Azure SDK or REST API
# Container: jewelry-uploads
# Generate SAS tokens for access

# Example upload:
blob_name = f"{uuid4()}.jpg"
blob_client.upload_blob(base64_decoded_data)
azure_uri = f"azure://jewelry-uploads/{blob_name}"
```

**Environment Variables Needed:**
```
AZURE_ACCOUNT_NAME=jewelrytryon
AZURE_ACCOUNT_KEY=<will be provided>
AZURE_CONTAINER=jewelry-uploads
```

### 2. Image Manipulator Service

**Base URL:** `http://20.106.235.80:8005`

**POST /resize**
```json
// Request
{
  "image_uri": "azure://jewelry-uploads/xxx.jpg",
  "max_dimension": 1536
}
// Response
{
  "resized_uri": "azure://jewelry-uploads/xxx-resized.jpg",
  "original_width": 4000,
  "original_height": 3000,
  "new_width": 1536,
  "new_height": 1152
}
```

**POST /zoom_check**
```json
// Request
{
  "image_uri": "azure://jewelry-uploads/xxx.jpg"
}
// Response
{
  "recommend_bg_removal": true,
  "zoom_level": 0.3
}
```

### 3. BiRefNet Service (Background Removal - Modal)

**Base URL:** `https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run`

**This is an ASYNC JOB pattern:**

**Step 1 - Submit Job:**
```
POST /jobs
{
  "image_uri": "azure://jewelry-uploads/xxx.jpg"
}
Response: {"job_id": "abc123"}
```

**Step 2 - Poll until complete:**
```
GET /jobs/abc123
Response: {
  "status": "processing" | "completed" | "failed",
  "result_uri": "azure://jewelry-uploads/xxx-nobg.png"  // when completed
}
```

**Poll every 2 seconds, timeout after 2 minutes**

### 4. SAM3 Service (Segmentation - Modal)

**Base URL:** `https://nemoooooooooo--sam3-service-fastapi-app.modal.run`

**Same ASYNC JOB pattern as BiRefNet:**

**Submit Job:**
```
POST /jobs
{
  "image_uri": "azure://...",
  "points": [[0.5, 0.3], [0.52, 0.35]],  // x,y normalized 0-1
  "labels": [1, 1]  // 1=foreground, 0=background
}
Response: {"job_id": "xyz789"}
```

**Poll:**
```
GET /jobs/xyz789
Response: {
  "status": "completed",
  "mask_uri": "azure://jewelry-uploads/xxx-mask.png"
}
```

### 5. A100 Server (ML Generation)

**Base URL:** Dynamic - check health first at known IPs or use service discovery

**GET /health**
```json
{"status": "online", "gpu_memory_free": 40000}
```

**POST /refine_mask**
```json
// Request
{
  "image_uri": "azure://...",
  "mask_uri": "azure://...",
  "strokes": [
    {
      "points": [[0.5, 0.5], [0.52, 0.51]],
      "mode": "add",
      "size": 20
    }
  ]
}
// Response
{
  "refined_mask_uri": "azure://..."
}
```

**POST /generate**
```json
// Request
{
  "image_uri": "azure://...",
  "mask_uri": "azure://..."
}
// Response
{
  "result_base64": "base64-jpeg (Flux result)",
  "result_gemini_base64": "base64-jpeg or null",
  "fidelity_viz_base64": "base64-jpeg or null",
  "fidelity_viz_gemini_base64": "base64-jpeg or null",
  "metrics": {
    "precision": 0.98,
    "recall": 0.95,
    "iou": 0.92,
    "growth_ratio": 1.02
  },
  "metrics_gemini": {...} or null
}
```

---

## Workflow Logic (Pseudocode)

```python
@workflow.defn
class JewelryGenerationWorkflow:
    
    @workflow.run
    async def run(self, input: WorkflowInput) -> WorkflowOutput:
        # Track progress
        self.progress = 0
        self.current_step = "UPLOADING_IMAGE"
        
        # Step 1: Upload original image
        self.progress = 5
        upload_result = await workflow.execute_activity(
            upload_to_azure,
            args=[input.original_image_base64, "image/jpeg"],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=5)
        )
        
        # Step 2: Resize
        self.current_step = "RESIZING_IMAGE"
        self.progress = 15
        resize_result = await workflow.execute_activity(
            resize_image,
            args=[upload_result.azure_uri, 1536],
            start_to_close_timeout=timedelta(seconds=30)
        )
        
        # Step 3: Check zoom
        self.current_step = "CHECKING_ZOOM"
        self.progress = 20
        zoom_result = await workflow.execute_activity(
            check_zoom,
            args=[resize_result.resized_uri],
            start_to_close_timeout=timedelta(seconds=30)
        )
        
        image_for_segmentation = resize_result.resized_uri
        background_removed = False
        
        # Step 4: Remove background if needed
        if zoom_result.recommend_bg_removal:
            self.current_step = "REMOVING_BACKGROUND"
            self.progress = 30
            bg_result = await workflow.execute_activity(
                remove_background,
                args=[resize_result.resized_uri],
                start_to_close_timeout=timedelta(seconds=120)
            )
            image_for_segmentation = bg_result.result_uri
            background_removed = True
        
        # Step 5: Generate mask with SAM3
        self.current_step = "GENERATING_MASK"
        self.progress = 45
        mask_result = await workflow.execute_activity(
            generate_mask,
            args=[image_for_segmentation, input.mask_points],
            start_to_close_timeout=timedelta(seconds=120)
        )
        
        final_mask_uri = mask_result.mask_uri
        
        # Step 6: Refine mask if brush strokes provided
        if input.brush_strokes and len(input.brush_strokes) > 0:
            self.current_step = "REFINING_MASK"
            self.progress = 55
            refine_result = await workflow.execute_activity(
                refine_mask,
                args=[image_for_segmentation, mask_result.mask_uri, input.brush_strokes],
                start_to_close_timeout=timedelta(seconds=60)
            )
            final_mask_uri = refine_result.refined_mask_uri
        
        # Step 7: Generate final images
        self.current_step = "GENERATING_IMAGES"
        self.progress = 70
        generate_result = await workflow.execute_activity(
            generate_images,
            args=[resize_result.resized_uri, final_mask_uri],
            start_to_close_timeout=timedelta(seconds=180)
        )
        
        self.current_step = "COMPLETED"
        self.progress = 100
        
        return WorkflowOutput(
            flux_result_base64=generate_result.result_base64,
            gemini_result_base64=generate_result.result_gemini_base64,
            flux_metrics=generate_result.metrics,
            gemini_metrics=generate_result.metrics_gemini,
            flux_fidelity_viz_base64=generate_result.fidelity_viz_base64,
            gemini_fidelity_viz_base64=generate_result.fidelity_viz_gemini_base64,
            background_removed=background_removed
        )
    
    @workflow.query
    def get_progress(self) -> dict:
        return {
            "progress": self.progress,
            "currentStep": self.current_step
        }
```

---

## Retry Policies

### For Image Processing (upload, resize, zoom_check):
```python
RetryPolicy(
    initial_interval=timedelta(seconds=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=10),
    maximum_attempts=5
)
```

### For ML Services (birefnet, sam3, a100):
```python
RetryPolicy(
    initial_interval=timedelta(seconds=2),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=30),
    maximum_attempts=3,
    non_retryable_error_types=["A100UnavailableError"]
)
```

---

## CORS Configuration

The API gateway must allow CORS from:
- `http://localhost:*` (development)
- `https://*.lovableproject.com` (production)

```python
# FastAPI example
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or restrict to specific origins
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Deployment Requirements

1. **Temporal Server** - Can use Temporal Cloud or self-hosted
2. **API Gateway** - FastAPI/Express server (can be on same machine as worker)
3. **Temporal Worker** - Process that runs the workflow and activities
4. **Docker Compose** recommended for local development

**Minimum resources:**
- 2 CPU cores
- 4GB RAM
- Worker should be able to make HTTP calls to all external services

---

## What to Return When Complete

Once you've built this, provide:

1. **API Gateway URL** (e.g., `https://your-temporal-api.com`)
2. **Health endpoint confirmation** that shows all services connected
3. **Test with a sample workflow** to confirm it works end-to-end

---

## Questions to Clarify

If anything is unclear, ask about:
- Azure credentials (I'll provide AZURE_ACCOUNT_KEY)
- A100 server IP (may be dynamic)
- Preferred language (Python vs TypeScript)
- Hosting preference (Cloud Run, EC2, etc.)
