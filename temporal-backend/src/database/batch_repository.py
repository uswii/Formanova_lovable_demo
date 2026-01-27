"""Database repository for batch job operations."""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from .connection import DatabasePool
from .batch_models import (
    BatchJob, BatchImage, UserBatchCredits,
    BatchStatus, SkinTone, ModelGender, JewelryCategory,
)

logger = logging.getLogger(__name__)


class BatchRepository:
    """Repository for batch job database operations."""
    
    def __init__(self, pool: DatabasePool):
        self.pool = pool
    
    # -------------------------
    # Batch Job Operations
    # -------------------------
    
    async def create_batch_job(
        self,
        user_id: UUID,
        tenant_id: str,
        jewelry_category: JewelryCategory,
        total_images: int,
        skin_tone: SkinTone = SkinTone.MEDIUM,
        gender: ModelGender = ModelGender.FEMALE,
    ) -> BatchJob:
        """Create a new batch job."""
        # Check if user has free batch available
        is_free = await self.has_free_batch_available(user_id)
        
        query = """
            INSERT INTO batch_jobs (
                user_id, tenant_id, jewelry_category, skin_tone, gender,
                status, total_images, is_free_batch, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
            RETURNING *
        """
        now = datetime.utcnow()
        row = await self.pool.fetchrow(
            query, user_id, tenant_id, jewelry_category.value, skin_tone.value,
            gender.value, BatchStatus.PENDING.value, total_images, is_free, now
        )
        
        # If this is a free batch, mark it as used
        if is_free:
            await self._use_free_batch(user_id)
        
        return self._row_to_batch_job(row)
    
    async def get_batch_job(self, batch_id: UUID) -> Optional[BatchJob]:
        """Get batch job by ID."""
        query = "SELECT * FROM batch_jobs WHERE id = $1"
        row = await self.pool.fetchrow(query, batch_id)
        return self._row_to_batch_job(row) if row else None
    
    async def get_user_batch_jobs(
        self, 
        user_id: UUID, 
        limit: int = 50,
        status: Optional[BatchStatus] = None,
    ) -> List[BatchJob]:
        """Get batch jobs for a user."""
        if status:
            query = """
                SELECT * FROM batch_jobs 
                WHERE user_id = $1 AND status = $2
                ORDER BY created_at DESC LIMIT $3
            """
            rows = await self.pool.fetch(query, user_id, status.value, limit)
        else:
            query = """
                SELECT * FROM batch_jobs 
                WHERE user_id = $1 
                ORDER BY created_at DESC LIMIT $2
            """
            rows = await self.pool.fetch(query, user_id, limit)
        return [self._row_to_batch_job(row) for row in rows]
    
    async def get_pending_batch_jobs(self, limit: int = 100) -> List[BatchJob]:
        """Get pending batch jobs for processing (worker picks these up)."""
        query = """
            SELECT * FROM batch_jobs 
            WHERE status = $1
            ORDER BY created_at ASC LIMIT $2
        """
        rows = await self.pool.fetch(query, BatchStatus.PENDING.value, limit)
        return [self._row_to_batch_job(row) for row in rows]
    
    async def start_batch_processing(
        self, 
        batch_id: UUID,
        estimated_minutes: int = 60,
    ) -> Optional[BatchJob]:
        """Mark a batch as processing."""
        now = datetime.utcnow()
        estimated_completion = now + timedelta(minutes=estimated_minutes)
        
        query = """
            UPDATE batch_jobs 
            SET status = $2, processing_started_at = $3, 
                estimated_completion_at = $4, updated_at = $3
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, batch_id, BatchStatus.PROCESSING.value, 
            now, estimated_completion
        )
        return self._row_to_batch_job(row) if row else None
    
    async def update_batch_progress(
        self,
        batch_id: UUID,
        completed_images: int,
        failed_images: int = 0,
    ) -> Optional[BatchJob]:
        """Update batch progress counts."""
        query = """
            UPDATE batch_jobs 
            SET completed_images = $2, failed_images = $3, updated_at = $4
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, batch_id, completed_images, failed_images, datetime.utcnow()
        )
        return self._row_to_batch_job(row) if row else None
    
    async def complete_batch_job(
        self,
        batch_id: UUID,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> Optional[BatchJob]:
        """Mark a batch as completed or failed."""
        now = datetime.utcnow()
        status = BatchStatus.COMPLETED if success else BatchStatus.FAILED
        
        query = """
            UPDATE batch_jobs 
            SET status = $2, error_message = $3, completed_at = $4, updated_at = $4
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(query, batch_id, status.value, error_message, now)
        return self._row_to_batch_job(row) if row else None
    
    async def cancel_batch_job(self, batch_id: UUID) -> Optional[BatchJob]:
        """Cancel a pending or processing batch."""
        query = """
            UPDATE batch_jobs 
            SET status = $2, completed_at = $3, updated_at = $3
            WHERE id = $1 AND status IN ('pending', 'processing')
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, batch_id, BatchStatus.CANCELLED.value, datetime.utcnow()
        )
        return self._row_to_batch_job(row) if row else None
    
    # -------------------------
    # Batch Image Operations
    # -------------------------
    
    async def add_batch_image(
        self,
        batch_id: UUID,
        user_id: UUID,
        sequence: int,
        original_azure_uri: str,
    ) -> BatchImage:
        """Add an image to a batch."""
        query = """
            INSERT INTO batch_images (
                batch_id, user_id, sequence, original_azure_uri,
                status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $6)
            RETURNING *
        """
        now = datetime.utcnow()
        row = await self.pool.fetchrow(
            query, batch_id, user_id, sequence, original_azure_uri,
            BatchStatus.PENDING.value, now
        )
        return self._row_to_batch_image(row)
    
    async def get_batch_images(self, batch_id: UUID) -> List[BatchImage]:
        """Get all images for a batch."""
        query = "SELECT * FROM batch_images WHERE batch_id = $1 ORDER BY sequence"
        rows = await self.pool.fetch(query, batch_id)
        return [self._row_to_batch_image(row) for row in rows]
    
    async def get_batch_image(self, image_id: UUID) -> Optional[BatchImage]:
        """Get a specific batch image."""
        query = "SELECT * FROM batch_images WHERE id = $1"
        row = await self.pool.fetchrow(query, image_id)
        return self._row_to_batch_image(row) if row else None
    
    async def get_pending_batch_images(
        self, 
        batch_id: UUID,
        limit: int = 10,
    ) -> List[BatchImage]:
        """Get pending images for a batch (for worker processing)."""
        query = """
            SELECT * FROM batch_images 
            WHERE batch_id = $1 AND status = $2
            ORDER BY sequence LIMIT $3
        """
        rows = await self.pool.fetch(query, batch_id, BatchStatus.PENDING.value, limit)
        return [self._row_to_batch_image(row) for row in rows]
    
    async def start_image_processing(
        self,
        image_id: UUID,
        workflow_id: Optional[str] = None,
    ) -> Optional[BatchImage]:
        """Mark an image as processing."""
        query = """
            UPDATE batch_images 
            SET status = $2, workflow_id = $3, updated_at = $4
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, image_id, BatchStatus.PROCESSING.value, 
            workflow_id, datetime.utcnow()
        )
        return self._row_to_batch_image(row) if row else None
    
    async def complete_image_processing(
        self,
        image_id: UUID,
        result_azure_uri: str,
        mask_azure_uri: Optional[str] = None,
        thumbnail_azure_uri: Optional[str] = None,
        fidelity_metrics: Optional[Dict[str, Any]] = None,
        processing_time_ms: Optional[int] = None,
    ) -> Optional[BatchImage]:
        """Mark an image as completed with results."""
        now = datetime.utcnow()
        query = """
            UPDATE batch_images 
            SET status = $2, result_azure_uri = $3, mask_azure_uri = $4,
                thumbnail_azure_uri = $5, fidelity_metrics = $6,
                processing_time_ms = $7, completed_at = $8, updated_at = $8
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, image_id, BatchStatus.COMPLETED.value, result_azure_uri,
            mask_azure_uri, thumbnail_azure_uri, fidelity_metrics,
            processing_time_ms, now
        )
        return self._row_to_batch_image(row) if row else None
    
    async def fail_image_processing(
        self,
        image_id: UUID,
        error_message: str,
    ) -> Optional[BatchImage]:
        """Mark an image as failed."""
        now = datetime.utcnow()
        query = """
            UPDATE batch_images 
            SET status = $2, error_message = $3, completed_at = $4, updated_at = $4
            WHERE id = $1
            RETURNING *
        """
        row = await self.pool.fetchrow(
            query, image_id, BatchStatus.FAILED.value, error_message, now
        )
        return self._row_to_batch_image(row) if row else None
    
    # -------------------------
    # Free Batch Credit Operations
    # -------------------------
    
    async def has_free_batch_available(self, user_id: UUID) -> bool:
        """Check if user has free batch credits remaining."""
        query = "SELECT has_free_batch_available($1)"
        return await self.pool.fetchval(query, user_id)
    
    async def _use_free_batch(self, user_id: UUID) -> bool:
        """Use a free batch credit."""
        query = "SELECT use_free_batch($1)"
        return await self.pool.fetchval(query, user_id)
    
    async def get_user_batch_credits(self, user_id: UUID) -> UserBatchCredits:
        """Get user's batch credit status."""
        query = "SELECT * FROM user_batch_credits WHERE user_id = $1"
        row = await self.pool.fetchrow(query, user_id)
        
        if row:
            return self._row_to_user_batch_credits(row)
        
        # Return default if no record exists
        return UserBatchCredits(user_id=user_id)
    
    # -------------------------
    # Statistics
    # -------------------------
    
    async def get_batch_stats(self, user_id: UUID) -> Dict[str, Any]:
        """Get batch statistics for a user."""
        stats_query = """
            SELECT 
                COUNT(*) as total_batches,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_batches,
                COUNT(*) FILTER (WHERE status = 'processing') as processing_batches,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_batches,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_batches,
                SUM(total_images) as total_images_submitted,
                SUM(completed_images) as total_images_completed
            FROM batch_jobs WHERE user_id = $1
        """
        stats = await self.pool.fetchrow(stats_query, user_id)
        
        credits = await self.get_user_batch_credits(user_id)
        
        return {
            "batches": dict(stats) if stats else {},
            "free_batches_remaining": credits.free_batches_remaining,
            "has_free_batch": credits.has_free_batch_available,
        }
    
    # -------------------------
    # Row Converters
    # -------------------------
    
    def _row_to_batch_job(self, row) -> BatchJob:
        """Convert database row to BatchJob model."""
        return BatchJob(
            id=row["id"],
            user_id=row["user_id"],
            tenant_id=row["tenant_id"],
            jewelry_category=JewelryCategory(row["jewelry_category"]),
            skin_tone=SkinTone(row["skin_tone"]),
            gender=ModelGender(row["gender"]),
            status=BatchStatus(row["status"]),
            total_images=row["total_images"],
            completed_images=row["completed_images"],
            failed_images=row["failed_images"],
            is_free_batch=row["is_free_batch"],
            credits_charged=row["credits_charged"],
            error_message=row.get("error_message"),
            processing_started_at=row.get("processing_started_at"),
            estimated_completion_at=row.get("estimated_completion_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed_at=row.get("completed_at"),
        )
    
    def _row_to_batch_image(self, row) -> BatchImage:
        """Convert database row to BatchImage model."""
        return BatchImage(
            id=row["id"],
            batch_id=row["batch_id"],
            user_id=row["user_id"],
            sequence=row["sequence"],
            original_azure_uri=row["original_azure_uri"],
            result_azure_uri=row.get("result_azure_uri"),
            mask_azure_uri=row.get("mask_azure_uri"),
            thumbnail_azure_uri=row.get("thumbnail_azure_uri"),
            status=BatchStatus(row["status"]),
            error_message=row.get("error_message"),
            fidelity_metrics=row.get("fidelity_metrics"),
            workflow_id=row.get("workflow_id"),
            processing_time_ms=row.get("processing_time_ms"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed_at=row.get("completed_at"),
        )
    
    def _row_to_user_batch_credits(self, row) -> UserBatchCredits:
        """Convert database row to UserBatchCredits model."""
        return UserBatchCredits(
            user_id=row["user_id"],
            free_batches_used=row["free_batches_used"],
            free_batches_limit=row["free_batches_limit"],
            free_generations_in_batch=row["free_generations_in_batch"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
