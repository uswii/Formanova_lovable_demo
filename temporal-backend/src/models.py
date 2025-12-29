"""Data models for the Temporal workflow."""
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class WorkflowStep(str, Enum):
    """Steps in the jewelry generation workflow."""
    UPLOADING_IMAGE = "UPLOADING_IMAGE"
    RESIZING_IMAGE = "RESIZING_IMAGE"
    CHECKING_ZOOM = "CHECKING_ZOOM"
    REMOVING_BACKGROUND = "REMOVING_BACKGROUND"
    GENERATING_MASK = "GENERATING_MASK"
    REFINING_MASK = "REFINING_MASK"
    UPLOADING_MASK = "UPLOADING_MASK"
    GENERATING_IMAGES = "GENERATING_IMAGES"
    COMPLETED = "COMPLETED"


@dataclass
class MaskPoint:
    """A point marked by the user for SAM3 segmentation."""
    x: float  # 0-1 normalized
    y: float  # 0-1 normalized
    label: int  # 0 = background, 1 = foreground


@dataclass
class StrokePoint:
    """A point in a brush stroke."""
    x: float  # 0-1 normalized
    y: float  # 0-1 normalized


@dataclass
class BrushStroke:
    """A brush stroke for mask refinement."""
    points: List[StrokePoint]
    mode: str  # "add" or "remove"
    size: int  # Brush size in pixels


@dataclass
class WorkflowInput:
    """Input to the JewelryGenerationWorkflow."""
    original_image_base64: str
    mask_points: List[MaskPoint]
    brush_strokes: Optional[List[BrushStroke]] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None


@dataclass
class FidelityMetrics:
    """Metrics for generation quality."""
    precision: float
    recall: float
    iou: float
    growth_ratio: float


@dataclass
class WorkflowOutput:
    """Output from the JewelryGenerationWorkflow."""
    flux_result_base64: str
    flux_fidelity_viz_base64: Optional[str] = None
    flux_metrics: Optional[FidelityMetrics] = None
    gemini_result_base64: Optional[str] = None
    gemini_fidelity_viz_base64: Optional[str] = None
    gemini_metrics: Optional[FidelityMetrics] = None
    processed_image_uri: Optional[str] = None
    final_mask_uri: Optional[str] = None
    background_removed: bool = False


@dataclass
class WorkflowProgress:
    """Current progress of a workflow."""
    progress: int  # 0-100
    current_step: str
    steps_completed: int = 0
    total_steps: int = 8


@dataclass
class WorkflowError:
    """Error information for a failed workflow."""
    code: str
    message: str
    failed_step: str
    retry_count: int = 0
    is_retryable: bool = True


# Activity input/output types
@dataclass
class UploadInput:
    """Input for upload activity."""
    base64_data: str
    content_type: str = "image/jpeg"
    filename_prefix: str = "image"


@dataclass
class UploadOutput:
    """Output from upload activity."""
    azure_uri: str
    https_url: str
    sas_url: str


@dataclass
class ResizeInput:
    """Input for resize activity."""
    image_uri: str
    target_width: int = 2000
    target_height: int = 2667


@dataclass
class ResizeOutput:
    """Output from resize activity."""
    image_base64: str
    resized_uri: str
    padding: dict = field(default_factory=lambda: {"top": 0, "bottom": 0, "left": 0, "right": 0})


@dataclass
class ZoomCheckInput:
    """Input for zoom check activity."""
    image_uri: str


@dataclass
class ZoomCheckOutput:
    """Output from zoom check activity."""
    recommend_bg_removal: bool


@dataclass
class BackgroundRemoveInput:
    """Input for background removal activity."""
    image_uri: str


@dataclass
class BackgroundRemoveOutput:
    """Output from background removal activity."""
    result_uri: str


@dataclass
class GenerateMaskInput:
    """Input for mask generation activity."""
    image_uri: str
    points: List[MaskPoint]


@dataclass
class GenerateMaskOutput:
    """Output from mask generation activity."""
    mask_uri: str


@dataclass
class RefineMaskInput:
    """Input for mask refinement activity."""
    image_uri: str
    mask_uri: str
    strokes: List[BrushStroke]


@dataclass
class RefineMaskOutput:
    """Output from mask refinement activity."""
    refined_mask_uri: str


@dataclass
class GenerateImagesInput:
    """Input for image generation activity."""
    image_uri: str
    mask_uri: str


@dataclass
class GenerateImagesOutput:
    """Output from image generation activity."""
    flux_result_base64: str
    gemini_result_base64: Optional[str] = None
    flux_fidelity_viz_base64: Optional[str] = None
    gemini_fidelity_viz_base64: Optional[str] = None
    flux_metrics: Optional[FidelityMetrics] = None
    gemini_metrics: Optional[FidelityMetrics] = None
