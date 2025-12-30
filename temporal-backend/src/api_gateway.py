"""FastAPI REST API Gateway for Temporal workflows."""
import asyncio
import base64
import io
import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from dataclasses import asdict

import numpy as np
import uvicorn
from PIL import Image
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from temporalio.client import Client, WorkflowExecutionStatus, WorkflowHandle
from temporalio.service import RPCError, RPCStatusCode

from .config import config
from .models import WorkflowInput, MaskPoint, BrushStroke, StrokePoint, WorkflowProgress
from .workflows import JewelryGenerationWorkflow, PreprocessingWorkflow, GenerationWorkflow

# Simple logging format
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Jewelry Generation Temporal API",
    description="REST API for orchestrating jewelry virtual try-on workflows",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

temporal_client: Optional[Client] = None


# -------------------------
# Azure Blob Helpers
# -------------------------
def get_blob_service_client() -> BlobServiceClient:
    """Create Azure Blob Service client."""
    connection_string = (
        f"DefaultEndpointsProtocol=https;"
        f"AccountName={config.azure_account_name};"
        f"AccountKey={config.azure_account_key};"
        f"EndpointSuffix=core.windows.net"
    )
    return BlobServiceClient.from_connection_string(connection_string)


async def fetch_blob_as_base64(azure_uri: str) -> str:
    """Fetch a blob from Azure and return as base64."""
    if not azure_uri.startswith("azure://"):
        raise ValueError(f"Expected azure:// URI, got: {azure_uri}")
    
    blob_name = azure_uri.replace(f"azure://{config.azure_container_name}/", "")
    blob_service_client = get_blob_service_client()
    container_client = blob_service_client.get_container_client(config.azure_container_name)
    blob_client = container_client.get_blob_client(blob_name)
    blob_data = blob_client.download_blob().readall()
    
    return base64.b64encode(blob_data).decode('utf-8')


# -------------------------
# Request/Response models
# -------------------------
class MaskPointRequest(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)
    label: int = Field(..., ge=0, le=1)


class StrokePointRequest(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)


class BrushStrokeRequest(BaseModel):
    points: List[StrokePointRequest]
    mode: str = Field(..., pattern="^(add|remove)$")
    size: int = Field(default=20, ge=1, le=100)


class StartWorkflowRequest(BaseModel):
    originalImageBase64: str
    maskPoints: List[MaskPointRequest]
    brushStrokes: Optional[List[BrushStrokeRequest]] = None
    sessionId: Optional[str] = None
    userId: Optional[str] = None


class StartPreprocessingRequest(BaseModel):
    originalImageBase64: str
    maskPoints: List[MaskPointRequest]


class StartGenerationRequest(BaseModel):
    imageUri: str
    maskUri: str
    brushStrokes: Optional[List[BrushStrokeRequest]] = None
    gender: str = Field(default="female")
    scaledPoints: Optional[List[List[float]]] = None


class WorkflowStartResponse(BaseModel):
    workflowId: str
    status: str


class WorkflowStatusResponse(BaseModel):
    workflowId: str
    status: str
    progress: Optional[int] = None
    currentStep: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[dict] = None


class OverlayRequest(BaseModel):
    imageUri: str
    maskUri: str


class OverlayResponse(BaseModel):
    imageBase64: str
    maskBase64: str
    overlayBase64: str


class HealthResponse(BaseModel):
    status: str
    temporal: str
    services: dict


@app.on_event("startup")
async def startup():
    global temporal_client
    try:
        temporal_client = await Client.connect(
            config.temporal_address, namespace=config.temporal_namespace
        )
        logger.info("✓ Connected to Temporal")
    except Exception as e:
        logger.error(f"✗ Temporal connection failed: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    import httpx

    temporal_status = "connected" if temporal_client else "disconnected"

    a100_status = "offline"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{config.a100_server_url}/health")
            if r.status_code == 200:
                a100_status = "online"
    except Exception:
        pass

    image_manipulator_status = "offline"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{config.image_manipulator_url}/health")
            if r.status_code == 200:
                image_manipulator_status = "online"
    except Exception:
        pass

    return HealthResponse(
        status="healthy" if temporal_status == "connected" else "degraded",
        temporal=temporal_status,
        services={
            "a100": a100_status,
            "imageManipulator": image_manipulator_status,
            "birefnet": "unknown",
            "sam3": "unknown",
        },
    )


# -------------------------
# Start endpoints
# -------------------------
@app.post(
    "/workflow/start",
    response_model=WorkflowStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_workflow(request: StartWorkflowRequest):
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")

    workflow_id = f"jewelry-gen-{uuid.uuid4()}"
    try:
        mask_points = [MaskPoint(x=p.x, y=p.y, label=p.label) for p in request.maskPoints]

        brush_strokes = None
        if request.brushStrokes:
            brush_strokes = [
                BrushStroke(
                    points=[StrokePoint(x=p.x, y=p.y) for p in s.points],
                    mode=s.mode,
                    size=s.size,
                )
                for s in request.brushStrokes
            ]

        workflow_input = WorkflowInput(
            original_image_base64=request.originalImageBase64,
            mask_points=mask_points,
            brush_strokes=brush_strokes,
            session_id=request.sessionId,
            user_id=request.userId,
        )

        await temporal_client.start_workflow(
            JewelryGenerationWorkflow.run,
            workflow_input,
            id=workflow_id,
            task_queue=config.main_task_queue,
        )

        logger.info(f"▶ Started: {workflow_id}")
        return WorkflowStartResponse(workflowId=workflow_id, status="RUNNING")
    except Exception as e:
        logger.error(f"✗ Start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/workflow/preprocess",
    response_model=WorkflowStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_preprocessing(request: StartPreprocessingRequest):
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")

    workflow_id = f"preprocess-{uuid.uuid4()}"
    try:
        mask_points = [MaskPoint(x=p.x, y=p.y, label=p.label) for p in request.maskPoints]
        workflow_input = WorkflowInput(
            original_image_base64=request.originalImageBase64,
            mask_points=mask_points,
        )

        await temporal_client.start_workflow(
            PreprocessingWorkflow.run,
            workflow_input,
            id=workflow_id,
            task_queue=config.main_task_queue,
        )

        logger.info(f"▶ Started preprocessing: {workflow_id}")
        return WorkflowStartResponse(workflowId=workflow_id, status="RUNNING")
    except Exception as e:
        logger.error(f"✗ Preprocessing start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/workflow/generate",
    response_model=WorkflowStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_generation(request: StartGenerationRequest):
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")

    workflow_id = f"generate-{uuid.uuid4()}"
    try:
        brush_strokes_data = None
        if request.brushStrokes:
            brush_strokes_data = [
                {
                    "points": [{"x": p.x, "y": p.y} for p in s.points],
                    "mode": s.mode,
                    "size": s.size,
                }
                for s in request.brushStrokes
            ]

        await temporal_client.start_workflow(
            GenerationWorkflow.run,
            args=[
                request.imageUri,
                request.maskUri,
                brush_strokes_data,
                request.gender,
                request.scaledPoints,
            ],
            id=workflow_id,
            task_queue=config.main_task_queue,
        )

        logger.info(f"▶ Started generation: {workflow_id}")
        return WorkflowStartResponse(workflowId=workflow_id, status="RUNNING")
    except Exception as e:
        logger.error(f"✗ Generation start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------
# Safe RPC helpers
# -------------------------
_TRANSIENT_RPC_STATUSES = {RPCStatusCode.CANCELLED, RPCStatusCode.DEADLINE_EXCEEDED}


async def safe_describe(handle: WorkflowHandle, *, timeout: float = 3.0, retries: int = 3):
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            return await asyncio.wait_for(asyncio.shield(handle.describe()), timeout=timeout)
        except asyncio.TimeoutError as e:
            last_error = e
            continue
        except RPCError as e:
            # Transient client-side cancel/deadline; don't treat as workflow cancelled
            if e.status in _TRANSIENT_RPC_STATUSES:
                last_error = e
                continue
            raise
        except asyncio.CancelledError as e:
            last_error = e
            continue
    raise last_error if last_error else Exception("safe_describe failed")


async def safe_query(handle: WorkflowHandle, query_method, *, timeout: float = 2.0, retries: int = 2):
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            return await asyncio.wait_for(asyncio.shield(handle.query(query_method)), timeout=timeout)
        except asyncio.TimeoutError as e:
            last_error = e
            continue
        except RPCError as e:
            # Transient client-side cancellation/deadline
            if e.status in _TRANSIENT_RPC_STATUSES:
                last_error = e
                continue
            raise
        except asyncio.CancelledError as e:
            last_error = e
            continue
    raise last_error if last_error else Exception("safe_query failed")


async def safe_result(handle: WorkflowHandle, *, timeout: float = 1.0):
    """Return result if ready, else None. Never raise on transient CANCELLED/DEADLINE."""
    try:
        return await asyncio.wait_for(asyncio.shield(handle.result()), timeout=timeout)
    except asyncio.TimeoutError:
        return None
    except RPCError as e:
        if e.status in _TRANSIENT_RPC_STATUSES:
            return None
        raise
    except asyncio.CancelledError:
        return None


def _convert_result(result) -> dict:
    if hasattr(result, "__dict__"):
        return asdict(result) if hasattr(result, "__dataclass_fields__") else result.__dict__
    if isinstance(result, dict):
        return result
    return {"data": str(result)}


# -------------------------
# Status endpoint (FIXED)
# -------------------------
@app.get("/workflow/{workflow_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(workflow_id: str):
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")

    try:
        handle = temporal_client.get_workflow_handle(workflow_id)

        # 1) Describe (authoritative execution status)
        try:
            desc = await safe_describe(handle)
        except Exception as e:
            logger.warning(f"safe_describe failed for {workflow_id}: {e}")

            # If describe failed, try result as a fallback
            result = await safe_result(handle, timeout=0.5)
            if result is not None:
                return WorkflowStatusResponse(
                    workflowId=workflow_id,
                    status="COMPLETED",
                    progress=100,
                    currentStep="COMPLETED",
                    result=_convert_result(result),
                )

            # Otherwise best-effort: still running
            return WorkflowStatusResponse(
                workflowId=workflow_id, status="RUNNING", progress=0, currentStep="PROCESSING"
            )

        # IMPORTANT FIX: enum is CANCELED (one L) in temporalio python
        status_map = {
            WorkflowExecutionStatus.RUNNING: "RUNNING",
            WorkflowExecutionStatus.COMPLETED: "COMPLETED",
            WorkflowExecutionStatus.FAILED: "FAILED",
            WorkflowExecutionStatus.CANCELED: "CANCELLED",          # <- map to your API contract spelling
            WorkflowExecutionStatus.TERMINATED: "CANCELLED",
            WorkflowExecutionStatus.TIMED_OUT: "FAILED",
            WorkflowExecutionStatus.CONTINUED_AS_NEW: "RUNNING",    # treat as still running (new run exists)
        }

        workflow_status = status_map.get(desc.status, "UNKNOWN")
        response = WorkflowStatusResponse(workflowId=workflow_id, status=workflow_status)

        # 2) Enrich response
        if workflow_status == "RUNNING":
            try:
                if workflow_id.startswith("preprocess-"):
                    progress = await safe_query(handle, PreprocessingWorkflow.get_progress)
                elif workflow_id.startswith("generate-"):
                    progress = await safe_query(handle, GenerationWorkflow.get_progress)
                else:
                    progress = await safe_query(handle, JewelryGenerationWorkflow.get_progress)

                if isinstance(progress, WorkflowProgress):
                    response.progress = progress.progress
                    response.currentStep = progress.current_step
                elif isinstance(progress, dict):
                    response.progress = progress.get("progress", 0)
                    response.currentStep = progress.get("current_step", "PROCESSING")
                else:
                    response.progress = 0
                    response.currentStep = "PROCESSING"
            except Exception as e:
                logger.debug(f"Progress query failed for {workflow_id}: {e}")
                response.progress = 0
                response.currentStep = "PROCESSING"

        elif workflow_status == "COMPLETED":
            result = await safe_result(handle, timeout=5.0)
            if result is not None:
                response.result = _convert_result(result)
            response.progress = 100
            response.currentStep = "COMPLETED"

        elif workflow_status == "FAILED":
            response.error = {"code": "WORKFLOW_FAILED", "message": "Workflow execution failed"}
            response.progress = 0
            response.currentStep = "FAILED"

        elif workflow_status == "CANCELLED":
            response.error = {"code": "WORKFLOW_CANCELLED", "message": "Workflow was cancelled"}
            response.progress = 0
            response.currentStep = "CANCELLED"

        return response

    except RPCError as e:
        if e.status == RPCStatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")
        logger.error(f"✗ RPC error for {workflow_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workflow/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")

    try:
        handle = temporal_client.get_workflow_handle(workflow_id)
        # Only JewelryGenerationWorkflow defines the cancel signal in your code;
        # keep as-is (or branch by prefix if you add cancel signals to others).
        await handle.signal(JewelryGenerationWorkflow.cancel, "User cancelled")
        await handle.cancel()

        logger.info(f"⚠ Cancelled: {workflow_id}")
        return {"workflowId": workflow_id, "status": "CANCELLING"}

    except RPCError as e:
        if e.status == RPCStatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Cancel failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------
# Overlay endpoint (FIXED - creates overlay locally)
# -------------------------
@app.post("/overlay", response_model=OverlayResponse)
async def get_overlay(request: OverlayRequest):
    """Fetch image and mask from Azure, create green overlay locally."""
    try:
        # Fetch image and mask from Azure
        image_base64 = await fetch_blob_as_base64(request.imageUri)
        mask_base64 = await fetch_blob_as_base64(request.maskUri)
        
        # Decode images
        image_data = base64.b64decode(image_base64)
        mask_data = base64.b64decode(mask_base64)
        
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        mask = Image.open(io.BytesIO(mask_data)).convert("L")
        
        # Resize mask to match image if needed
        if mask.size != image.size:
            mask = mask.resize(image.size, Image.LANCZOS)
        
        # Fast overlay creation using numpy
        # White pixels in mask (value=255) → green translucent overlay
        # Black pixels in mask (value=0) → original image unchanged
        img_arr = np.array(image, dtype=np.float32)
        mask_arr = np.array(mask, dtype=np.float32) / 255.0  # Normalize to 0-1
        
        overlay_arr = img_arr.copy()
        mask_3d = np.stack([mask_arr] * 3, axis=-1)
        
        # Green tint for detected jewelry regions (where mask is white)
        green_tint = np.array([50, 255, 100], dtype=np.float32)
        
        # Blend: show green where mask is white, original where mask is black
        blend_factor = 0.5  # 50% green overlay on detected regions
        overlay_arr = overlay_arr * (1 - mask_3d * blend_factor) + green_tint * mask_3d * blend_factor
        overlay_arr = np.clip(overlay_arr, 0, 255).astype(np.uint8)
        
        overlay_img = Image.fromarray(overlay_arr)
        
        # Convert overlay to base64
        overlay_buffer = io.BytesIO()
        overlay_img.save(overlay_buffer, format="JPEG", quality=90)
        overlay_base64 = base64.b64encode(overlay_buffer.getvalue()).decode('utf-8')
        
        logger.info(f"✓ Overlay created: {image.size}")
        
        return OverlayResponse(
            imageBase64=image_base64,
            maskBase64=mask_base64,
            overlayBase64=overlay_base64
        )
            
    except Exception as e:
        logger.error(f"✗ Overlay failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    logger.info(f"Starting API on port {config.api_port}")
    uvicorn.run(
        "src.api_gateway:app",
        host="0.0.0.0",
        port=config.api_port,
        reload=False,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
