"""Database API endpoints for the Temporal backend."""
import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr

from .database import (
    DatabaseRepository, get_database,
    User, UserStatus, UserRole,
    Payment, PaymentStatus,
    Generation, GenerationStatus, JewelryType,
    GenerationImage, ImageType,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/db", tags=["Database"])


# -------------------------
# Dependency
# -------------------------
async def get_repository() -> DatabaseRepository:
    """Get database repository."""
    pool = await get_database()
    return DatabaseRepository(pool)


# -------------------------
# Request/Response Models
# -------------------------

class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    free_generations_used: int
    free_generations_limit: int
    paid_generations_available: int
    total_available: int
    roles: List[str] = []


class UserCreditsResponse(BaseModel):
    free_remaining: int
    paid_available: int
    total: int
    can_generate: bool


class CreatePaymentRequest(BaseModel):
    user_id: UUID
    amount_cents: int = Field(default=1900, ge=100)
    generations_purchased: int = Field(default=1, ge=1)


class PaymentResponse(BaseModel):
    id: UUID
    user_id: UUID
    amount_cents: int
    currency: str
    generations_purchased: int
    status: str
    stripe_session_id: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class CompletePaymentRequest(BaseModel):
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None


class CreateGenerationRequest(BaseModel):
    user_id: UUID
    jewelry_type: Optional[str] = None
    metadata: Optional[dict] = None


class GenerationResponse(BaseModel):
    id: UUID
    user_id: UUID
    workflow_id: Optional[str] = None
    status: str
    jewelry_type: Optional[str] = None
    is_paid: bool
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class UserStatsResponse(BaseModel):
    generations: dict
    credits: dict


# -------------------------
# User Endpoints
# -------------------------

@router.post("/users", response_model=UserResponse)
async def create_user(
    request: CreateUserRequest,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Create a new user with free generation credits."""
    import uuid
    
    # Check if user already exists
    existing = await repo.get_user_by_email(request.email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    user = await repo.create_user(
        user_id=uuid.uuid4(),
        email=request.email,
        full_name=request.full_name
    )
    roles = await repo.get_user_roles(user.id)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        status=user.status.value,
        free_generations_used=user.free_generations_used,
        free_generations_limit=user.free_generations_limit,
        paid_generations_available=user.paid_generations_available,
        total_available=user.total_available_generations,
        roles=[r.value for r in roles]
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get user by ID."""
    user = await repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    roles = await repo.get_user_roles(user.id)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        status=user.status.value,
        free_generations_used=user.free_generations_used,
        free_generations_limit=user.free_generations_limit,
        paid_generations_available=user.paid_generations_available,
        total_available=user.total_available_generations,
        roles=[r.value for r in roles]
    )


@router.get("/users/{user_id}/credits", response_model=UserCreditsResponse)
async def get_user_credits(
    user_id: UUID,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get user's generation credits."""
    credits = await repo.get_remaining_generations(user_id)
    can_generate = await repo.can_user_generate(user_id)
    
    return UserCreditsResponse(
        free_remaining=credits["free_remaining"],
        paid_available=credits["paid_available"],
        total=credits["total"],
        can_generate=can_generate
    )


@router.post("/users/{user_id}/use-credit")
async def use_generation_credit(
    user_id: UUID,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Use one generation credit."""
    success = await repo.use_generation_credit(user_id)
    if not success:
        raise HTTPException(status_code=400, detail="No generation credits available")
    
    credits = await repo.get_remaining_generations(user_id)
    return {"success": True, "remaining": credits}


@router.get("/users/{user_id}/stats", response_model=UserStatsResponse)
async def get_user_stats(
    user_id: UUID,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get user statistics."""
    stats = await repo.get_user_stats(user_id)
    return UserStatsResponse(**stats)


# -------------------------
# Payment Endpoints
# -------------------------

@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    request: CreatePaymentRequest,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Create a new payment record."""
    payment = await repo.create_payment(
        user_id=request.user_id,
        amount_cents=request.amount_cents,
        generations_purchased=request.generations_purchased
    )
    
    return PaymentResponse(
        id=payment.id,
        user_id=payment.user_id,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        generations_purchased=payment.generations_purchased,
        status=payment.status.value,
        stripe_session_id=payment.stripe_session_id,
        created_at=payment.created_at.isoformat(),
        completed_at=payment.completed_at.isoformat() if payment.completed_at else None
    )


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: UUID,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get payment by ID."""
    payment = await repo.get_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return PaymentResponse(
        id=payment.id,
        user_id=payment.user_id,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        generations_purchased=payment.generations_purchased,
        status=payment.status.value,
        stripe_session_id=payment.stripe_session_id,
        created_at=payment.created_at.isoformat(),
        completed_at=payment.completed_at.isoformat() if payment.completed_at else None
    )


@router.post("/payments/{payment_id}/complete", response_model=PaymentResponse)
async def complete_payment(
    payment_id: UUID,
    request: CompletePaymentRequest,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Complete a payment and add generation credits."""
    # Update Stripe fields if provided
    if request.stripe_session_id or request.stripe_payment_intent_id:
        await repo.update_payment_status(
            payment_id,
            PaymentStatus.PENDING,  # Keep pending until complete
            stripe_payment_intent_id=request.stripe_payment_intent_id,
            stripe_session_id=request.stripe_session_id
        )
    
    payment = await repo.complete_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=400, detail="Payment cannot be completed")
    
    return PaymentResponse(
        id=payment.id,
        user_id=payment.user_id,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        generations_purchased=payment.generations_purchased,
        status=payment.status.value,
        stripe_session_id=payment.stripe_session_id,
        created_at=payment.created_at.isoformat(),
        completed_at=payment.completed_at.isoformat() if payment.completed_at else None
    )


@router.get("/users/{user_id}/payments", response_model=List[PaymentResponse])
async def get_user_payments(
    user_id: UUID,
    limit: int = 50,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get payments for a user."""
    payments = await repo.get_user_payments(user_id, limit)
    
    return [
        PaymentResponse(
            id=p.id,
            user_id=p.user_id,
            amount_cents=p.amount_cents,
            currency=p.currency,
            generations_purchased=p.generations_purchased,
            status=p.status.value,
            stripe_session_id=p.stripe_session_id,
            created_at=p.created_at.isoformat(),
            completed_at=p.completed_at.isoformat() if p.completed_at else None
        )
        for p in payments
    ]


# -------------------------
# Generation Endpoints
# -------------------------

@router.post("/generations", response_model=GenerationResponse)
async def create_generation(
    request: CreateGenerationRequest,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Create a new generation record."""
    # Check if user can generate
    can_generate = await repo.can_user_generate(request.user_id)
    if not can_generate:
        raise HTTPException(status_code=400, detail="No generation credits available")
    
    jewelry_type = JewelryType(request.jewelry_type) if request.jewelry_type else None
    
    generation = await repo.create_generation(
        user_id=request.user_id,
        jewelry_type=jewelry_type,
        metadata=request.metadata
    )
    
    return GenerationResponse(
        id=generation.id,
        user_id=generation.user_id,
        workflow_id=generation.workflow_id,
        status=generation.status.value,
        jewelry_type=generation.jewelry_type.value if generation.jewelry_type else None,
        is_paid=generation.is_paid,
        error_message=generation.error_message,
        created_at=generation.created_at.isoformat(),
        completed_at=generation.completed_at.isoformat() if generation.completed_at else None
    )


@router.get("/generations/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: UUID,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get generation by ID."""
    generation = await repo.get_generation(generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    return GenerationResponse(
        id=generation.id,
        user_id=generation.user_id,
        workflow_id=generation.workflow_id,
        status=generation.status.value,
        jewelry_type=generation.jewelry_type.value if generation.jewelry_type else None,
        is_paid=generation.is_paid,
        error_message=generation.error_message,
        created_at=generation.created_at.isoformat(),
        completed_at=generation.completed_at.isoformat() if generation.completed_at else None
    )


@router.post("/generations/{generation_id}/link-workflow")
async def link_generation_to_workflow(
    generation_id: UUID,
    workflow_id: str,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Link a generation to a Temporal workflow."""
    await repo.link_generation_to_workflow(generation_id, workflow_id)
    return {"success": True, "generation_id": str(generation_id), "workflow_id": workflow_id}


@router.post("/generations/{generation_id}/status")
async def update_generation_status(
    generation_id: UUID,
    status: str,
    error_message: Optional[str] = None,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Update generation status."""
    try:
        gen_status = GenerationStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    generation = await repo.update_generation_status(generation_id, gen_status, error_message)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    return {"success": True, "status": generation.status.value}


@router.get("/users/{user_id}/generations", response_model=List[GenerationResponse])
async def get_user_generations(
    user_id: UUID,
    limit: int = 50,
    repo: DatabaseRepository = Depends(get_repository)
):
    """Get generations for a user."""
    generations = await repo.get_user_generations(user_id, limit)
    
    return [
        GenerationResponse(
            id=g.id,
            user_id=g.user_id,
            workflow_id=g.workflow_id,
            status=g.status.value,
            jewelry_type=g.jewelry_type.value if g.jewelry_type else None,
            is_paid=g.is_paid,
            error_message=g.error_message,
            created_at=g.created_at.isoformat(),
            completed_at=g.completed_at.isoformat() if g.completed_at else None
        )
        for g in generations
    ]
