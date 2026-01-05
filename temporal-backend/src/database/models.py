"""Database models for the jewelry generation platform."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4


class UserStatus(str, Enum):
    """User account status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class GenerationStatus(str, Enum):
    """Generation workflow status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    """Payment transaction status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class UserRole(str, Enum):
    """User roles for access control."""
    USER = "user"
    PRO = "pro"
    ADMIN = "admin"
    MODERATOR = "moderator"


class JewelryType(str, Enum):
    """Types of jewelry for generation."""
    NECKLACE = "necklace"
    BRACELET = "bracelet"
    RING = "ring"
    EARRING = "earring"
    PENDANT = "pendant"
    OTHER = "other"


class ImageType(str, Enum):
    """Types of images in a generation."""
    ORIGINAL = "original"
    PROCESSED = "processed"
    MASK = "mask"
    FLUX_RESULT = "flux_result"
    FLUX_FIDELITY = "flux_fidelity"
    GEMINI_RESULT = "gemini_result"
    GEMINI_FIDELITY = "gemini_fidelity"


@dataclass
class User:
    """User profile model."""
    id: UUID
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: UserStatus = UserStatus.ACTIVE
    
    # Generation limits
    free_generations_used: int = 0
    free_generations_limit: int = 2
    paid_generations_available: int = 0
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    last_active_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    @property
    def total_available_generations(self) -> int:
        """Total generations user can perform."""
        free_remaining = max(0, self.free_generations_limit - self.free_generations_used)
        return free_remaining + self.paid_generations_available
    
    def can_generate(self) -> bool:
        """Check if user can perform a generation."""
        return self.total_available_generations > 0 and self.status == UserStatus.ACTIVE
    
    def use_generation_credit(self) -> bool:
        """Use one generation credit. Returns True if successful."""
        if not self.can_generate():
            return False
        
        if self.free_generations_used < self.free_generations_limit:
            self.free_generations_used += 1
        elif self.paid_generations_available > 0:
            self.paid_generations_available -= 1
        else:
            return False
        
        self.updated_at = datetime.utcnow()
        return True


@dataclass
class UserRoleAssignment:
    """User role assignment (separate table for security)."""
    id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    role: UserRole = UserRole.USER
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Payment:
    """Payment record for generation purchases."""
    id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    
    # Payment details
    amount_cents: int = 1900  # $19.00 default
    currency: str = "usd"
    generations_purchased: int = 1
    
    # Status
    status: PaymentStatus = PaymentStatus.PENDING
    
    # Stripe fields (placeholder for later integration)
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


@dataclass
class Generation:
    """A generation job record."""
    id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    
    # Workflow tracking
    workflow_id: Optional[str] = None
    status: GenerationStatus = GenerationStatus.PENDING
    
    # Generation details
    jewelry_type: Optional[JewelryType] = None
    prompt: Optional[str] = None
    
    # Payment tracking
    is_paid: bool = False
    payment_id: Optional[UUID] = None
    
    # Error handling
    error_message: Optional[str] = None
    
    # Metadata (mask points, brush strokes, etc.)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


@dataclass
class GenerationImage:
    """Individual image in a generation (allows multiple outputs)."""
    id: UUID = field(default_factory=uuid4)
    generation_id: UUID = field(default_factory=uuid4)
    
    # Image details
    image_type: ImageType = ImageType.ORIGINAL
    azure_path: str = ""
    azure_url: Optional[str] = None
    
    # Ordering (for multiple results)
    sequence: int = 0
    
    # File info
    file_size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    
    # Fidelity metrics (for result images)
    fidelity_precision: Optional[float] = None
    fidelity_recall: Optional[float] = None
    fidelity_iou: Optional[float] = None
    fidelity_growth_ratio: Optional[float] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
