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
        workflow.logger.info("▶ JewelryGenerationWorkflow started")
        
        try:
            # Step 1: Upload original image
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
            original_uri = upload_result["azure_uri"] if isinstance(upload_result, dict) else upload_result.azure_uri
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 2: Resize
            self._set_progress(15, WorkflowStep.RESIZING_IMAGE)
            resize_result = await workflow.execute_activity(
                "resize_image",
                ResizeInput(image_uri=original_uri, target_width=2000, target_height=2667),
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            resized_uri = resize_result["resized_uri"] if isinstance(resize_result, dict) else resize_result.resized_uri
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 3: Check zoom
            self._set_progress(20, WorkflowStep.CHECKING_ZOOM)
            zoom_result = await workflow.execute_activity(
                "check_zoom",
                ZoomCheckInput(image_uri=resized_uri),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            recommend_bg_removal = zoom_result["recommend_bg_removal"] if isinstance(zoom_result, dict) else zoom_result.recommend_bg_removal
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            image_for_segmentation = resized_uri
            background_removed = False
            
            # Step 4: Remove background if needed
            if recommend_bg_removal:
                self._set_progress(30, WorkflowStep.REMOVING_BACKGROUND)
                bg_result = await workflow.execute_activity(
                    "remove_background",
                    BackgroundRemoveInput(image_uri=resized_uri),
                    start_to_close_timeout=timedelta(seconds=120),
                    retry_policy=ML_SERVICE_RETRY
                )
                image_for_segmentation = bg_result["result_uri"] if isinstance(bg_result, dict) else bg_result.result_uri
                background_removed = True
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 5: Generate mask
            self._set_progress(45, WorkflowStep.GENERATING_MASK)
            mask_result = await workflow.execute_activity(
                "generate_mask",
                GenerateMaskInput(image_uri=image_for_segmentation, points=input.mask_points),
                start_to_close_timeout=timedelta(seconds=120),
                retry_policy=ML_SERVICE_RETRY
            )
            mask_uri = mask_result["mask_uri"] if isinstance(mask_result, dict) else mask_result.mask_uri
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            final_mask_uri = mask_uri
            
            # Step 6: Refine mask if brush strokes provided
            if input.brush_strokes and len(input.brush_strokes) > 0:
                self._set_progress(55, WorkflowStep.REFINING_MASK)
                refine_result = await workflow.execute_activity(
                    "refine_mask",
                    RefineMaskInput(image_uri=image_for_segmentation, mask_uri=mask_uri, strokes=input.brush_strokes),
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=ML_SERVICE_RETRY
                )
                final_mask_uri = refine_result["refined_mask_uri"] if isinstance(refine_result, dict) else refine_result.refined_mask_uri
            
            if self._cancelled:
                raise workflow.CancelledError(self._cancel_reason)
            
            # Step 7: Mask already uploaded
            self._set_progress(60, WorkflowStep.UPLOADING_MASK)
            
            # Step 8: Generate images
            self._set_progress(70, WorkflowStep.GENERATING_IMAGES)
            generate_result = await workflow.execute_activity(
                "generate_images",
                GenerateImagesInput(image_uri=resized_uri, mask_uri=final_mask_uri),
                start_to_close_timeout=timedelta(seconds=300),
                retry_policy=ML_SERVICE_RETRY
            )
            
            self._set_progress(100, WorkflowStep.COMPLETED)
            workflow.logger.info("✓ JewelryGenerationWorkflow completed")
            
            flux_uri = generate_result["flux_result_uri"] if isinstance(generate_result, dict) else generate_result.flux_result_uri
            flux_viz_uri = generate_result["flux_fidelity_viz_uri"] if isinstance(generate_result, dict) else generate_result.flux_fidelity_viz_uri
            flux_metrics = generate_result["flux_metrics"] if isinstance(generate_result, dict) else generate_result.flux_metrics
            gemini_uri = generate_result["gemini_result_uri"] if isinstance(generate_result, dict) else generate_result.gemini_result_uri
            gemini_viz_uri = generate_result["gemini_fidelity_viz_uri"] if isinstance(generate_result, dict) else generate_result.gemini_fidelity_viz_uri
            gemini_metrics = generate_result["gemini_metrics"] if isinstance(generate_result, dict) else generate_result.gemini_metrics
            
            return WorkflowOutput(
                flux_result_uri=flux_uri,
                flux_fidelity_viz_uri=flux_viz_uri,
                flux_metrics=flux_metrics,
                gemini_result_uri=gemini_uri,
                gemini_fidelity_viz_uri=gemini_viz_uri,
                gemini_metrics=gemini_metrics,
                processed_image_uri=resized_uri,
                final_mask_uri=final_mask_uri,
                background_removed=background_removed
            )
            
        except workflow.CancelledError as e:
            workflow.logger.info(f"⚠ Workflow cancelled: {e}")
            raise
        except Exception as e:
            workflow.logger.error(f"✗ Workflow failed: {e}")
            raise
    
    def _set_progress(self, progress: int, step: WorkflowStep):
        self._progress = progress
        self._current_step = step.value
        self._steps_completed = int((progress / 100) * self._total_steps)
    
    @workflow.query
    def get_progress(self) -> WorkflowProgress:
        return WorkflowProgress(
            progress=self._progress,
            current_step=self._current_step,
            steps_completed=self._steps_completed,
            total_steps=self._total_steps
        )
    
    @workflow.query
    def get_current_step(self) -> str:
        return self._current_step
    
    @workflow.signal
    def cancel(self, reason: str = "User cancelled"):
        workflow.logger.info(f"⚠ Cancel signal: {reason}")
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
        workflow.logger.info("▶ PreprocessingWorkflow started")
        
        try:
            session_id = str(workflow.uuid4())
            
            # Step 1: Upload
            self._set_progress(10, WorkflowStep.UPLOADING_IMAGE)
            upload_result = await workflow.execute_activity(
                "upload_to_azure",
                UploadInput(base64_data=input.original_image_base64, content_type="image/jpeg", filename_prefix="original"),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            original_uri = upload_result["azure_uri"] if isinstance(upload_result, dict) else upload_result.azure_uri
            
            # Step 2: Resize
            self._set_progress(30, WorkflowStep.RESIZING_IMAGE)
            resize_result = await workflow.execute_activity(
                "resize_image",
                ResizeInput(image_uri=original_uri, target_width=2000, target_height=2667),
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            resized_uri = resize_result["resized_uri"] if isinstance(resize_result, dict) else resize_result.resized_uri
            padding = resize_result["padding"] if isinstance(resize_result, dict) else resize_result.padding
            
            # Step 3: Zoom check
            self._set_progress(40, WorkflowStep.CHECKING_ZOOM)
            zoom_result = await workflow.execute_activity(
                "check_zoom",
                ZoomCheckInput(image_uri=resized_uri),
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=IMAGE_PROCESSING_RETRY
            )
            recommend_bg_removal = zoom_result["recommend_bg_removal"] if isinstance(zoom_result, dict) else zoom_result.recommend_bg_removal
            
            image_for_segmentation = resized_uri
            background_removed = False
            
            # Step 4: Background removal if needed
            if recommend_bg_removal:
                self._set_progress(60, WorkflowStep.REMOVING_BACKGROUND)
                bg_result = await workflow.execute_activity(
                    "remove_background",
                    BackgroundRemoveInput(image_uri=resized_uri),
                    start_to_close_timeout=timedelta(seconds=120),
                    retry_policy=ML_SERVICE_RETRY
                )
                image_for_segmentation = bg_result["result_uri"] if isinstance(bg_result, dict) else bg_result.result_uri
                background_removed = True
            
            # Step 5: Generate mask
            self._set_progress(80, WorkflowStep.GENERATING_MASK)
            mask_result = await workflow.execute_activity(
                "generate_mask",
                GenerateMaskInput(image_uri=image_for_segmentation, points=input.mask_points),
                start_to_close_timeout=timedelta(seconds=120),
                retry_policy=ML_SERVICE_RETRY
            )
            mask_uri = mask_result["mask_uri"] if isinstance(mask_result, dict) else mask_result.mask_uri
            
            scaled_points = [[p.x * 2000, p.y * 2667] for p in input.mask_points]
            
            self._set_progress(100, WorkflowStep.COMPLETED)
            workflow.logger.info("✓ PreprocessingWorkflow completed")
            
            return {
                "sessionId": session_id,
                "originalUri": original_uri,
                "resizedUri": resized_uri,
                "maskUri": mask_uri,
                "bgRemovedUri": image_for_segmentation if background_removed else None,
                "backgroundRemoved": background_removed,
                "padding": {"top": padding[0], "bottom": padding[1], "left": padding[2], "right": padding[3]} if isinstance(padding, list) else padding,
                "scaledPoints": scaled_points
            }
            
        except Exception as e:
            workflow.logger.error(f"✗ Preprocessing failed: {e}")
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
    async def run(
        self, 
        image_uri: str, 
        mask_uri: str, 
        brush_strokes: Optional[list] = None,
        gender: str = "female",
        scaled_points: Optional[list] = None
    ) -> dict:
        """Execute generation workflow."""
        workflow.logger.info("▶ GenerationWorkflow started")
        
        try:
            final_mask_uri = mask_uri
            
            # Step 1: Refine mask if strokes provided
            if brush_strokes and len(brush_strokes) > 0:
                self._set_progress(20, WorkflowStep.REFINING_MASK)
                
                strokes = []
                for s in brush_strokes:
                    points = [StrokePoint(x=p["x"], y=p["y"]) for p in s.get("points", [])]
                    strokes.append(BrushStroke(points=points, mode=s.get("mode", "add"), size=s.get("size", 20)))
                
                refine_result = await workflow.execute_activity(
                    "refine_mask",
                    RefineMaskInput(image_uri=image_uri, mask_uri=mask_uri, strokes=strokes),
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=ML_SERVICE_RETRY
                )
                final_mask_uri = refine_result["refined_mask_uri"] if isinstance(refine_result, dict) else refine_result.refined_mask_uri
            
            # Step 2: Generate images
            self._set_progress(50, WorkflowStep.GENERATING_IMAGES)
            generate_result = await workflow.execute_activity(
                "generate_images",
                GenerateImagesInput(
                    image_uri=image_uri,
                    mask_uri=final_mask_uri,
                    gender=gender,
                    scaled_points=scaled_points
                ),
                start_to_close_timeout=timedelta(seconds=300),
                retry_policy=ML_SERVICE_RETRY
            )
            
            self._set_progress(100, WorkflowStep.COMPLETED)
            workflow.logger.info("✓ GenerationWorkflow completed")
            
            flux_uri = generate_result["flux_result_uri"] if isinstance(generate_result, dict) else generate_result.flux_result_uri
            flux_viz_uri = generate_result["flux_fidelity_viz_uri"] if isinstance(generate_result, dict) else generate_result.flux_fidelity_viz_uri
            flux_metrics = generate_result["flux_metrics"] if isinstance(generate_result, dict) else generate_result.flux_metrics
            gemini_uri = generate_result["gemini_result_uri"] if isinstance(generate_result, dict) else generate_result.gemini_result_uri
            gemini_viz_uri = generate_result["gemini_fidelity_viz_uri"] if isinstance(generate_result, dict) else generate_result.gemini_fidelity_viz_uri
            gemini_metrics = generate_result["gemini_metrics"] if isinstance(generate_result, dict) else generate_result.gemini_metrics
            
            # Helper to safely get metric value from dict or dataclass
            def get_metric(metrics, key, default=0):
                if not metrics:
                    return default
                if isinstance(metrics, dict):
                    return metrics.get(key, default)
                return getattr(metrics, key, default)
            
            return {
                "fluxResultUri": flux_uri,
                "fluxFidelityVizUri": flux_viz_uri,
                "fluxMetrics": {
                    "precision": get_metric(flux_metrics, "precision", 0),
                    "recall": get_metric(flux_metrics, "recall", 0),
                    "iou": get_metric(flux_metrics, "iou", 0),
                    "growthRatio": get_metric(flux_metrics, "growth_ratio", 1)
                } if flux_metrics else None,
                "geminiResultUri": gemini_uri,
                "geminiFidelityVizUri": gemini_viz_uri,
                "geminiMetrics": {
                    "precision": get_metric(gemini_metrics, "precision", 0),
                    "recall": get_metric(gemini_metrics, "recall", 0),
                    "iou": get_metric(gemini_metrics, "iou", 0),
                    "growthRatio": get_metric(gemini_metrics, "growth_ratio", 1)
                } if gemini_metrics else None,
                "finalMaskUri": final_mask_uri
            }
            
        except Exception as e:
            workflow.logger.error(f"✗ Generation failed: {e}")
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
