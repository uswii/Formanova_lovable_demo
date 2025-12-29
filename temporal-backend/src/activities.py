"""Temporal activity implementations that call external microservices."""
import asyncio
import base64
import uuid
import logging
from datetime import datetime, timedelta
from typing import List

import httpx
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from temporalio import activity

from .config import config
from .models import (
    UploadInput, UploadOutput,
    ResizeInput, ResizeOutput,
    ZoomCheckInput, ZoomCheckOutput,
    BackgroundRemoveInput, BackgroundRemoveOutput,
    GenerateMaskInput, GenerateMaskOutput, MaskPoint,
    RefineMaskInput, RefineMaskOutput, BrushStroke,
    GenerateImagesInput, GenerateImagesOutput, FidelityMetrics,
)

logger = logging.getLogger(__name__)

# HTTP client with reasonable timeouts
http_client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))


def get_blob_service_client() -> BlobServiceClient:
    """Create Azure Blob Service client."""
    connection_string = (
        f"DefaultEndpointsProtocol=https;"
        f"AccountName={config.azure_account_name};"
        f"AccountKey={config.azure_account_key};"
        f"EndpointSuffix=core.windows.net"
    )
    return BlobServiceClient.from_connection_string(connection_string)


def generate_sas_url(blob_name: str) -> str:
    """Generate a SAS URL for a blob."""
    sas_token = generate_blob_sas(
        account_name=config.azure_account_name,
        container_name=config.azure_container_name,
        blob_name=blob_name,
        account_key=config.azure_account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(hours=24)
    )
    return f"https://{config.azure_account_name}.blob.core.windows.net/{config.azure_container_name}/{blob_name}?{sas_token}"


@activity.defn
async def upload_to_azure(input: UploadInput) -> UploadOutput:
    """Upload an image to Azure Blob Storage."""
    activity.logger.info(f"Uploading image to Azure (prefix: {input.filename_prefix})")
    
    try:
        # Decode base64 data
        image_data = base64.b64decode(input.base64_data)
        
        # Generate unique blob name
        ext = "jpg" if input.content_type == "image/jpeg" else "png"
        blob_name = f"{input.filename_prefix}-{uuid.uuid4()}.{ext}"
        
        # Upload to Azure
        blob_service_client = get_blob_service_client()
        container_client = blob_service_client.get_container_client(config.azure_container_name)
        blob_client = container_client.get_blob_client(blob_name)
        
        blob_client.upload_blob(image_data, content_type=input.content_type, overwrite=True)
        
        # Generate URLs
        azure_uri = f"azure://{config.azure_container_name}/{blob_name}"
        https_url = f"https://{config.azure_account_name}.blob.core.windows.net/{config.azure_container_name}/{blob_name}"
        sas_url = generate_sas_url(blob_name)
        
        activity.logger.info(f"Uploaded to Azure: {azure_uri}")
        
        return UploadOutput(
            azure_uri=azure_uri,
            https_url=https_url,
            sas_url=sas_url
        )
    except Exception as e:
        activity.logger.error(f"Failed to upload to Azure: {e}")
        raise


@activity.defn
async def resize_image(input: ResizeInput) -> ResizeOutput:
    """Resize image to fixed dimensions using Image Manipulator service."""
    activity.logger.info(f"Resizing image: {input.image_uri} to {input.target_width}x{input.target_height}")
    
    try:
        response = await http_client.post(
            f"{config.image_manipulator_url}/resize",
            json={
                "image": {"uri": input.image_uri},
                "target_width": input.target_width,
                "target_height": input.target_height,
                "flag": "fixed_dimensions"
            }
        )
        response.raise_for_status()
        data = response.json()
        
        # Upload resized image to Azure
        resized_base64 = data.get("image_base64", "")
        if resized_base64:
            upload_result = await upload_to_azure(UploadInput(
                base64_data=resized_base64,
                content_type="image/jpeg",
                filename_prefix="resized"
            ))
            resized_uri = upload_result.azure_uri
        else:
            resized_uri = input.image_uri
        
        activity.logger.info(f"Resized image uploaded: {resized_uri}")
        
        return ResizeOutput(
            image_base64=resized_base64,
            resized_uri=resized_uri,
            padding=data.get("padding", {"top": 0, "bottom": 0, "left": 0, "right": 0})
        )
    except Exception as e:
        activity.logger.error(f"Failed to resize image: {e}")
        raise


@activity.defn
async def check_zoom(input: ZoomCheckInput) -> ZoomCheckOutput:
    """Check if background removal is recommended."""
    activity.logger.info(f"Checking zoom for: {input.image_uri}")
    
    try:
        # Convert azure:// URI to accessible SAS URL for the IMAGE_MANIPULATOR service
        image_url = input.image_uri
        if image_url.startswith("azure://"):
            # Extract blob name from azure://container/blobname
            blob_name = image_url.replace(f"azure://{config.azure_container_name}/", "")
            image_url = generate_sas_url(blob_name)
            activity.logger.info(f"Converted to SAS URL for zoom check")
        
        response = await http_client.post(
            f"{config.image_manipulator_url}/zoom_check",
            json={"image": {"uri": image_url}}
        )
        response.raise_for_status()
        data = response.json()
        
        recommend = data.get("should_remove_background", False)
        activity.logger.info(f"Zoom check result: recommend_bg_removal={recommend}")
        
        return ZoomCheckOutput(recommend_bg_removal=recommend)
    except Exception as e:
        activity.logger.error(f"Failed to check zoom: {e}")
        raise


async def poll_job(base_url: str, job_id: str, poll_interval: float = 2.0, timeout: float = 120.0) -> dict:
    """Poll a job until completion."""
    start_time = asyncio.get_event_loop().time()
    
    while True:
        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed > timeout:
            raise TimeoutError(f"Job {job_id} timed out after {timeout}s")
        
        response = await http_client.get(f"{base_url}/jobs/{job_id}")
        response.raise_for_status()
        data = response.json()
        
        status = data.get("status", "unknown")
        activity.logger.info(f"Job {job_id} status: {status}")
        
        if status == "completed":
            return data
        elif status == "failed":
            raise Exception(f"Job {job_id} failed: {data.get('error', 'Unknown error')}")
        
        await asyncio.sleep(poll_interval)


@activity.defn
async def remove_background(input: BackgroundRemoveInput) -> BackgroundRemoveOutput:
    """Remove background using BiRefNet service (async job)."""
    activity.logger.info(f"Removing background for: {input.image_uri}")
    
    try:
        # Submit job
        response = await http_client.post(
            f"{config.birefnet_url}/jobs",
            json={"image_uri": input.image_uri}
        )
        response.raise_for_status()
        job_data = response.json()
        job_id = job_data.get("job_id")
        
        activity.logger.info(f"BiRefNet job started: {job_id}")
        
        # Poll until complete
        result = await poll_job(config.birefnet_url, job_id)
        result_uri = result.get("result_uri", "")
        
        activity.logger.info(f"Background removed: {result_uri}")
        
        return BackgroundRemoveOutput(result_uri=result_uri)
    except Exception as e:
        activity.logger.error(f"Failed to remove background: {e}")
        raise


@activity.defn
async def generate_mask(input: GenerateMaskInput) -> GenerateMaskOutput:
    """Generate segmentation mask using SAM3 service (async job)."""
    activity.logger.info(f"Generating mask for: {input.image_uri} with {len(input.points)} points")
    
    try:
        # Convert points to SAM3 format
        points = [[p.x, p.y] for p in input.points]
        labels = [p.label for p in input.points]
        
        # Submit job
        response = await http_client.post(
            f"{config.sam3_url}/jobs",
            json={
                "image_uri": input.image_uri,
                "points": points,
                "labels": labels
            }
        )
        response.raise_for_status()
        job_data = response.json()
        job_id = job_data.get("job_id")
        
        activity.logger.info(f"SAM3 job started: {job_id}")
        
        # Poll until complete
        result = await poll_job(config.sam3_url, job_id)
        mask_uri = result.get("mask_uri", "")
        
        activity.logger.info(f"Mask generated: {mask_uri}")
        
        return GenerateMaskOutput(mask_uri=mask_uri)
    except Exception as e:
        activity.logger.error(f"Failed to generate mask: {e}")
        raise


@activity.defn
async def refine_mask(input: RefineMaskInput) -> RefineMaskOutput:
    """Refine mask using A100 server."""
    activity.logger.info(f"Refining mask with {len(input.strokes)} strokes")
    
    try:
        # Convert strokes to A100 format
        strokes_data = []
        for stroke in input.strokes:
            strokes_data.append({
                "points": [[p.x, p.y] for p in stroke.points],
                "mode": stroke.mode,
                "size": stroke.size
            })
        
        response = await http_client.post(
            f"{config.a100_server_url}/refine_mask",
            json={
                "image_uri": input.image_uri,
                "mask_uri": input.mask_uri,
                "strokes": strokes_data
            }
        )
        response.raise_for_status()
        data = response.json()
        
        refined_uri = data.get("refined_mask_uri", input.mask_uri)
        activity.logger.info(f"Mask refined: {refined_uri}")
        
        return RefineMaskOutput(refined_mask_uri=refined_uri)
    except Exception as e:
        activity.logger.error(f"Failed to refine mask: {e}")
        raise


@activity.defn
async def generate_images(input: GenerateImagesInput) -> GenerateImagesOutput:
    """Generate final images using A100 server (Flux + Gemini)."""
    activity.logger.info(f"Generating images for: {input.image_uri}")
    
    try:
        response = await http_client.post(
            f"{config.a100_server_url}/generate",
            json={
                "image_uri": input.image_uri,
                "mask_uri": input.mask_uri
            },
            timeout=httpx.Timeout(300.0, connect=10.0)  # 5 minute timeout for generation
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse metrics
        flux_metrics = None
        if data.get("metrics"):
            m = data["metrics"]
            flux_metrics = FidelityMetrics(
                precision=m.get("precision", 0),
                recall=m.get("recall", 0),
                iou=m.get("iou", 0),
                growth_ratio=m.get("growth_ratio", 1)
            )
        
        gemini_metrics = None
        if data.get("metrics_gemini"):
            m = data["metrics_gemini"]
            gemini_metrics = FidelityMetrics(
                precision=m.get("precision", 0),
                recall=m.get("recall", 0),
                iou=m.get("iou", 0),
                growth_ratio=m.get("growth_ratio", 1)
            )
        
        activity.logger.info("Images generated successfully")
        
        return GenerateImagesOutput(
            flux_result_base64=data.get("result_base64", ""),
            gemini_result_base64=data.get("result_gemini_base64"),
            flux_fidelity_viz_base64=data.get("fidelity_viz_base64"),
            gemini_fidelity_viz_base64=data.get("fidelity_viz_gemini_base64"),
            flux_metrics=flux_metrics,
            gemini_metrics=gemini_metrics
        )
    except Exception as e:
        activity.logger.error(f"Failed to generate images: {e}")
        raise


@activity.defn
async def check_a100_health() -> bool:
    """Check if A100 server is healthy."""
    try:
        response = await http_client.get(
            f"{config.a100_server_url}/health",
            timeout=httpx.Timeout(5.0)
        )
        return response.status_code == 200
    except Exception:
        return False


@activity.defn
async def check_service_health(service_url: str) -> bool:
    """Check if a service is healthy."""
    try:
        response = await http_client.get(
            f"{service_url}/health",
            timeout=httpx.Timeout(5.0)
        )
        return response.status_code == 200
    except Exception:
        return False
