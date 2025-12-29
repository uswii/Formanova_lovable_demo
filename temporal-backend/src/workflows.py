"""Temporal workflow definitions for jewelry generation."""
import logging
from datetime import timedelta
from typing import Optional

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .models import (
        WorkflowInput, WorkflowOutput, WorkflowProgress, WorkflowStep,
        UploadInput, ResizeInput, ZoomCheckInput, BackgroundRemoveInput,
        GenerateMaskInput, RefineMaskInput, GenerateImagesInput,
        FidelityMetrics, MaskPoint, BrushStroke, StrokePoint
    )

logger = logging.getLogger(__name__)


# Retry policies
IMAGE_PROCESSING_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=10),
    maximum_attempts=5
)

ML_SERVICE_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=2),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=30),
    maximum_attempts=3,
    non_retryable_error_types=["A100UnavailableError"]
)


@workflow.defn
class JewelryGenerationWorkflow:
    """Main workflow for jewelry virtual try-on generation."""
    
    def __init__(self):
        self._progress = 0
        self._current_step = WorkflowStep.UPLOADING_IMAGE.value
        self._steps_completed = 0
        self._total_steps = 8
        self._cancelled = False
        self._cancel_reason: Optional[str] = None
    
    @workflow.run
    async def run(self, input: WorkflowInput) -> WorkflowOutput:
        """Execute the jewelry generation workflow."""
        workflow.logger.info(f"Starting JewelryGenerationWorkflow with {len(input.mask_points)} points")
        
        try:
            # Step 1: Upload original image to Azure
            self._set_progress(5, WorkflowStep.UPLOADING_IMAGE)
            upload_result = await workflow.execute_activity(
                "upload_to_azure",
                UploadInput(
                    base64_data=input.original_image_base64,
                    content_type="image/jpeg",
                    filename_prefix="original"
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 2: Resize to 2000x2667
            self._set_progress(15, WorkflowStep.RESIZING_IMAGE)
            resize_result = await workflow.execute_activity(
                "resize_image",
                ResizeInput(
                    image_uri=upload_result.azure_uri,
                    target_width=2000,
                    target_height=2667
                ),
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 3: Check if background removal is needed
            self._set_progress(20, WorkflowStep.CHECKING_ZOOM)
            zoom_result = await workflow.execute_activity(
                "check_zoom",
                ZoomCheckInput(image_uri=resize_result.resized_uri),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            image_for_segmentation = resize_result.resized_uri
            background_removed = False
            
            # Step 4: Remove background if recommended
            if zoom_result.recommend_bg_removal:
                self._set_progress(30, WorkflowStep.REMOVING_BACKGROUND)
                bg_result = await workflow.execute_activity(
                    "remove_background",
                    BackgroundRemoveInput(image_uri=resize_result.resized_uri),
                    start_to_close_timeout=timedelta(seconds=120),
                    retry_policy=ML_SERVICE_RETRY
                )
                image_for_segmentation = bg_result.result_uri
                background_removed = True
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 5: Generate mask with SAM3
            self._set_progress(45, WorkflowStep.GENERATING_MASK)
            mask_result = await workflow.execute_activity(
                "generate_mask",
                GenerateMaskInput(
                    image_uri=image_for_segmentation,
                    points=input.mask_points
                ),
                start_to_close_timeout=timedelta(seconds=120),
                retry_policy=ML_SERVICE_RETRY
            )
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            final_mask_uri = mask_result.mask_uri
            
            # Step 6: Refine mask with brush strokes if provided
            if input.brush_strokes and len(input.brush_strokes) > 0:
                self._set_progress(55, WorkflowStep.REFINING_MASK)
                refine_result = await workflow.execute_activity(
                    "refine_mask",
                    RefineMaskInput(
                        image_uri=image_for_segmentation,
                        mask_uri=mask_result.mask_uri,
                        strokes=input.brush_strokes
                    ),
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=ML_SERVICE_RETRY
                )
                final_mask_uri = refine_result.refined_mask_uri
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 7: Upload final mask (if needed for A100)
            self._set_progress(60, WorkflowStep.UPLOADING_MASK)
            # Mask is already in Azure from SAM3/refine step
            
            # Step 8: Generate final images with Flux + Gemini
            self._set_progress(70, WorkflowStep.GENERATING_IMAGES)
            generate_result = await workflow.execute_activity(
                "generate_images",
                GenerateImagesInput(
                    image_uri=resize_result.resized_uri,
                    mask_uri=final_mask_uri
                ),
                start_to_close_timeout=timedelta(seconds=300),
                retry_policy=ML_SERVICE_RETRY
            )
            
            # Complete!
            self._set_progress(100, WorkflowStep.COMPLETED)
            
            workflow.logger.info("JewelryGenerationWorkflow completed successfully")
            
            return WorkflowOutput(
                flux_result_base64=generate_result.flux_result_base64,
                flux_fidelity_viz_base64=generate_result.flux_fidelity_viz_base64,
                flux_metrics=generate_result.flux_metrics,
                gemini_result_base64=generate_result.gemini_result_base64,
                gemini_fidelity_viz_base64=generate_result.gemini_fidelity_viz_base64,
                gemini_metrics=generate_result.gemini_metrics,
                processed_image_uri=resize_result.resized_uri,
                final_mask_uri=final_mask_uri,
                background_removed=background_removed
            )
            
        except workflow.CancelledError as e:
            workflow.logger.info(f"Workflow cancelled: {e}")
            raise
        except Exception as e:
            workflow.logger.error(f"Workflow failed: {e}")
            raise
    
    def _set_progress(self, progress: int, step: WorkflowStep):
        """Update workflow progress."""
        self._progress = progress
        self._current_step = step.value
        self._steps_completed = int((progress / 100) * self._total_steps)
        workflow.logger.info(f"Progress: {progress}% - Step: {step.value}")
    
    @workflow.query
    def get_progress(self) -> WorkflowProgress:
        """Query current workflow progress."""
        return WorkflowProgress(
            progress=self._progress,
            current_step=self._current_step,
            steps_completed=self._steps_completed,
            total_steps=self._total_steps
        )
    
    @workflow.query
    def get_current_step(self) -> str:
        """Query current workflow step."""
        return self._current_step
    
    @workflow.signal
    def cancel(self, reason: str = "User cancelled"):
        """Signal to cancel the workflow."""
        workflow.logger.info(f"Cancel signal received: {reason}")
        self._cancelled = True
        self._cancel_reason = reason


@workflow.defn
class PreprocessingWorkflow:
    """Workflow for preprocessing only (upload, resize, mask generation)."""
    
    def __init__(self):
        self._progress = 0
        self._current_step = WorkflowStep.UPLOADING_IMAGE.value
        self._cancelled = False
    
    @workflow.run
    async def run(self, input: WorkflowInput) -> dict:
        """Execute preprocessing workflow."""
        workflow.logger.info("Starting PreprocessingWorkflow")
        
        try:
            # Step 1: Upload original image
            self._set_progress(10, WorkflowStep.UPLOADING_IMAGE)
            upload_result = await workflow.execute_activity(
                "upload_to_azure",
                UploadInput(
                    base64_data=input.original_image_base64,
                    content_type="image/jpeg",
                    filename_prefix="original"
                ),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            
            # Step 2: Resize
            self._set_progress(30, WorkflowStep.RESIZING_IMAGE)
            resize_result = await workflow.execute_activity(
                "resize_image",
                ResizeInput(
                    image_uri=upload_result.azure_uri,
                    target_width=2000,
                    target_height=2667
                ),
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            
            # Step 3: Check zoom
            self._set_progress(40, WorkflowStep.CHECKING_ZOOM)
            zoom_result = await workflow.execute_activity(
                "check_zoom",
                ZoomCheckInput(image_uri=resize_result.resized_uri),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            
            image_for_segmentation = resize_result.resized_uri
            background_removed = False
            
            # Step 4: Remove background if needed
            if zoom_result.recommend_bg_removal:
                self._set_progress(60, WorkflowStep.REMOVING_BACKGROUND)
                bg_result = await workflow.execute_activity(
                    "remove_background",
                    BackgroundRemoveInput(image_uri=resize_result.resized_uri),
                    start_to_close_timeout=timedelta(seconds=120),
                    retry_policy=ML_SERVICE_RETRY
                )
                image_for_segmentation = bg_result.result_uri
                background_removed = True
            
            # Step 5: Generate mask with SAM3
            self._set_progress(80, WorkflowStep.GENERATING_MASK)
            mask_result = await workflow.execute_activity(
                "generate_mask",
                GenerateMaskInput(
                    image_uri=image_for_segmentation,
                    points=input.mask_points
                ),
                start_to_close_timeout=timedelta(seconds=120),
                retry_policy=ML_SERVICE_RETRY
            )
            
            self._set_progress(100, WorkflowStep.COMPLETED)
            
            return {
                "originalUri": upload_result.azure_uri,
                "resizedUri": resize_result.resized_uri,
                "resizedImageBase64": resize_result.image_base64,
                "maskUri": mask_result.mask_uri,
                "backgroundRemoved": background_removed
            }
            
        except Exception as e:
            workflow.logger.error(f"Preprocessing failed: {e}")
            raise
    
    def _set_progress(self, progress: int, step: WorkflowStep):
        self._progress = progress
        self._current_step = step.value
    
    @workflow.query
    def get_progress(self) -> WorkflowProgress:
        return WorkflowProgress(
            progress=self._progress,
            current_step=self._current_step,
            steps_completed=int((self._progress / 100) * 5),
            total_steps=5
        )
    
    @workflow.signal
    def cancel(self, reason: str = "User cancelled"):
        self._cancelled = True


@workflow.defn
class GenerationWorkflow:
    """Workflow for generation only (refinement + Flux/Gemini)."""
    
    def __init__(self):
        self._progress = 0
        self._current_step = WorkflowStep.REFINING_MASK.value
        self._cancelled = False
    
    @workflow.run
    async def run(self, image_uri: str, mask_uri: str, brush_strokes: Optional[list] = None) -> dict:
        """Execute generation workflow."""
        workflow.logger.info("Starting GenerationWorkflow")
        
        try:
            final_mask_uri = mask_uri
            
            # Step 1: Refine mask if brush strokes provided
            if brush_strokes and len(brush_strokes) > 0:
                self._set_progress(20, WorkflowStep.REFINING_MASK)
                
                # Convert brush strokes to proper format
                strokes = []
                for s in brush_strokes:
                    points = [StrokePoint(x=p["x"], y=p["y"]) for p in s.get("points", [])]
                    strokes.append(BrushStroke(
                        points=points,
                        mode=s.get("mode", "add"),
                        size=s.get("size", 20)
                    ))
                
                refine_result = await workflow.execute_activity(
                    "refine_mask",
                    RefineMaskInput(
                        image_uri=image_uri,
                        mask_uri=mask_uri,
                        strokes=strokes
                    ),
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=ML_SERVICE_RETRY
                )
                final_mask_uri = refine_result.refined_mask_uri
            
            # Step 2: Generate images
            self._set_progress(50, WorkflowStep.GENERATING_IMAGES)
            generate_result = await workflow.execute_activity(
                "generate_images",
                GenerateImagesInput(
                    image_uri=image_uri,
                    mask_uri=final_mask_uri
                ),
                start_to_close_timeout=timedelta(seconds=300),
                retry_policy=ML_SERVICE_RETRY
            )
            
            self._set_progress(100, WorkflowStep.COMPLETED)
            
            # Convert metrics to dict if present
            flux_metrics = None
            if generate_result.flux_metrics:
                flux_metrics = {
                    "precision": generate_result.flux_metrics.precision,
                    "recall": generate_result.flux_metrics.recall,
                    "iou": generate_result.flux_metrics.iou,
                    "growthRatio": generate_result.flux_metrics.growth_ratio
                }
            
            gemini_metrics = None
            if generate_result.gemini_metrics:
                gemini_metrics = {
                    "precision": generate_result.gemini_metrics.precision,
                    "recall": generate_result.gemini_metrics.recall,
                    "iou": generate_result.gemini_metrics.iou,
                    "growthRatio": generate_result.gemini_metrics.growth_ratio
                }
            
            return {
                "fluxResultBase64": generate_result.flux_result_base64,
                "geminiResultBase64": generate_result.gemini_result_base64,
                "fluxFidelityVizBase64": generate_result.flux_fidelity_viz_base64,
                "geminiFidelityVizBase64": generate_result.gemini_fidelity_viz_base64,
                "fluxMetrics": flux_metrics,
                "geminiMetrics": gemini_metrics,
                "finalMaskUri": final_mask_uri
            }
            
        except Exception as e:
            workflow.logger.error(f"Generation failed: {e}")
            raise
    
    def _set_progress(self, progress: int, step: WorkflowStep):
        self._progress = progress
        self._current_step = step.value
    
    @workflow.query
    def get_progress(self) -> WorkflowProgress:
        return WorkflowProgress(
            progress=self._progress,
            current_step=self._current_step,
            steps_completed=int((self._progress / 100) * 2),
            total_steps=2
        )
    
    @workflow.signal
    def cancel(self, reason: str = "User cancelled"):
        self._cancelled = True
