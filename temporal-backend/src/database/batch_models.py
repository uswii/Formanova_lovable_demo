"""Database models for batch job processing."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from uuid import UUID, uuid4


class BatchStatus(str, Enum):
    """Batch job status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SkinTone(str, Enum):
    """Skin tone options for model generation."""
    LIGHT = "light"
    FAIR = "fair"
    MEDIUM = "medium"
    OLIVE = "olive"
    BROWN = "brown"
    DARK = "dark"


class ModelGender(str, Enum):
    """Gender options for model generation."""
    FEMALE = "female"
    MALE = "male"
    NEUTRAL = "neutral"


class JewelryCategory(str, Enum):
    """Jewelry category types."""
    NECKLACE = "necklace"
    RING = "ring"
    EARRING = "earring"
    BRACELET = "bracelet"
    WATCH = "watch"


@dataclass
class BatchJob:
    """A batch upload job containing multiple images."""
    id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    tenant_id: str = ""
    
    # Job details
    jewelry_category: JewelryCategory = JewelryCategory.NECKLACE
    skin_tone: SkinTone = SkinTone.MEDIUM
    gender: ModelGender = ModelGender.FEMALE
    
    # Status tracking
    status: BatchStatus = BatchStatus.PENDING
    total_images: int = 0
    completed_images: int = 0
    failed_images: int = 0
    
    # Pricing
    is_free_batch: bool = False
    credits_charged: int = 0
    
    # Processing details
    error_message: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    estimated_completion_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    @property
    def progress_percentage(self) -> float:
        """Calculate completion percentage."""
        if self.total_images == 0:
            return 0.0
        return (self.completed_images / self.total_images) * 100
    
    @property
    def is_complete(self) -> bool:
        """Check if batch is fully processed."""
        return self.status in (BatchStatus.COMPLETED, BatchStatus.FAILED, BatchStatus.CANCELLED)


@dataclass
class BatchImage:
    """An individual image within a batch job."""
    id: UUID = field(default_factory=uuid4)
    batch_id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    
    # Sequence within batch (1-10)
    sequence: int = 1
    
    # Azure Blob URLs
    original_azure_uri: str = ""
    result_azure_uri: Optional[str] = None
    mask_azure_uri: Optional[str] = None
    thumbnail_azure_uri: Optional[str] = None
    
    # Status
    status: BatchStatus = BatchStatus.PENDING
    error_message: Optional[str] = None
    
    # Quality metrics
    fidelity_metrics: Optional[Dict[str, Any]] = None
    
    # Linked workflow
    workflow_id: Optional[str] = None
    
    # Processing time
    processing_time_ms: Optional[int] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


@dataclass
class UserBatchCredits:
    """User's free batch tier tracking."""
    user_id: UUID = field(default_factory=uuid4)
    
    # Free tier
    free_batches_used: int = 0
    free_batches_limit: int = 1  # 1 free batch
    free_generations_in_batch: int = 4  # 4 gens per free batch
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def has_free_batch_available(self) -> bool:
        """Check if user has free batch credits remaining."""
        return self.free_batches_used < self.free_batches_limit
    
    @property
    def free_batches_remaining(self) -> int:
        """Get number of free batches remaining."""
        return max(0, self.free_batches_limit - self.free_batches_used)
