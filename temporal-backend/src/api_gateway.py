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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
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
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Temporal client
temporal_client: Optional[Client] = None


# Request/Response models
class MaskPointRequest(BaseModel):
    x: float = Field(..., ge=0, le=1, description="X coordinate (0-1 normalized)")
    y: float = Field(..., ge=0, le=1, description="Y coordinate (0-1 normalized)")
    label: int = Field(..., ge=0, le=1, description="0 = background, 1 = foreground")


class StrokePointRequest(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)


class BrushStrokeRequest(BaseModel):
    points: List[StrokePointRequest]
    mode: str = Field(..., pattern="^(add|remove)$")
    size: int = Field(default=20, ge=1, le=100)


class StartWorkflowRequest(BaseModel):
    originalImageBase64: str = Field(..., description="Base64 encoded image")
    maskPoints: List[MaskPointRequest] = Field(..., min_length=1)
    brushStrokes: Optional[List[BrushStrokeRequest]] = None
    sessionId: Optional[str] = None
    userId: Optional[str] = None


class StartPreprocessingRequest(BaseModel):
    originalImageBase64: str = Field(..., description="Base64 encoded image")
    maskPoints: List[MaskPointRequest] = Field(..., min_length=1)


class StartGenerationRequest(BaseModel):
    imageUri: str = Field(..., description="Azure URI of processed image")
    maskUri: str = Field(..., description="Azure URI of mask")
    brushStrokes: Optional[List[BrushStrokeRequest]] = None
    gender: str = Field(default="female", description="Model gender for prompt")
    scaledPoints: Optional[List[List[float]]] = Field(default=None, description="SAM points for fidelity analysis")


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
    imageUri: str = Field(..., description="Azure URI of the image")
    maskUri: str = Field(..., description="Azure URI of the mask")


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
    logger.info(f"Connecting to Temporal at {config.temporal_address}")
    
    try:
        temporal_client = await Client.connect(
            config.temporal_address,
            namespace=config.temporal_namespace
        )
        logger.info("Connected to Temporal successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Temporal: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("Shutting down API gateway")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check health of API and connected services."""
    temporal_status = "disconnected"
    
    if temporal_client:
        try:
            # Simple check - list workflows (limited)
            temporal_status = "connected"
        except Exception:
            temporal_status = "error"
    
    # Check A100 server
    import httpx
    a100_status = "offline"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{config.a100_server_url}/health")
            if response.status_code == 200:
                a100_status = "online"
    except Exception:
        pass
    
    # Check Image Manipulator
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
        services={
            "a100": a100_status,
            "imageManipulator": image_manipulator_status,
            "birefnet": "unknown",  # Modal services don't have health endpoints
            "sam3": "unknown"
        }
    )


@app.post("/workflow/start", response_model=WorkflowStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_workflow(request: StartWorkflowRequest):
    """Start a new jewelry generation workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal client not connected")
    
    workflow_id = f"jewelry-gen-{uuid.uuid4()}"
    
    try:
        # Convert request to workflow input
        mask_points = [
            MaskPoint(x=p.x, y=p.y, label=p.label)
            for p in request.maskPoints
        ]
        
        brush_strokes = None
        if request.brushStrokes:
            brush_strokes = [
                BrushStroke(
                    points=[StrokePoint(x=p.x, y=p.y) for p in s.points],
                    mode=s.mode,
                    size=s.size
                )
                for s in request.brushStrokes
            ]
        
        workflow_input = WorkflowInput(
            original_image_base64=request.originalImageBase64,
            mask_points=mask_points,
            brush_strokes=brush_strokes,
            session_id=request.sessionId,
            user_id=request.userId
        )
        
        # Start workflow
        handle = await temporal_client.start_workflow(
            JewelryGenerationWorkflow.run,
            workflow_input,
            id=workflow_id,
            task_queue=config.main_task_queue
        )
        
        logger.info(f"Started workflow: {workflow_id}")
        
        return WorkflowStartResponse(
            workflowId=workflow_id,
            status="RUNNING"
        )
        
    except Exception as e:
        logger.error(f"Failed to start workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workflow/preprocess", response_model=WorkflowStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_preprocessing(request: StartPreprocessingRequest):
    """Start a preprocessing workflow (upload, resize, mask generation)."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal client not connected")
    
    workflow_id = f"preprocess-{uuid.uuid4()}"
    
    try:
        mask_points = [
            MaskPoint(x=p.x, y=p.y, label=p.label)
            for p in request.maskPoints
        ]
        
        workflow_input = WorkflowInput(
            original_image_base64=request.originalImageBase64,
            mask_points=mask_points
        )
        
        handle = await temporal_client.start_workflow(
            PreprocessingWorkflow.run,
            workflow_input,
            id=workflow_id,
            task_queue=config.main_task_queue
        )
        
        logger.info(f"Started preprocessing workflow: {workflow_id}")
        
        return WorkflowStartResponse(
            workflowId=workflow_id,
            status="RUNNING"
        )
        
    except Exception as e:
        logger.error(f"Failed to start preprocessing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workflow/generate", response_model=WorkflowStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_generation(request: StartGenerationRequest):
    """Start a generation workflow (refinement + Flux/Gemini)."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal client not connected")
    
    workflow_id = f"generate-{uuid.uuid4()}"
    
    try:
        brush_strokes_data = None
        if request.brushStrokes:
            brush_strokes_data = [
                {
                    "points": [{"x": p.x, "y": p.y} for p in s.points],
                    "mode": s.mode,
                    "size": s.size
                }
                for s in request.brushStrokes
            ]
        
        handle = await temporal_client.start_workflow(
            GenerationWorkflow.run,
            args=[
                request.imageUri, 
                request.maskUri, 
                brush_strokes_data,
                request.gender,
                request.scaledPoints
            ],
            id=workflow_id,
            task_queue=config.main_task_queue
        )
        
        logger.info(f"Started generation workflow: {workflow_id}")
        
        return WorkflowStartResponse(
            workflowId=workflow_id,
            status="RUNNING"
        )
        
    except Exception as e:
        logger.error(f"Failed to start generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/workflow/{workflow_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(workflow_id: str):
    """Get the status of a workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal client not connected")
    
    try:
        # Get workflow handle
        handle = temporal_client.get_workflow_handle(workflow_id)
        
        # Get workflow description
        desc = await handle.describe()
        
        status_map = {
            WorkflowExecutionStatus.RUNNING: "RUNNING",
            WorkflowExecutionStatus.COMPLETED: "COMPLETED",
            WorkflowExecutionStatus.FAILED: "FAILED",
            WorkflowExecutionStatus.CANCELLED: "CANCELLED",
            WorkflowExecutionStatus.TERMINATED: "CANCELLED",
            WorkflowExecutionStatus.TIMED_OUT: "FAILED"
        }
        
        workflow_status = status_map.get(desc.status, "UNKNOWN")
        
        response = WorkflowStatusResponse(
            workflowId=workflow_id,
            status=workflow_status
        )
        
        if workflow_status == "RUNNING":
            # Query progress
            try:
                progress = await handle.query(JewelryGenerationWorkflow.get_progress)
                if isinstance(progress, WorkflowProgress):
                    response.progress = progress.progress
                    response.currentStep = progress.current_step
                elif isinstance(progress, dict):
                    response.progress = progress.get("progress", 0)
                    response.currentStep = progress.get("current_step", "UNKNOWN")
            except Exception as e:
                logger.warning(f"Failed to query progress: {e}")
                response.progress = 0
                response.currentStep = "UNKNOWN"
        
        elif workflow_status == "COMPLETED":
            # Get result
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
                logger.error(f"Failed to get result: {e}")
                response.result = {"error": str(e)}
        
        elif workflow_status == "FAILED":
            response.error = {
                "code": "WORKFLOW_FAILED",
                "message": "Workflow execution failed",
                "failedStep": "UNKNOWN"
            }
            response.progress = 0
        
        return response
        
    except RPCError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get workflow status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/workflow/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    """Cancel a running workflow."""
    if not temporal_client:
        raise HTTPException(status_code=503, detail="Temporal client not connected")
    
    try:
        handle = temporal_client.get_workflow_handle(workflow_id)
        
        # Send cancel signal
        await handle.signal(JewelryGenerationWorkflow.cancel, "User cancelled")
        
        # Also request cancellation through Temporal
        await handle.cancel()
        
        logger.info(f"Cancelled workflow: {workflow_id}")
        
        return {"workflowId": workflow_id, "status": "CANCELLING"}
        
    except RPCError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to cancel workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/overlay", response_model=OverlayResponse)
async def get_overlay(request: OverlayRequest):
    """Fetch image and mask as base64, create overlay. Called after preprocessing workflow completes."""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Call image manipulator to create overlay
            response = await client.post(
                f"{config.image_manipulator_url}/create-overlay",
                json={
                    "image_uri": request.imageUri,
                    "mask_uri": request.maskUri
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Overlay creation failed: {response.text}")
                raise HTTPException(status_code=500, detail="Failed to create overlay")
            
            data = response.json()
            
            return OverlayResponse(
                imageBase64=data.get("image_base64", ""),
                maskBase64=data.get("mask_base64", ""),
                overlayBase64=data.get("overlay_base64", "")
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Overlay creation timed out")
    except Exception as e:
        logger.error(f"Failed to create overlay: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    """Run the API gateway."""
    logger.info(f"Starting API gateway on port {config.api_port}")
    uvicorn.run(
        "src.api_gateway:app",
        host="0.0.0.0",
        port=config.api_port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
