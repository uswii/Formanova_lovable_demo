"""Database repository for CRUD operations."""
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from .connection import DatabasePool
from .models import (
    User, UserStatus, UserRole, UserRoleAssignment,
    Payment, PaymentStatus,
    Generation, GenerationStatus, JewelryType,
    GenerationImage, ImageType,
)

logger = logging.getLogger(__name__)


class DatabaseRepository:
    """Repository pattern for database operations."""
    
    def __init__(self, pool: DatabasePool):
        self.pool = pool
    
    # -------------------------
    # User Operations
    # -------------------------
    
    async def create_user(self, user_id: UUID, email: str, full_name: Optional[str] = None) -> User:
        """Create a new user with default settings."""
        query = """
            INSERT INTO users (id, email, full_name, status, free_generations_used, 
                              free_generations_limit, paid_generations_available, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            RETURNING *
        """
        now = datetime.utcnow()
        row = await self.pool.fetchrow(
            query, user_id, email, full_name, UserStatus.ACTIVE.value,
            0, 2, 0, now
        )
        
        # Also assign default user role
        await self.assign_role(user_id, UserRole.USER)
        
        return self._row_to_user(row)
    
    async def get_user(self, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        query = "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL"
        row = await self.pool.fetchrow(query, user_id)
        return self._row_to_user(row) if row else None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        query = "SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL"
        row = await self.pool.fetchrow(query, email)
        return self._row_to_user(row) if row else None
    
    async def update_user(self, user_id: UUID, **updates) -> Optional[User]:
        """Update user fields."""
        if not updates:
            return await self.get_user(user_id)
        
        updates["updated_at"] = datetime.utcnow()
        set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates.keys()))
        query = f"UPDATE users SET {set_clause} WHERE id = $1 RETURNING *"
        
        row = await self.pool.fetchrow(query, user_id, *updates.values())
        return self._row_to_user(row) if row else None
    
    async def update_last_active(self, user_id: UUID) -> None:
        """Update user's last active timestamp."""
        query = "UPDATE users SET last_active_at = $2, updated_at = $2 WHERE id = $1"
        await self.pool.execute(query, user_id, datetime.utcnow())
    
    async def soft_delete_user(self, user_id: UUID) -> None:
        """Soft delete a user."""
        now = datetime.utcnow()
        query = "UPDATE users SET status = $2, deleted_at = $3, updated_at = $3 WHERE id = $1"
        await self.pool.execute(query, user_id, UserStatus.DELETED.value, now)
    
    # -------------------------
    # Generation Credit Operations
    # -------------------------
    
    async def get_remaining_generations(self, user_id: UUID) -> Dict[str, int]:
        """Get user's remaining generation credits."""
        query = """
            SELECT free_generations_used, free_generations_limit, paid_generations_available
            FROM users WHERE id = $1
        """
        row = await self.pool.fetchrow(query, user_id)
        if not row:
            return {"free_remaining": 0, "paid_available": 0, "total": 0}
        
        free_remaining = max(0, row["free_generations_limit"] - row["free_generations_used"])
        return {
            "free_remaining": free_remaining,
            "paid_available": row["paid_generations_available"],
            "total": free_remaining + row["paid_generations_available"]
        }
    
    async def can_user_generate(self, user_id: UUID) -> bool:
        """Check if user can perform a generation."""
        remaining = await self.get_remaining_generations(user_id)
        return remaining["total"] > 0
    
    async def use_generation_credit(self, user_id: UUID) -> bool:
        """Use one generation credit. Returns True if successful."""
        async with self.pool.transaction() as conn:
            # Lock the row for update
            query = """
                SELECT free_generations_used, free_generations_limit, paid_generations_available
                FROM users WHERE id = $1 FOR UPDATE
            """
            row = await conn.fetchrow(query, user_id)
            if not row:
                return False
            
            free_remaining = row["free_generations_limit"] - row["free_generations_used"]
            
            if free_remaining > 0:
                # Use free credit
                await conn.execute(
                    "UPDATE users SET free_generations_used = free_generations_used + 1, updated_at = $2 WHERE id = $1",
                    user_id, datetime.utcnow()
                )
                return True
            elif row["paid_generations_available"] > 0:
                # Use paid credit
                await conn.execute(
                    "UPDATE users SET paid_generations_available = paid_generations_available - 1, updated_at = $2 WHERE id = $1",
                    user_id, datetime.utcnow()
                )
                return True
            
            return False
    
    async def add_paid_generations(self, user_id: UUID, count: int) -> int:
        """Add paid generation credits. Returns new total."""
        query = """
            UPDATE users 
            SET paid_generations_available = paid_generations_available + $2, updated_at = $3
            WHERE id = $1
            RETURNING paid_generations_available
        """
        return await self.pool.fetchval(query, user_id, count, datetime.utcnow())
    
    # -------------------------
    # Role Operations
    # -------------------------
    
    async def assign_role(self, user_id: UUID, role: UserRole) -> UserRoleAssignment:
        """Assign a role to a user."""
        query = """
            INSERT INTO user_roles (user_id, role, created_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, role) DO NOTHING
            RETURNING *
        """
        row = await self.pool.fetchrow(query, user_id, role.value, datetime.utcnow())
        return self._row_to_role_assignment(row) if row else None
    
    async def remove_role(self, user_id: UUID, role: UserRole) -> None:
        """Remove a role from a user."""
        query = "DELETE FROM user_roles WHERE user_id = $1 AND role = $2"
        await self.pool.execute(query, user_id, role.value)
    
    async def get_user_roles(self, user_id: UUID) -> List[UserRole]:
        """Get all roles for a user."""
        query = "SELECT role FROM user_roles WHERE user_id = $1"
        rows = await self.pool.fetch(query, user_id)
        return [UserRole(row["role"]) for row in rows]
    
    async def has_role(self, user_id: UUID, role: UserRole) -> bool:
        """Check if user has a specific role."""
        query = "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2)"
        return await self.pool.fetchval(query, user_id, role.value)
    
    # -------------------------
    # Payment Operations
    # -------------------------
    
    async def create_payment(
        self,
        user_id: UUID,
        amount_cents: int = 1900,
        generations_purchased: int = 1,
        **metadata
    ) -> Payment:
        """Create a new payment record."""
        query = """
            INSERT INTO payments (user_id, amount_cents, currency, generations_purchased, 
                                 status, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
            RETURNING *
        """
        now = datetime.utcnow()
        row = await self.pool.fetchrow(
            query, user_id, amount_cents, "usd", generations_purchased,
            PaymentStatus.PENDING.value, metadata, now
        )
        return self._row_to_payment(row)
    
    async def get_payment(self, payment_id: UUID) -> Optional[Payment]:
        """Get payment by ID."""
        query = "SELECT * FROM payments WHERE id = $1"
        row = await self.pool.fetchrow(query, payment_id)
        return self._row_to_payment(row) if row else None
    
    async def get_user_payments(self, user_id: UUID, limit: int = 50) -> List[Payment]:
        """Get payments for a user."""
        query = "SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
        rows = await self.pool.fetch(query, user_id, limit)
        return [self._row_to_payment(row) for row in rows]
    
    async def update_payment_status(
        self,
        payment_id: UUID,
        status: PaymentStatus,
        stripe_payment_intent_id: Optional[str] = None,
        stripe_session_id: Optional[str] = None,
    ) -> Optional[Payment]:
        """Update payment status and Stripe fields."""
        now = datetime.utcnow()
        completed_at = now if status == PaymentStatus.COMPLETED else None
        
        query = """
            UPDATE payments 
            SET status = $2, stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
                stripe_session_id = COALESCE($4, stripe_session_id),
                completed_at = COALESCE($5, completed_at), updated_at = $6
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, payment_id, status.value, stripe_payment_intent_id,
            stripe_session_id, completed_at, now
        )
        return self._row_to_payment(row) if row else None
    
    async def complete_payment(self, payment_id: UUID) -> Optional[Payment]:
        """Complete a payment and add generation credits."""
        async with self.pool.transaction() as conn:
            # Get payment
            row = await conn.fetchrow("SELECT * FROM payments WHERE id = $1 FOR UPDATE", payment_id)
            if not row or row["status"] != PaymentStatus.PENDING.value:
                return None
            
            now = datetime.utcnow()
            
            # Update payment status
            await conn.execute(
                "UPDATE payments SET status = $2, completed_at = $3, updated_at = $3 WHERE id = $1",
                payment_id, PaymentStatus.COMPLETED.value, now
            )
            
            # Add generation credits
            await conn.execute(
                "UPDATE users SET paid_generations_available = paid_generations_available + $2, updated_at = $3 WHERE id = $1",
                row["user_id"], row["generations_purchased"], now
            )
            
            updated_row = await conn.fetchrow("SELECT * FROM payments WHERE id = $1", payment_id)
            return self._row_to_payment(updated_row)
    
    # -------------------------
    # Generation Operations
    # -------------------------
    
    async def create_generation(
        self,
        user_id: UUID,
        workflow_id: Optional[str] = None,
        jewelry_type: Optional[JewelryType] = None,
        is_paid: bool = False,
        payment_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Generation:
        """Create a new generation record."""
        query = """
            INSERT INTO generations (user_id, workflow_id, status, jewelry_type, is_paid, 
                                    payment_id, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            RETURNING *
        """
        now = datetime.utcnow()
        jewelry_type_val = jewelry_type.value if jewelry_type else None
        row = await self.pool.fetchrow(
            query, user_id, workflow_id, GenerationStatus.PENDING.value,
            jewelry_type_val, is_paid, payment_id, metadata or {}, now
        )
        return self._row_to_generation(row)
    
    async def get_generation(self, generation_id: UUID) -> Optional[Generation]:
        """Get generation by ID."""
        query = "SELECT * FROM generations WHERE id = $1"
        row = await self.pool.fetchrow(query, generation_id)
        return self._row_to_generation(row) if row else None
    
    async def get_generation_by_workflow(self, workflow_id: str) -> Optional[Generation]:
        """Get generation by workflow ID."""
        query = "SELECT * FROM generations WHERE workflow_id = $1"
        row = await self.pool.fetchrow(query, workflow_id)
        return self._row_to_generation(row) if row else None
    
    async def get_user_generations(self, user_id: UUID, limit: int = 50) -> List[Generation]:
        """Get generations for a user."""
        query = "SELECT * FROM generations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
        rows = await self.pool.fetch(query, user_id, limit)
        return [self._row_to_generation(row) for row in rows]
    
    async def update_generation_status(
        self,
        generation_id: UUID,
        status: GenerationStatus,
        error_message: Optional[str] = None,
    ) -> Optional[Generation]:
        """Update generation status."""
        now = datetime.utcnow()
        completed_at = now if status in (GenerationStatus.COMPLETED, GenerationStatus.FAILED, GenerationStatus.CANCELLED) else None
        
        query = """
            UPDATE generations 
            SET status = $2, error_message = $3, completed_at = COALESCE($4, completed_at), updated_at = $5
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(query, generation_id, status.value, error_message, completed_at, now)
        return self._row_to_generation(row) if row else None
    
    async def link_generation_to_workflow(self, generation_id: UUID, workflow_id: str) -> None:
        """Link a generation to a Temporal workflow."""
        query = "UPDATE generations SET workflow_id = $2, status = $3, updated_at = $4 WHERE id = $1"
        await self.pool.execute(query, generation_id, workflow_id, GenerationStatus.PROCESSING.value, datetime.utcnow())
    
    # -------------------------
    # Generation Image Operations
    # -------------------------
    
    async def add_generation_image(
        self,
        generation_id: UUID,
        image_type: ImageType,
        azure_path: str,
        azure_url: Optional[str] = None,
        sequence: int = 0,
        file_size_bytes: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        fidelity_metrics: Optional[Dict[str, float]] = None,
    ) -> GenerationImage:
        """Add an image to a generation."""
        query = """
            INSERT INTO generation_images (generation_id, image_type, azure_path, azure_url, 
                                          sequence, file_size_bytes, width, height,
                                          fidelity_precision, fidelity_recall, fidelity_iou, 
                                          fidelity_growth_ratio, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        """
        metrics = fidelity_metrics or {}
        row = await self.pool.fetchrow(
            query, generation_id, image_type.value, azure_path, azure_url,
            sequence, file_size_bytes, width, height,
            metrics.get("precision"), metrics.get("recall"),
            metrics.get("iou"), metrics.get("growth_ratio"),
            datetime.utcnow()
        )
        return self._row_to_generation_image(row)
    
    async def get_generation_images(self, generation_id: UUID) -> List[GenerationImage]:
        """Get all images for a generation."""
        query = "SELECT * FROM generation_images WHERE generation_id = $1 ORDER BY sequence"
        rows = await self.pool.fetch(query, generation_id)
        return [self._row_to_generation_image(row) for row in rows]
    
    async def get_generation_image_by_type(
        self, generation_id: UUID, image_type: ImageType
    ) -> Optional[GenerationImage]:
        """Get a specific image type from a generation."""
        query = "SELECT * FROM generation_images WHERE generation_id = $1 AND image_type = $2 LIMIT 1"
        row = await self.pool.fetchrow(query, generation_id, image_type.value)
        return self._row_to_generation_image(row) if row else None
    
    # -------------------------
    # Statistics
    # -------------------------
    
    async def get_user_stats(self, user_id: UUID) -> Dict[str, Any]:
        """Get statistics for a user."""
        stats_query = """
            SELECT 
                COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
                COUNT(*) FILTER (WHERE status = 'processing' OR status = 'pending') as pending_count,
                COUNT(*) as total_count
            FROM generations WHERE user_id = $1
        """
        stats = await self.pool.fetchrow(stats_query, user_id)
        
        credits = await self.get_remaining_generations(user_id)
        
        return {
            "generations": dict(stats) if stats else {},
            "credits": credits,
        }
    
    # -------------------------
    # Row Converters
    # -------------------------
    
    def _row_to_user(self, row) -> User:
        """Convert database row to User model."""
        return User(
            id=row["id"],
            email=row["email"],
            full_name=row.get("full_name"),
            avatar_url=row.get("avatar_url"),
            status=UserStatus(row["status"]),
            free_generations_used=row["free_generations_used"],
            free_generations_limit=row["free_generations_limit"],
            paid_generations_available=row["paid_generations_available"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            last_active_at=row.get("last_active_at"),
            deleted_at=row.get("deleted_at"),
        )
    
    def _row_to_role_assignment(self, row) -> UserRoleAssignment:
        """Convert database row to UserRoleAssignment model."""
        return UserRoleAssignment(
            id=row["id"],
            user_id=row["user_id"],
            role=UserRole(row["role"]),
            created_at=row["created_at"],
        )
    
    def _row_to_payment(self, row) -> Payment:
        """Convert database row to Payment model."""
        return Payment(
            id=row["id"],
            user_id=row["user_id"],
            amount_cents=row["amount_cents"],
            currency=row["currency"],
            generations_purchased=row["generations_purchased"],
            status=PaymentStatus(row["status"]),
            stripe_payment_intent_id=row.get("stripe_payment_intent_id"),
            stripe_session_id=row.get("stripe_session_id"),
            stripe_customer_id=row.get("stripe_customer_id"),
            metadata=row.get("metadata", {}),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed_at=row.get("completed_at"),
        )
    
    def _row_to_generation(self, row) -> Generation:
        """Convert database row to Generation model."""
        return Generation(
            id=row["id"],
            user_id=row["user_id"],
            workflow_id=row.get("workflow_id"),
            status=GenerationStatus(row["status"]),
            jewelry_type=JewelryType(row["jewelry_type"]) if row.get("jewelry_type") else None,
            prompt=row.get("prompt"),
            is_paid=row.get("is_paid", False),
            payment_id=row.get("payment_id"),
            error_message=row.get("error_message"),
            metadata=row.get("metadata", {}),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed_at=row.get("completed_at"),
        )
    
    def _row_to_generation_image(self, row) -> GenerationImage:
        """Convert database row to GenerationImage model."""
        return GenerationImage(
            id=row["id"],
            generation_id=row["generation_id"],
            image_type=ImageType(row["image_type"]),
            azure_path=row["azure_path"],
            azure_url=row.get("azure_url"),
            sequence=row.get("sequence", 0),
            file_size_bytes=row.get("file_size_bytes"),
            width=row.get("width"),
            height=row.get("height"),
            fidelity_precision=row.get("fidelity_precision"),
            fidelity_recall=row.get("fidelity_recall"),
            fidelity_iou=row.get("fidelity_iou"),
            fidelity_growth_ratio=row.get("fidelity_growth_ratio"),
            created_at=row["created_at"],
        )
