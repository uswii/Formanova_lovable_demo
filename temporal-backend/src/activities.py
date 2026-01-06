"""Temporal activity implementations that call external microservices."""
import asyncio
import base64
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Optional

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


def get_sas_url_from_uri(azure_uri: str) -> str:
    """Convert azure:// URI to SAS URL."""
    if not azure_uri.startswith("azure://"):
        return azure_uri
    
    blob_name = azure_uri.replace(f"azure://{config.azure_container_name}/", "")
    return generate_sas_url(blob_name)


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
        
        if status in ("completed", "succeeded"):
            return data
        elif status == "failed":
            raise Exception(f"Job failed: {data.get('error', 'Unknown error')}")
        
        await asyncio.sleep(poll_interval)


@activity.defn
async def upload_to_azure(input: UploadInput) -> UploadOutput:
    """Upload an image to Azure Blob Storage with category-based folder structure."""
    try:
        image_data = base64.b64decode(input.base64_data)
        ext = "jpg" if input.content_type == "image/jpeg" else "png"
        
        # Category-based folder structure: {jewelry_type}/uploads/{prefix}-{uuid}.{ext}
        jewelry_type = getattr(input, 'jewelry_type', 'necklace') or 'necklace'
        blob_name = f"{jewelry_type}/uploads/{input.filename_prefix}-{uuid.uuid4()}.{ext}"
        
        blob_service_client = get_blob_service_client()
        container_client = blob_service_client.get_container_client(config.azure_container_name)
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(image_data, content_type=input.content_type, overwrite=True)
        
        azure_uri = f"azure://{config.azure_container_name}/{blob_name}"
        https_url = f"https://{config.azure_account_name}.blob.core.windows.net/{config.azure_container_name}/{blob_name}"
        sas_url = generate_sas_url(blob_name)
        
        activity.logger.info(f"✓ Upload: {jewelry_type}/{input.filename_prefix}")
        
        return UploadOutput(azure_uri=azure_uri, https_url=https_url, sas_url=sas_url)
    except Exception as e:
        activity.logger.error(f"✗ Upload failed: {e}")
        raise


@activity.defn
async def resize_image(input: ResizeInput) -> ResizeOutput:
    """Resize image to fixed dimensions using Image Manipulator service."""
    try:
        image_base64 = await fetch_blob_as_base64(input.image_uri)
        
        response = await http_client.post(
            f"{config.image_manipulator_url}/resize",
            json={
                "image": {"base64": image_base64},
                "target_width": input.target_width,
                "target_height": input.target_height,
                "flag": "fixed_dimensions"
            }
        )
        response.raise_for_status()
        data = response.json()
        
        resized_base64 = data.get("image_base64", "")
        if resized_base64.startswith("data:"):
            resized_base64 = resized_base64.split(",", 1)[1]
        
        jewelry_type = getattr(input, 'jewelry_type', 'necklace') or 'necklace'
        upload_result = await upload_to_azure(UploadInput(
            base64_data=resized_base64,
            content_type="image/png",
            filename_prefix="processed/resized",
            jewelry_type=jewelry_type
        ))
        
        activity.logger.info(f"✓ Resize: {input.target_width}x{input.target_height}")
        
        return ResizeOutput(
            resized_uri=upload_result.azure_uri,
            padding=data.get("padding", [0, 0, 0, 0])
        )
    except Exception as e:
        activity.logger.error(f"✗ Resize failed: {e}")
        raise


@activity.defn
async def check_zoom(input: ZoomCheckInput) -> ZoomCheckOutput:
    """Check if background removal is recommended."""
    try:
        image_base64 = await fetch_blob_as_base64(input.image_uri)
        
        response = await http_client.post(
            f"{config.image_manipulator_url}/zoom_check",
            json={"image": {"base64": image_base64}}
        )
        response.raise_for_status()
        data = response.json()
        recommend = data.get("should_remove_background", False)
        
        activity.logger.info(f"✓ Zoom check: bg_removal={'yes' if recommend else 'no'}")
        
        return ZoomCheckOutput(recommend_bg_removal=recommend)
    except Exception as e:
        activity.logger.error(f"✗ Zoom check failed: {e}")
        raise


@activity.defn
async def remove_background(input: BackgroundRemoveInput) -> BackgroundRemoveOutput:
    """Remove background using BiRefNet service (async job)."""
    try:
        response = await http_client.post(
            f"{config.birefnet_url}/jobs",
            json={"data": {"image": {"uri": input.image_uri}}}
        )
        response.raise_for_status()
        job_id = response.json().get("job_id")
        
        result = await poll_job(config.birefnet_url, job_id)
        
        result_uri = ""
        if result.get("result") and result["result"].get("image"):
            result_uri = result["result"]["image"].get("uri", "")
        if not result_uri and result.get("result") and result["result"].get("output"):
            result_uri = result["result"]["output"].get("uri", "")
        if not result_uri:
            result_uri = result.get("result_uri", "")
        
        activity.logger.info("✓ Background removed")
        
        return BackgroundRemoveOutput(result_uri=result_uri)
    except Exception as e:
        activity.logger.error(f"✗ Background removal failed: {e}")
        raise


@activity.defn
async def generate_mask(input: GenerateMaskInput) -> GenerateMaskOutput:
    """Generate segmentation mask using SAM3 service (async job)."""
    try:
        # SAM3 expects pixel coordinates in resized image space (2000x2667)
        # Points are passed as normalized 0-1 values from frontend, need to scale them
        TARGET_WIDTH = 2000
        TARGET_HEIGHT = 2667
        
        # Scale normalized points (0-1) to pixel coordinates
        points = [[p.x * TARGET_WIDTH, p.y * TARGET_HEIGHT] for p in input.points]
        point_labels = [p.label if hasattr(p, 'label') else 1 for p in input.points]
        
        activity.logger.info(f"▶ SAM3 points (scaled): {points}")
        
        response = await http_client.post(
            f"{config.sam3_url}/jobs",
            json={
                "data": {
                    "image": {"uri": input.image_uri},
                    "points": points,
                    "point_labels": point_labels,
                    "invert_mask": input.invert_mask
                }
            }
        )
        response.raise_for_status()
        job_id = response.json().get("job_id")
        
        result = await poll_job(config.sam3_url, job_id)
        
        mask_uri = ""
        if result.get("result") and result["result"].get("mask"):
            mask_uri = result["result"]["mask"].get("uri", "")
        if not mask_uri:
            mask_uri = result.get("mask_uri", "")
        
        activity.logger.info(f"✓ Mask generated ({len(points)} points)")
        
        return GenerateMaskOutput(mask_uri=mask_uri)
    except Exception as e:
        activity.logger.error(f"✗ Mask generation failed: {e}")
        raise


@activity.defn
async def refine_mask(input: RefineMaskInput) -> RefineMaskOutput:
    """Refine mask using A100 server."""
    try:
        image_base64 = await fetch_blob_as_base64(input.image_uri)
        mask_base64 = await fetch_blob_as_base64(input.mask_uri)
        
        brush_strokes = []
        for stroke in input.strokes:
            brush_strokes.append({
                "type": stroke.mode,
                "points": [[p.x, p.y] for p in stroke.points],
                "radius": stroke.size
            })
        
        response = await http_client.post(
            f"{config.a100_server_url}/refine-mask",
            json={
                "original_image_base64": image_base64,
                "current_mask_base64": mask_base64,
                "brush_strokes": brush_strokes
            }
        )
        response.raise_for_status()
        data = response.json()
        
        refined_mask_base64 = data.get("mask_base64", "")
        
        if refined_mask_base64:
            jewelry_type = getattr(input, 'jewelry_type', 'necklace') or 'necklace'
            upload_result = await upload_to_azure(UploadInput(
                base64_data=refined_mask_base64,
                content_type="image/png",
                filename_prefix="processed/refined-mask",
                jewelry_type=jewelry_type
            ))
            refined_uri = upload_result.azure_uri
        else:
            refined_uri = input.mask_uri
        
        activity.logger.info(f"✓ Mask refined ({len(input.strokes)} strokes)")
        
        return RefineMaskOutput(refined_mask_uri=refined_uri)
    except Exception as e:
        activity.logger.error(f"✗ Mask refinement failed: {e}")
        raise


@activity.defn
async def generate_images(input: GenerateImagesInput) -> GenerateImagesOutput:
    """Generate final images using A100 server (Flux + Gemini)."""
    try:
        image_base64 = await fetch_blob_as_base64(input.image_uri)
        mask_base64 = await fetch_blob_as_base64(input.mask_uri)
        
        payload = {
            "image_base64": image_base64,
            "mask_base64": mask_base64,
            "gender": input.gender,
            "use_gemini": True
        }
        
        if input.scaled_points:
            payload["scaled_points"] = input.scaled_points
        
        response = await http_client.post(
            f"{config.a100_server_url}/generate",
            json=payload,
            timeout=httpx.Timeout(300.0, connect=10.0)
        )
        response.raise_for_status()
        data = response.json()
        
        # Upload results to Azure to avoid Temporal payload size limits
        jewelry_type = getattr(input, 'jewelry_type', 'necklace') or 'necklace'
        
        flux_result_uri = None
        if data.get("result_base64"):
            upload_result = await upload_to_azure(UploadInput(
                base64_data=data["result_base64"],
                content_type="image/png",
                filename_prefix="generated/flux-result",
                jewelry_type=jewelry_type
            ))
            flux_result_uri = upload_result.azure_uri
        
        gemini_result_uri = None
        if data.get("result_gemini_base64"):
            upload_result = await upload_to_azure(UploadInput(
                base64_data=data["result_gemini_base64"],
                content_type="image/png",
                filename_prefix="generated/gemini-result",
                jewelry_type=jewelry_type
            ))
            gemini_result_uri = upload_result.azure_uri
        
        flux_viz_uri = None
        if data.get("fidelity_viz_base64"):
            upload_result = await upload_to_azure(UploadInput(
                base64_data=data["fidelity_viz_base64"],
                content_type="image/png",
                filename_prefix="generated/flux-fidelity",
                jewelry_type=jewelry_type
            ))
            flux_viz_uri = upload_result.azure_uri
        
        gemini_viz_uri = None
        if data.get("fidelity_viz_gemini_base64"):
            upload_result = await upload_to_azure(UploadInput(
                base64_data=data["fidelity_viz_gemini_base64"],
                content_type="image/png",
                filename_prefix="generated/gemini-fidelity",
                jewelry_type=jewelry_type
            ))
            gemini_viz_uri = upload_result.azure_uri
        
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
        
        activity.logger.info("✓ Images generated and uploaded to Azure")
        
        return GenerateImagesOutput(
            flux_result_uri=flux_result_uri,
            gemini_result_uri=gemini_result_uri,
            flux_fidelity_viz_uri=flux_viz_uri,
            gemini_fidelity_viz_uri=gemini_viz_uri,
            flux_metrics=flux_metrics,
            gemini_metrics=gemini_metrics
        )
    except Exception as e:
        activity.logger.error(f"✗ Image generation failed: {e}")
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
