# Temporal Integration Technical Specification
## Jewelry Virtual Try-On Workflow

**Version:** 1.0  
**Last Updated:** 2025-01-29  
**Status:** Draft

---

## Table of Contents
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [API Endpoints](#3-api-endpoints)
4. [Workflow Definition](#4-workflow-definition)
5. [Activity Definitions](#5-activity-definitions)
6. [Data Structures](#6-data-structures)
7. [Retry Policies](#7-retry-policies)
8. [Error Handling](#8-error-handling)
9. [External Service Integration](#9-external-service-integration)
10. [Monitoring & Observability](#10-monitoring--observability)

---

## 1. Overview

### 1.1 Purpose
This document specifies the Temporal workflow implementation for orchestrating the jewelry virtual try-on image generation pipeline. The workflow coordinates multiple microservices to:
1. Process and resize uploaded images
2. Remove backgrounds when needed
3. Generate segmentation masks from user-marked points
4. Refine masks with brush strokes
5. Generate final composited images using Flux and Gemini models

### 1.2 Current State (Frontend Orchestration)
Currently, the React frontend directly orchestrates all microservice calls:
- State is held in browser memory (lost on refresh)
- No automatic retries on transient failures
- Complex error recovery logic in frontend
- User must wait with browser open for full pipeline (~30-60 seconds)

### 1.3 Target State (Temporal Orchestration)
With Temporal:
- Durable workflow state persisted in Temporal server
- Automatic retries with exponential backoff
- Workflows resume after failures (network, service restarts)
- Frontend only starts workflow and polls for status
- User can close browser and return later

---

## 2. Architecture

### 2.1 System Components

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
│  GET  /workflow/{id}      - Get workflow status and results             │
│  POST /workflow/{id}/cancel - Cancel running workflow                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEMPORAL SERVER                                 │
│  - Workflow execution engine                                            │
│  - Durable state persistence                                            │
│  - Retry orchestration                                                  │
│  - Activity scheduling                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEMPORAL WORKER                                 │
│  - Executes JewelryGenerationWorkflow                                   │
│  - Runs activity implementations                                        │
│  - Calls external microservices                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  Azure Blob       │   │  Modal Services   │   │  A100 Server      │
│  Storage          │   │  - BiRefNet       │   │  - Segment        │
│  - Upload         │   │  - SAM3           │   │  - Refine Mask    │
│  - Get SAS        │   │                   │   │  - Generate       │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  Image            │                       │                       │
│  Manipulator      │                       │                       │
│  - Resize         │                       │                       │
│  - Zoom Check     │                       │                       │
└───────────────────┘                       │                       │
```

### 2.2 Task Queue Configuration

| Queue Name | Purpose | Concurrency |
|------------|---------|-------------|
| `jewelry-generation` | Main workflow queue | 10 workflows |
| `image-processing` | Azure, resize, zoom check | 20 activities |
| `ml-inference` | BiRefNet, SAM3, A100 calls | 5 activities |

---

## 3. API Endpoints

### 3.1 Start Workflow

**Endpoint:** `POST /workflow/start`

**Request Body:**
```typescript
{
  // Required: Base64 encoded original image
  "originalImageBase64": string,
  
  // Required: User-marked points for SAM3 segmentation
  "maskPoints": Array<{
    x: number,           // 0-1 normalized coordinate
    y: number,           // 0-1 normalized coordinate
    label: 0 | 1         // 0 = background, 1 = foreground
  }>,
  
  // Optional: Brush stroke refinements
  "brushStrokes": Array<{
    points: Array<{ x: number, y: number }>,  // Normalized coordinates
    mode: "add" | "remove",
    size: number         // Brush size in pixels (original image scale)
  }>,
  
  // Optional: Session ID for tracking
  "sessionId": string,
  
  // Optional: User ID for association
  "userId": string
}
```

**Response (Success - 202 Accepted):**
```typescript
{
  "workflowId": string,      // UUID for polling
  "status": "RUNNING",
  "message": "Workflow started successfully",
  "estimatedDuration": 45    // Seconds (estimate)
}
```

**Response (Error - 400 Bad Request):**
```typescript
{
  "error": "VALIDATION_ERROR",
  "message": "originalImageBase64 is required",
  "details": { ... }
}
```

---

### 3.2 Get Workflow Status

**Endpoint:** `GET /workflow/{workflowId}`

**Response (Running):**
```typescript
{
  "workflowId": string,
  "status": "RUNNING",
  "currentStep": string,     // e.g., "GENERATING_WITH_FLUX"
  "progress": number,        // 0-100
  "stepDetails": {
    "stepsCompleted": number,
    "totalSteps": number,
    "currentStepName": string,
    "currentStepStartedAt": string  // ISO timestamp
  }
}
```

**Response (Completed):**
```typescript
{
  "workflowId": string,
  "status": "COMPLETED",
  "result": {
    // Primary result (Flux)
    "fluxResultBase64": string,
    "fluxFidelityVizBase64": string | null,
    "fluxMetrics": {
      "precision": number,   // 0-1
      "recall": number,      // 0-1
      "iou": number,         // 0-1
      "growthRatio": number  // Typically 0.9-1.1
    } | null,
    
    // Secondary result (Gemini)
    "geminiResultBase64": string | null,
    "geminiFidelityVizBase64": string | null,
    "geminiMetrics": {
      "precision": number,
      "recall": number,
      "iou": number,
      "growthRatio": number
    } | null,
    
    // Intermediate artifacts (for debugging/retry)
    "processedImageUri": string,      // Azure URI
    "finalMaskUri": string,           // Azure URI
    "backgroundRemoved": boolean
  },
  "duration": number,        // Total seconds
  "completedAt": string      // ISO timestamp
}
```

**Response (Failed):**
```typescript
{
  "workflowId": string,
  "status": "FAILED",
  "error": {
    "code": string,          // e.g., "A100_UNAVAILABLE"
    "message": string,
    "failedStep": string,    // Which activity failed
    "retryCount": number,    // How many retries were attempted
    "isRetryable": boolean   // Can user retry?
  },
  "partialResult": { ... } | null  // Any completed artifacts
}
```

**Response (Cancelled):**
```typescript
{
  "workflowId": string,
  "status": "CANCELLED",
  "cancelledAt": string,
  "cancelledBy": "USER" | "SYSTEM" | "TIMEOUT"
}
```

---

### 3.3 Cancel Workflow

**Endpoint:** `POST /workflow/{workflowId}/cancel`

**Request Body:**
```typescript
{
  "reason": string   // Optional cancellation reason
}
```

**Response (Success - 200 OK):**
```typescript
{
  "workflowId": string,
  "status": "CANCELLING",
  "message": "Cancellation requested"
}
```

---

## 4. Workflow Definition

### 4.1 Workflow: JewelryGenerationWorkflow

**Task Queue:** `jewelry-generation`  
**Workflow ID Pattern:** `jewelry-gen-{uuid}`  
**Execution Timeout:** 5 minutes  
**Run Timeout:** 5 minutes

```typescript
// Workflow interface
interface JewelryGenerationWorkflow {
  // Main workflow execution
  execute(input: WorkflowInput): Promise<WorkflowOutput>;
  
  // Query handlers (for status checks)
  getProgress(): WorkflowProgress;
  getCurrentStep(): string;
  
  // Signal handlers (for cancellation)
  cancel(reason: string): void;
}

interface WorkflowInput {
  originalImageBase64: string;
  maskPoints: MaskPoint[];
  brushStrokes?: BrushStroke[];
  sessionId?: string;
  userId?: string;
}

interface WorkflowOutput {
  fluxResultBase64: string;
  fluxFidelityVizBase64: string | null;
  fluxMetrics: Metrics | null;
  geminiResultBase64: string | null;
  geminiFidelityVizBase64: string | null;
  geminiMetrics: Metrics | null;
  processedImageUri: string;
  finalMaskUri: string;
  backgroundRemoved: boolean;
}
```

### 4.2 Workflow Steps (Pseudocode)

```typescript
async function execute(input: WorkflowInput): Promise<WorkflowOutput> {
  // Step 1: Upload original image to Azure
  setProgress(5, "UPLOADING_IMAGE");
  const uploadResult = await activities.uploadToAzure({
    base64: input.originalImageBase64,
    contentType: "image/jpeg"
  });
  
  // Step 2: Resize to fixed 2000x2667 (SAM workspace size)
  setProgress(15, "RESIZING_IMAGE");
  const resizeResult = await activities.resizeImage({
    imageUri: uploadResult.azureUri,
    targetWidth: 2000,
    targetHeight: 2667
  });
  
  // Step 3: Check if background removal needed
  setProgress(20, "CHECKING_ZOOM");
  const zoomCheck = await activities.checkZoom({
    imageUri: resizeResult.resizedUri
  });
  
  let imageForSegmentation = resizeResult.resizedUri;
  let backgroundRemoved = false;
  
  // Step 4: Remove background if recommended
  if (zoomCheck.recommendBgRemoval) {
    setProgress(30, "REMOVING_BACKGROUND");
    const bgRemoveResult = await activities.removeBackground({
      imageUri: resizeResult.resizedUri
    });
    imageForSegmentation = bgRemoveResult.resultUri;
    backgroundRemoved = true;
  }
  
  // Step 5: Generate mask with SAM3
  setProgress(45, "GENERATING_MASK");
  const sam3Result = await activities.generateMask({
    imageUri: imageForSegmentation,
    points: input.maskPoints
  });
  
  let finalMaskUri = sam3Result.maskUri;
  
  // Step 6: Refine mask with brush strokes (if any)
  if (input.brushStrokes && input.brushStrokes.length > 0) {
    setProgress(55, "REFINING_MASK");
    const refineResult = await activities.refineMask({
      imageUri: imageForSegmentation,
      maskUri: sam3Result.maskUri,
      strokes: input.brushStrokes
    });
    finalMaskUri = refineResult.refinedMaskUri;
  }
  
  // Step 7: Upload final mask to Azure (for A100)
  setProgress(60, "UPLOADING_MASK");
  const maskUpload = await activities.uploadMaskToAzure({
    maskUri: finalMaskUri
  });
  
  // Step 8: Generate with Flux + Gemini
  setProgress(70, "GENERATING_IMAGES");
  const generateResult = await activities.generateImages({
    imageUri: resizeResult.resizedUri,
    maskUri: maskUpload.azureUri
  });
  
  setProgress(100, "COMPLETED");
  
  return {
    fluxResultBase64: generateResult.fluxResult,
    fluxFidelityVizBase64: generateResult.fluxFidelityViz,
    fluxMetrics: generateResult.fluxMetrics,
    geminiResultBase64: generateResult.geminiResult,
    geminiFidelityVizBase64: generateResult.geminiFidelityViz,
    geminiMetrics: generateResult.geminiMetrics,
    processedImageUri: resizeResult.resizedUri,
    finalMaskUri: maskUpload.azureUri,
    backgroundRemoved
  };
}
```

---

## 5. Activity Definitions

### 5.1 Activity: uploadToAzure

**Task Queue:** `image-processing`  
**Start-to-Close Timeout:** 30 seconds  
**Retry Policy:** See [Section 7.1](#71-image-processing-activities)

**Input:**
```typescript
{
  base64: string,         // Base64 encoded image data
  contentType: string     // "image/jpeg" or "image/png"
}
```

**Output:**
```typescript
{
  azureUri: string,       // "azure://jewelry-uploads/{uuid}.jpg"
  sasUrl: string,         // Full HTTPS URL with SAS token
  httpsUrl: string        // HTTPS URL without SAS
}
```

**External Call:**
- **Service:** Supabase Edge Function `azure-upload`
- **Method:** POST
- **Endpoint:** `/functions/v1/azure-upload`

---

### 5.2 Activity: resizeImage

**Task Queue:** `image-processing`  
**Start-to-Close Timeout:** 30 seconds  
**Retry Policy:** See [Section 7.1](#71-image-processing-activities)

**Input:**
```typescript
{
  imageUri: string,       // Azure URI
  targetWidth: number,    // 2000
  targetHeight: number    // 2667
}
```

**Output:**
```typescript
{
  imageBase64: string,    // Base64 of resized image
  padding: {
    top: number,
    bottom: number,
    left: number,
    right: number
  }
}
```

**External Call:**
- **Service:** Image Manipulator (Azure VM) - YOUR EXISTING SERVICE
- **Base URL:** `http://20.106.235.80:8005`
- **Method:** POST
- **Endpoint:** `/resize`
- **Body:**
  ```json
  {
    "image": { "uri": "azure://..." },
    "target_width": 2000,
    "target_height": 2667,
    "flag": "fixed_dimensions"
  }
  ```

---

### 5.3 Activity: checkZoom

**Task Queue:** `image-processing`  
**Start-to-Close Timeout:** 30 seconds  
**Retry Policy:** See [Section 7.1](#71-image-processing-activities)

**Input:**
```typescript
{
  imageUri: string        // Azure URI of resized image
}
```

**Output:**
```typescript
{
  recommendBgRemoval: boolean,
  zoomLevel: number,      // 0-1 score
  reason: string          // Human-readable explanation
}
```

**External Call:**
- **Service:** Image Manipulator (Azure VM)
- **Base URL:** `http://20.106.235.80:8005`
- **Method:** POST
- **Endpoint:** `/zoom_check`
- **Body:**
  ```json
  {
    "image_uri": "azure://..."
  }
  ```

---

### 5.4 Activity: removeBackground

**Task Queue:** `ml-inference`  
**Start-to-Close Timeout:** 120 seconds (Modal cold start)  
**Retry Policy:** See [Section 7.2](#72-ml-inference-activities)

**Input:**
```typescript
{
  imageUri: string        // Azure URI
}
```

**Output:**
```typescript
{
  resultUri: string,      // Azure URI of image with removed background
  processingTime: number  // Seconds
}
```

**External Call (Async Job Pattern):**
1. **Submit Job:**
   - **Service:** BiRefNet (Modal)
   - **URL:** `https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run/jobs`
   - **Method:** POST
   - **Body:** `{ "image_uri": "azure://..." }`
   - **Response:** `{ "job_id": "..." }`

2. **Poll Job (every 2 seconds, max 60 attempts):**
   - **URL:** `https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run/jobs/{job_id}`
   - **Method:** GET
   - **Response:**
     ```json
     {
       "status": "completed" | "processing" | "failed",
       "result_uri": "azure://...",
       "error": "..." 
     }
     ```

---

### 5.5 Activity: generateMask

**Task Queue:** `ml-inference`  
**Start-to-Close Timeout:** 120 seconds  
**Retry Policy:** See [Section 7.2](#72-ml-inference-activities)

**Input:**
```typescript
{
  imageUri: string,
  points: Array<{
    x: number,            // 0-1 normalized
    y: number,            // 0-1 normalized
    label: 0 | 1          // 0=background, 1=foreground
  }>
}
```

**Output:**
```typescript
{
  maskUri: string,        // Azure URI of binary mask
  confidence: number      // 0-1 confidence score
}
```

**External Call (Async Job Pattern):**
1. **Submit Job:**
   - **Service:** SAM3 (Modal)
   - **URL:** `https://nemoooooooooo--sam3-service-fastapi-app.modal.run/jobs`
   - **Method:** POST
   - **Body:**
     ```json
     {
       "image_uri": "azure://...",
       "points": [[x1, y1], [x2, y2], ...],
       "labels": [1, 1, 0, ...]
     }
     ```
   - **Response:** `{ "job_id": "..." }`

2. **Poll Job:**
   - **URL:** `.../jobs/{job_id}`
   - **Response:**
     ```json
     {
       "status": "completed",
       "mask_uri": "azure://..."
     }
     ```

---

### 5.6 Activity: refineMask

**Task Queue:** `ml-inference`  
**Start-to-Close Timeout:** 60 seconds  
**Retry Policy:** See [Section 7.2](#72-ml-inference-activities)

**Input:**
```typescript
{
  imageUri: string,       // Original image Azure URI
  maskUri: string,        // Current mask Azure URI
  strokes: Array<{
    points: Array<{ x: number, y: number }>,
    mode: "add" | "remove",
    size: number
  }>
}
```

**Output:**
```typescript
{
  refinedMaskUri: string  // Azure URI of refined mask
}
```

**External Call:**
- **Service:** A100 Server
- **Base URL:** `http://{A100_IP}:8000`
- **Method:** POST
- **Endpoint:** `/refine_mask`
- **Body:**
  ```json
  {
    "image_uri": "azure://...",
    "mask_uri": "azure://...",
    "strokes": [
      {
        "points": [[x1, y1], [x2, y2], ...],
        "mode": "add",
        "size": 20
      }
    ]
  }
  ```

---

### 5.7 Activity: generateImages

**Task Queue:** `ml-inference`  
**Start-to-Close Timeout:** 180 seconds  
**Retry Policy:** See [Section 7.2](#72-ml-inference-activities)

**Input:**
```typescript
{
  imageUri: string,       // Azure URI of processed image
  maskUri: string         // Azure URI of final mask
}
```

**Output:**
```typescript
{
  // Flux results
  fluxResult: string,           // Base64 JPEG
  fluxFidelityViz: string | null,
  fluxMetrics: {
    precision: number,
    recall: number,
    iou: number,
    growthRatio: number
  } | null,
  
  // Gemini results
  geminiResult: string | null,   // Base64 JPEG
  geminiFidelityViz: string | null,
  geminiMetrics: {
    precision: number,
    recall: number,
    iou: number,
    growthRatio: number
  } | null,
  
  processingTime: number         // Seconds
}
```

**External Call:**
- **Service:** A100 Server
- **Base URL:** `http://{A100_IP}:8000`
- **Method:** POST
- **Endpoint:** `/generate`
- **Body:**
  ```json
  {
    "image_uri": "azure://...",
    "mask_uri": "azure://..."
  }
  ```
- **Response:**
  ```json
  {
    "result_base64": "...",
    "result_gemini_base64": "...",
    "fidelity_viz_base64": "...",
    "fidelity_viz_gemini_base64": "...",
    "metrics": {
      "precision": 0.98,
      "recall": 0.95,
      "iou": 0.92,
      "growth_ratio": 1.02
    },
    "metrics_gemini": { ... }
  }
  ```

---

## 6. Data Structures

### 6.1 Common Types

```typescript
// Mask point from user interaction
interface MaskPoint {
  x: number;              // 0-1 normalized (0 = left, 1 = right)
  y: number;              // 0-1 normalized (0 = top, 1 = bottom)
  label: 0 | 1;           // 0 = background, 1 = foreground
}

// Brush stroke for mask refinement
interface BrushStroke {
  points: Array<{ x: number; y: number }>;  // Normalized coordinates
  mode: "add" | "remove";  // Add to mask or remove from mask
  size: number;            // Brush size in original image pixels
}

// Quality metrics from generation
interface Metrics {
  precision: number;       // 0-1, how accurate the mask boundary is
  recall: number;          // 0-1, how much of the target is captured
  iou: number;             // 0-1, intersection over union
  growthRatio: number;     // Typically 0.9-1.1, mask size change
}

// Workflow progress for status queries
interface WorkflowProgress {
  percentage: number;      // 0-100
  currentStep: WorkflowStep;
  stepsCompleted: number;
  totalSteps: number;
  estimatedSecondsRemaining: number | null;
}

// Workflow step enumeration
type WorkflowStep =
  | "UPLOADING_IMAGE"
  | "RESIZING_IMAGE"
  | "CHECKING_ZOOM"
  | "REMOVING_BACKGROUND"
  | "GENERATING_MASK"
  | "REFINING_MASK"
  | "UPLOADING_MASK"
  | "GENERATING_IMAGES"
  | "COMPLETED"
  | "FAILED";
```

### 6.2 Error Types

```typescript
type ErrorCode =
  | "VALIDATION_ERROR"         // Invalid input
  | "AZURE_UPLOAD_FAILED"      // Azure storage error
  | "RESIZE_FAILED"            // Image manipulator error
  | "BIREFNET_UNAVAILABLE"     // Modal service down
  | "SAM3_UNAVAILABLE"         // Modal service down
  | "A100_UNAVAILABLE"         // A100 server offline
  | "A100_BUSY"                // A100 at capacity
  | "GENERATION_FAILED"        // Flux/Gemini generation error
  | "TIMEOUT"                  // Activity timed out
  | "CANCELLED"                // User cancelled
  | "UNKNOWN";                 // Unexpected error

interface WorkflowError {
  code: ErrorCode;
  message: string;
  failedStep: WorkflowStep;
  retryCount: number;
  isRetryable: boolean;
  details?: Record<string, unknown>;
}
```

---

## 7. Retry Policies

### 7.1 Image Processing Activities

For `uploadToAzure`, `resizeImage`, `checkZoom`:

```typescript
{
  initialInterval: "1s",
  backoffCoefficient: 2.0,
  maximumInterval: "10s",
  maximumAttempts: 5,
  nonRetryableErrors: [
    "VALIDATION_ERROR"
  ]
}
```

### 7.2 ML Inference Activities

For `removeBackground`, `generateMask`, `refineMask`, `generateImages`:

```typescript
{
  initialInterval: "2s",
  backoffCoefficient: 2.0,
  maximumInterval: "30s",
  maximumAttempts: 3,
  nonRetryableErrors: [
    "VALIDATION_ERROR",
    "A100_UNAVAILABLE"      // Don't retry if server is down
  ]
}
```

### 7.3 Job Polling (Within Activities)

For async job polling (BiRefNet, SAM3):

```typescript
{
  pollInterval: "2s",
  maxAttempts: 60,           // 2 minutes max
  exponentialBackoff: false  // Fixed interval polling
}
```

---

## 8. Error Handling

### 8.1 Transient Errors (Automatic Retry)

| Error | Retry Strategy |
|-------|---------------|
| Network timeout | Retry with backoff |
| 503 Service Unavailable | Retry with backoff |
| Azure rate limit (429) | Retry after delay |
| Modal cold start timeout | Retry once |

### 8.2 Permanent Errors (Fail Workflow)

| Error | Action |
|-------|--------|
| Invalid image format | Fail immediately, return validation error |
| A100 server offline | Fail after health check, return A100_UNAVAILABLE |
| Image too large (>20MB) | Fail immediately, return validation error |
| Invalid mask points | Fail immediately, return validation error |

### 8.3 Partial Failure Handling

If the workflow fails after some activities complete:

1. **Return partial results** in the failure response:
   - Include `processedImageUri` if resize completed
   - Include `maskUri` if segmentation completed
   
2. **Enable manual retry** from last successful step (future enhancement)

### 8.4 Cancellation Handling

When user cancels:
1. Signal is sent to workflow
2. Current activity is allowed to complete (or timeout)
3. No further activities are scheduled
4. Return `CANCELLED` status with any partial results

---

## 9. External Service Integration

### 9.1 Service Health Checks

Before starting workflows, check service health:

| Service | Health Endpoint | Expected Response |
|---------|-----------------|-------------------|
| A100 Server | `GET /health` | `{"status": "online"}` |
| Image Manipulator | `GET /health` | `200 OK` |
| BiRefNet | `GET /` | `200 OK` |
| SAM3 | `GET /` | `200 OK` |

### 9.2 Service URLs (Environment Variables)

```bash
# Azure Storage
AZURE_ACCOUNT_NAME=jewelrytryon
AZURE_ACCOUNT_KEY=<secret>
AZURE_CONTAINER=jewelry-uploads

# Image Manipulator (Azure VM)
IMAGE_MANIPULATOR_URL=http://20.106.235.80:8005

# BiRefNet (Modal)
BIREFNET_URL=https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run

# SAM3 (Modal)
SAM3_URL=https://nemoooooooooo--sam3-service-fastapi-app.modal.run

# A100 Server (Dynamic - from health check)
A100_URL=http://{dynamic_ip}:8000
```

### 9.3 Authentication

| Service | Auth Method |
|---------|-------------|
| Azure Blob Storage | SAS Token (generated per request) |
| Image Manipulator | None (internal network) |
| BiRefNet (Modal) | None (public endpoint) |
| SAM3 (Modal) | None (public endpoint) |
| A100 Server | None (internal network) |

---

## 10. Monitoring & Observability

### 10.1 Metrics to Track

| Metric | Type | Labels |
|--------|------|--------|
| `workflow_started_total` | Counter | `session_id` |
| `workflow_completed_total` | Counter | `status`, `session_id` |
| `workflow_duration_seconds` | Histogram | `status` |
| `activity_duration_seconds` | Histogram | `activity_name`, `status` |
| `activity_retries_total` | Counter | `activity_name`, `error_code` |
| `external_service_latency_seconds` | Histogram | `service_name` |
| `external_service_errors_total` | Counter | `service_name`, `error_code` |

### 10.2 Logging

All activities should log:
- Activity start with input parameters (excluding base64 data)
- External service request/response (status codes, timing)
- Activity completion with output summary
- Errors with full stack traces

### 10.3 Alerting Thresholds

| Condition | Alert Level |
|-----------|-------------|
| A100 server offline > 5 min | Critical |
| Workflow failure rate > 10% | Warning |
| Activity retry rate > 20% | Warning |
| Average workflow duration > 90s | Info |
| Modal service latency > 30s | Warning |

---

## Appendix A: Workflow State Machine

```
                    ┌──────────────┐
                    │   STARTED    │
                    └──────┬───────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │            UPLOADING_IMAGE           │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │            RESIZING_IMAGE            │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │            CHECKING_ZOOM             │
        └──────────────────┬───────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
   ┌────────────────────┐    ┌─────────────────────┐
   │ REMOVING_BACKGROUND│    │   (skip to next)    │
   └─────────┬──────────┘    └──────────┬──────────┘
             │                          │
             └────────────┬─────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────┐
        │           GENERATING_MASK            │
        └──────────────────┬───────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
   ┌────────────────────┐    ┌─────────────────────┐
   │   REFINING_MASK    │    │   (skip to next)    │
   └─────────┬──────────┘    └──────────┬──────────┘
             │                          │
             └────────────┬─────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────┐
        │           UPLOADING_MASK             │
        └──────────────────┬───────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │          GENERATING_IMAGES           │
        └──────────────────┬───────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        ┌───────────┐             ┌───────────┐
        │ COMPLETED │             │  FAILED   │
        └───────────┘             └───────────┘
```

---

## Appendix B: Sample API Requests

### Start Workflow (cURL)

```bash
curl -X POST https://api.yourservice.com/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "originalImageBase64": "/9j/4AAQSkZJRg...",
    "maskPoints": [
      {"x": 0.5, "y": 0.3, "label": 1},
      {"x": 0.52, "y": 0.35, "label": 1},
      {"x": 0.1, "y": 0.8, "label": 0}
    ],
    "sessionId": "session-123"
  }'
```

### Poll Status (cURL)

```bash
curl https://api.yourservice.com/workflow/abc123-def456
```

---

## Appendix C: Frontend Integration Example

```typescript
// services/temporalApi.ts
const TEMPORAL_API_URL = import.meta.env.VITE_TEMPORAL_API_URL;

export async function startGenerationWorkflow(input: {
  originalImageBase64: string;
  maskPoints: MaskPoint[];
  brushStrokes?: BrushStroke[];
}): Promise<{ workflowId: string }> {
  const response = await fetch(`${TEMPORAL_API_URL}/workflow/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to start workflow: ${response.status}`);
  }
  
  return response.json();
}

export async function pollWorkflowStatus(
  workflowId: string
): Promise<WorkflowStatus> {
  const response = await fetch(`${TEMPORAL_API_URL}/workflow/${workflowId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to poll workflow: ${response.status}`);
  }
  
  return response.json();
}

// hooks/useGenerationWorkflow.ts
export function useGenerationWorkflow() {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  
  const startWorkflow = async (input: WorkflowInput) => {
    const { workflowId } = await startGenerationWorkflow(input);
    setWorkflowId(workflowId);
    
    // Start polling
    const pollInterval = setInterval(async () => {
      const status = await pollWorkflowStatus(workflowId);
      setStatus(status);
      
      if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        clearInterval(pollInterval);
      }
    }, 2000);
  };
  
  return { startWorkflow, status, workflowId };
}
```

---

**End of Specification**
