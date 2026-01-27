"""Temporal workflows for batch processing."""
import asyncio
from dataclasses import dataclass
from datetime import timedelta
from typing import List, Optional
from uuid import UUID

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .batch_activities import (
        SendBatchEmailInput,
        SendBatchEmailOutput,
        FetchUserInfoInput,
        FetchUserInfoOutput,
        send_batch_completion_email,
        send_batch_started_email,
        fetch_user_info,
    )
    from .activities import (
        UploadInput,
        upload_to_azure,
        generate_images,
        GenerateImagesInput,
    )
    from .models import GenerateImagesInput as GenInput, FidelityMetrics
    from .config import config


@dataclass
class BatchImageInput:
    """Input for a single image in the batch."""
    image_id: str  # UUID from database
    azure_uri: str  # Original image Azure URI
    sequence: int


@dataclass
class BatchImageResult:
    """Result for a single processed image."""
    image_id: str
    success: bool
    result_uri: Optional[str] = None
    mask_uri: Optional[str] = None
    fidelity_metrics: Optional[dict] = None
    processing_time_ms: Optional[int] = None
    error: Optional[str] = None


@dataclass
class BatchProcessingInput:
    """Input for the batch processing workflow."""
    batch_id: str
    user_id: str
    jewelry_category: str
    skin_tone: str
    gender: str
    images: List[BatchImageInput]


@dataclass
class BatchProcessingOutput:
    """Output from the batch processing workflow."""
    batch_id: str
    total_images: int
    completed_images: int
    failed_images: int
    results: List[BatchImageResult]
    email_sent: bool


@workflow.defn
class BatchProcessingWorkflow:
    """
    Workflow that processes a batch of jewelry images.
    
    1. Fetches user info for email notifications
    2. Sends "batch started" email
    3. Processes each image through the generation pipeline
    4. Updates progress after each image
    5. Sends "batch completed" email
    """
    
    @workflow.run
    async def run(self, input: BatchProcessingInput) -> BatchProcessingOutput:
        workflow.logger.info(f"▶ Starting batch {input.batch_id} with {len(input.images)} images")
        
        # Retry policy for activities
        retry_policy = RetryPolicy(
            initial_interval=timedelta(seconds=1),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(minutes=5),
            maximum_attempts=3,
        )
        
        # 1. Fetch user info for email
        user_info = await workflow.execute_activity(
            fetch_user_info,
            FetchUserInfoInput(user_id=input.user_id),
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry_policy,
        )
        
        # 2. Send batch started email
        download_url = f"{config.frontend_url}/batches/{input.batch_id}"
        
        await workflow.execute_activity(
            send_batch_started_email,
            SendBatchEmailInput(
                user_email=user_info.email,
                user_name=user_info.name,
                batch_id=input.batch_id,
                total_images=len(input.images),
                completed_images=0,
                failed_images=0,
                jewelry_category=input.jewelry_category,
                download_url=download_url,
            ),
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry_policy,
        )
        
        # 3. Process each image
        results: List[BatchImageResult] = []
        completed = 0
        failed = 0
        
        for img in input.images:
            workflow.logger.info(f"  Processing image {img.sequence}/{len(input.images)}")
            
            try:
                import time
                start_time = time.time()
                
                # Call the generation activity
                gen_result = await workflow.execute_activity(
                    generate_images,
                    GenInput(
                        image_uri=img.azure_uri,
                        mask_uri=img.azure_uri,  # For batch, mask is auto-generated
                        gender=input.gender,
                        jewelry_type=input.jewelry_category,
                    ),
                    start_to_close_timeout=timedelta(minutes=10),
                    retry_policy=retry_policy,
                )
                
                elapsed_ms = int((time.time() - start_time) * 1000)
                
                # Extract metrics if available
                metrics_dict = None
                if gen_result.flux_metrics:
                    metrics_dict = {
                        "precision": gen_result.flux_metrics.precision,
                        "recall": gen_result.flux_metrics.recall,
                        "iou": gen_result.flux_metrics.iou,
                        "growth_ratio": gen_result.flux_metrics.growth_ratio,
                    }
                
                results.append(BatchImageResult(
                    image_id=img.image_id,
                    success=True,
                    result_uri=gen_result.flux_result_uri or gen_result.gemini_result_uri,
                    mask_uri=None,  # Would need separate mask activity
                    fidelity_metrics=metrics_dict,
                    processing_time_ms=elapsed_ms,
                ))
                completed += 1
                
            except Exception as e:
                workflow.logger.error(f"  ✗ Image {img.sequence} failed: {e}")
                results.append(BatchImageResult(
                    image_id=img.image_id,
                    success=False,
                    error=str(e),
                ))
                failed += 1
        
        # 4. Send batch completion email
        email_result = await workflow.execute_activity(
            send_batch_completion_email,
            SendBatchEmailInput(
                user_email=user_info.email,
                user_name=user_info.name,
                batch_id=input.batch_id,
                total_images=len(input.images),
                completed_images=completed,
                failed_images=failed,
                jewelry_category=input.jewelry_category,
                download_url=download_url,
            ),
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry_policy,
        )
        
        workflow.logger.info(f"✓ Batch {input.batch_id} complete: {completed}/{len(input.images)} succeeded")
        
        return BatchProcessingOutput(
            batch_id=input.batch_id,
            total_images=len(input.images),
            completed_images=completed,
            failed_images=failed,
            results=results,
            email_sent=email_result.success,
        )
