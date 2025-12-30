"""FastAPI REST API Gateway for Temporal workflows."""
import asyncio
import logging
import uuid
from typing import List, Optional
from dataclasses import asdict

import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from temporalio.client import Client, WorkflowExecutionStatus
from temporalio.service import RPCError

from .config import config
from .models import WorkflowInput, MaskPoint, BrushStroke, StrokePoint, WorkflowProgress
from .workflows import JewelryGenerationWorkflow, PreprocessingWorkflow, GenerationWorkflow

# Simple logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Jewelry Generation Temporal API",
    description="REST API for orchestrating jewelry virtual try-on workflows",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Temporal client
temporal_client: Optional[Client] = None


# Request/Response models
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
    """Connect to Temporal on startup."""
    global temporal_client
    
    try:
        temporal_client = await Client.connect(config.temporal_address, namespace=config.temporal_namespace)
        logger.info("✓ Connected to Temporal")
    except Exception as e:
        logger.error(f"✗ Temporal connection failed: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check health of API and connected services."""
    import httpx
    
    temporal_status = "connected" if temporal_client else "disconnected"
    
    a100_status = "offline"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{config.a100_server_url}/health")
            if response.status_code == 200:
                a100_status = "online"
    except Exception:
        pass
    
    image_manipulator_status = "offline"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{config.image_manipulator_url}/health")
            if response.status_code == 200:
                image_manipulator_status = "online"
    except Exception:
        pass
    
    return HealthResponse(
        status="healthy" if temporal_status == "connected" else "degraded",
        temporal=temporal_status,
        services={"a100": a100_status, "imageManipulator": image_manipulator_status, "birefnet": "unknown", "sam3": "unknown"}
    )


@app.post("/workflow/start", response_model=WorkflowStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_workflow(request: StartWorkflowRequest):
    """Start a new jewelry generation workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")
    
    workflow_id = f"jewelry-gen-{uuid.uuid4()}"
    
    try:
        mask_points = [MaskPoint(x=p.x, y=p.y, label=p.label) for p in request.maskPoints]
        
        brush_strokes = None
        if request.brushStrokes:
            brush_strokes = [
                BrushStroke(points=[StrokePoint(x=p.x, y=p.y) for p in s.points], mode=s.mode, size=s.size)
                for s in request.brushStrokes
            ]
        
        workflow_input = WorkflowInput(
            original_image_base64=request.originalImageBase64,
            mask_points=mask_points,
            brush_strokes=brush_strokes,
            session_id=request.sessionId,
            user_id=request.userId
        )
        
        await temporal_client.start_workflow(
            JewelryGenerationWorkflow.run,
            workflow_input,
            id=workflow_id,
            task_queue=config.main_task_queue
        )
        
        logger.info(f"▶ Started: {workflow_id}")
        return WorkflowStartResponse(workflowId=workflow_id, status="RUNNING")
        
    except Exception as e:
        logger.error(f"✗ Start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workflow/preprocess", response_model=WorkflowStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_preprocessing(request: StartPreprocessingRequest):
    """Start a preprocessing workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")
    
    workflow_id = f"preprocess-{uuid.uuid4()}"
    
    try:
        mask_points = [MaskPoint(x=p.x, y=p.y, label=p.label) for p in request.maskPoints]
        workflow_input = WorkflowInput(original_image_base64=request.originalImageBase64, mask_points=mask_points)
        
        await temporal_client.start_workflow(
            PreprocessingWorkflow.run,
            workflow_input,
            id=workflow_id,
            task_queue=config.main_task_queue
        )
        
        logger.info(f"▶ Started preprocessing: {workflow_id}")
        return WorkflowStartResponse(workflowId=workflow_id, status="RUNNING")
        
    except Exception as e:
        logger.error(f"✗ Preprocessing start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workflow/generate", response_model=WorkflowStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_generation(request: StartGenerationRequest):
    """Start a generation workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")
    
    workflow_id = f"generate-{uuid.uuid4()}"
    
    try:
        brush_strokes_data = None
        if request.brushStrokes:
            brush_strokes_data = [
                {"points": [{"x": p.x, "y": p.y} for p in s.points], "mode": s.mode, "size": s.size}
                for s in request.brushStrokes
            ]
        
        await temporal_client.start_workflow(
            GenerationWorkflow.run,
            args=[request.imageUri, request.maskUri, brush_strokes_data, request.gender, request.scaledPoints],
            id=workflow_id,
            task_queue=config.main_task_queue
        )
        
        logger.info(f"▶ Started generation: {workflow_id}")
        return WorkflowStartResponse(workflowId=workflow_id, status="RUNNING")
        
    except Exception as e:
        logger.error(f"✗ Generation start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/workflow/{workflow_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(workflow_id: str):
    """Get workflow status."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")
    
    try:
        handle = temporal_client.get_workflow_handle(workflow_id)
        
        # Describe workflow with robust error handling
        try:
            desc = await handle.describe()
        except Exception as desc_error:
            # CANCELLED exceptions from describe() are often transient during activity transitions
            # The workflow is likely still running - return RUNNING as fallback
            logger.warning(f"Describe failed for {workflow_id}: {desc_error} (assuming RUNNING)")
            return WorkflowStatusResponse(
                workflowId=workflow_id,
                status="RUNNING",
                progress=0,
                currentStep="PROCESSING"
            )
        
        status_map = {
            WorkflowExecutionStatus.RUNNING: "RUNNING",
            WorkflowExecutionStatus.COMPLETED: "COMPLETED",
            WorkflowExecutionStatus.FAILED: "FAILED",
            WorkflowExecutionStatus.CANCELLED: "CANCELLED",
            WorkflowExecutionStatus.TERMINATED: "CANCELLED",
            WorkflowExecutionStatus.TIMED_OUT: "FAILED"
        }
        
        workflow_status = status_map.get(desc.status, "UNKNOWN")
        response = WorkflowStatusResponse(workflowId=workflow_id, status=workflow_status)
        
        if workflow_status == "RUNNING":
            try:
                # Determine which workflow type to query based on workflow ID prefix
                if workflow_id.startswith("preprocess-"):
                    progress = await handle.query(PreprocessingWorkflow.get_progress)
                elif workflow_id.startswith("generate-"):
                    progress = await handle.query(GenerationWorkflow.get_progress)
                else:
                    progress = await handle.query(JewelryGenerationWorkflow.get_progress)
                
                if isinstance(progress, WorkflowProgress):
                    response.progress = progress.progress
                    response.currentStep = progress.current_step
                elif isinstance(progress, dict):
                    response.progress = progress.get("progress", 0)
                    response.currentStep = progress.get("current_step", "UNKNOWN")
            except Exception as e:
                # Query can fail with "CANCELLED" even when workflow is still running
                # This is a transient Temporal SDK error during activity transitions
                # We already confirmed workflow is RUNNING from describe(), so keep that status
                logger.warning(f"Progress query failed for {workflow_id}: {e} (workflow still RUNNING per describe)")
                response.progress = 0
                response.currentStep = "PROCESSING"
        
        elif workflow_status == "COMPLETED":
            try:
                result = await handle.result()
                if hasattr(result, '__dict__'):
                    response.result = asdict(result) if hasattr(result, '__dataclass_fields__') else result.__dict__
                elif isinstance(result, dict):
                    response.result = result
                else:
                    response.result = {"data": str(result)}
                response.progress = 100
                response.currentStep = "COMPLETED"
            except Exception as e:
                logger.warning(f"Result fetch failed for {workflow_id}: {e}")
                response.result = {"error": str(e)}
                response.progress = 100
                response.currentStep = "COMPLETED"
        
        elif workflow_status == "FAILED":
            response.error = {"code": "WORKFLOW_FAILED", "message": "Workflow execution failed"}
            response.progress = 0
        
        return response
        
    except RPCError as e:
        error_str = str(e).lower()
        if "not found" in error_str:
            raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")
        logger.error(f"✗ RPC error for {workflow_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # CANCELLED exceptions from Temporal SDK are often transient during activity transitions
        # Don't assume the workflow is actually cancelled - return RUNNING as fallback
        logger.warning(f"Status check exception for {workflow_id}: {e}")
        
        return WorkflowStatusResponse(
            workflowId=workflow_id,
            status="RUNNING",
            progress=0,
            currentStep="PROCESSING"
        )


@app.post("/workflow/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    """Cancel a workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal not connected")
    
    try:
        handle = temporal_client.get_workflow_handle(workflow_id)
        await handle.signal(JewelryGenerationWorkflow.cancel, "User cancelled")
        await handle.cancel()
        
        logger.info(f"⚠ Cancelled: {workflow_id}")
        return {"workflowId": workflow_id, "status": "CANCELLING"}
        
    except RPCError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"✗ Cancel failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/overlay", response_model=OverlayResponse)
async def get_overlay(request: OverlayRequest):
    """Fetch image and mask, create overlay."""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{config.image_manipulator_url}/create-overlay",
                json={"image_uri": request.imageUri, "mask_uri": request.maskUri}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Overlay creation failed")
            
            data = response.json()
            return OverlayResponse(
                imageBase64=data.get("image_base64", ""),
                maskBase64=data.get("mask_base64", ""),
                overlayBase64=data.get("overlay_base64", "")
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Overlay creation timed out")
    except Exception as e:
        logger.error(f"✗ Overlay failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    """Run the API gateway."""
    logger.info(f"Starting API on port {config.api_port}")
    uvicorn.run("src.api_gateway:app", host="0.0.0.0", port=config.api_port, reload=False, log_level="warning")


if __name__ == "__main__":
    main()
