"""Admin HTML pages router for FastAPI."""
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from uuid import UUID

from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

logger = logging.getLogger(__name__)

# Templates directory
TEMPLATES_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

router = APIRouter(prefix="/admin", tags=["admin"])


# -------------------------
# Mock Data (replace with real DB queries)
# -------------------------

def get_mock_auth_logs(
    event_type: Optional[str] = None,
    email: Optional[str] = None,
    time_range: str = "24h",
    page: int = 1,
    per_page: int = 50,
) -> tuple[List[Dict[str, Any]], int]:
    """Get mock auth logs - replace with real DB query."""
    # This would be replaced with actual database queries
    mock_logs = [
        {
            "id": "log-001",
            "timestamp": datetime.utcnow() - timedelta(minutes=5),
            "event_type": "login",
            "email": "user1@example.com",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "provider": "google",
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "success": True,
        },
        {
            "id": "log-002",
            "timestamp": datetime.utcnow() - timedelta(minutes=15),
            "event_type": "register",
            "email": "newuser@example.com",
            "user_id": "550e8400-e29b-41d4-a716-446655440002",
            "provider": "google",
            "ip_address": "10.0.0.50",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "success": True,
        },
        {
            "id": "log-003",
            "timestamp": datetime.utcnow() - timedelta(hours=1),
            "event_type": "failed",
            "email": "hacker@badsite.com",
            "user_id": None,
            "provider": "email",
            "ip_address": "45.33.32.156",
            "user_agent": "curl/7.68.0",
            "success": False,
        },
    ]
    
    # Filter by event type
    if event_type:
        mock_logs = [l for l in mock_logs if l["event_type"] == event_type]
    
    # Filter by email
    if email:
        mock_logs = [l for l in mock_logs if email.lower() in (l.get("email") or "").lower()]
    
    return mock_logs, 1  # logs, total_pages


def get_mock_auth_stats() -> Dict[str, int]:
    """Get mock auth statistics."""
    return {
        "logins_24h": 47,
        "registrations_24h": 8,
        "failed_24h": 3,
        "active_sessions": 23,
    }


def get_mock_batches(
    status: Optional[str] = None,
    category: Optional[str] = None,
    email: Optional[str] = None,
    flagged: bool = False,
    page: int = 1,
    per_page: int = 50,
) -> tuple[List[Dict[str, Any]], int]:
    """Get mock batches - replace with real DB query."""
    mock_batches = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440010",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "user_email": "client@jewelry.com",
            "tenant_id": "tenant-001",
            "jewelry_category": "necklace",
            "skin_tone": "medium",
            "gender": "female",
            "status": "processing",
            "total_images": 8,
            "completed_images": 3,
            "failed_images": 0,
            "flagged_count": 1,
            "is_free_batch": True,
            "credits_charged": 0,
            "created_at": datetime.utcnow() - timedelta(hours=2),
            "processing_started_at": datetime.utcnow() - timedelta(hours=1, minutes=45),
            "estimated_completion_at": datetime.utcnow() + timedelta(minutes=30),
            "completed_at": None,
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440011",
            "user_id": "550e8400-e29b-41d4-a716-446655440002",
            "user_email": "photographer@studio.com",
            "tenant_id": "tenant-002",
            "jewelry_category": "earring",
            "skin_tone": "light",
            "gender": "female",
            "status": "completed",
            "total_images": 5,
            "completed_images": 5,
            "failed_images": 0,
            "flagged_count": 0,
            "is_free_batch": False,
            "credits_charged": 5,
            "created_at": datetime.utcnow() - timedelta(days=1),
            "processing_started_at": datetime.utcnow() - timedelta(days=1) + timedelta(minutes=5),
            "estimated_completion_at": datetime.utcnow() - timedelta(hours=22),
            "completed_at": datetime.utcnow() - timedelta(hours=23),
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440012",
            "user_id": "550e8400-e29b-41d4-a716-446655440003",
            "user_email": "designer@brand.com",
            "tenant_id": "tenant-003",
            "jewelry_category": "ring",
            "skin_tone": "dark",
            "gender": "male",
            "status": "pending",
            "total_images": 10,
            "completed_images": 0,
            "failed_images": 0,
            "flagged_count": 2,
            "is_free_batch": False,
            "credits_charged": 10,
            "created_at": datetime.utcnow() - timedelta(minutes=30),
            "processing_started_at": None,
            "estimated_completion_at": None,
            "completed_at": None,
        },
    ]
    
    # Apply filters
    if status:
        mock_batches = [b for b in mock_batches if b["status"] == status]
    if category:
        mock_batches = [b for b in mock_batches if b["jewelry_category"] == category]
    if email:
        mock_batches = [b for b in mock_batches if email.lower() in (b.get("user_email") or "").lower()]
    if flagged:
        mock_batches = [b for b in mock_batches if b["flagged_count"] > 0]
    
    return mock_batches, 1  # batches, total_pages


def get_mock_batch_stats() -> Dict[str, int]:
    """Get mock batch statistics."""
    return {
        "total": 156,
        "pending": 12,
        "processing": 8,
        "completed": 130,
        "failed": 6,
    }


def get_mock_batch_detail(batch_id: str) -> Optional[Dict[str, Any]]:
    """Get mock batch detail."""
    return {
        "id": batch_id,
        "user_id": "550e8400-e29b-41d4-a716-446655440001",
        "user_email": "client@jewelry.com",
        "tenant_id": "tenant-001",
        "jewelry_category": "necklace",
        "skin_tone": "medium",
        "gender": "female",
        "status": "processing",
        "total_images": 8,
        "completed_images": 3,
        "failed_images": 0,
        "is_free_batch": True,
        "credits_charged": 0,
        "error_message": None,
        "progress_percentage": 37.5,
        "created_at": datetime.utcnow() - timedelta(hours=2),
        "processing_started_at": datetime.utcnow() - timedelta(hours=1, minutes=45),
        "estimated_completion_at": datetime.utcnow() + timedelta(minutes=30),
        "completed_at": None,
    }


def get_mock_batch_images(batch_id: str) -> List[Dict[str, Any]]:
    """Get mock batch images."""
    return [
        {
            "id": "img-001",
            "sequence": 1,
            "original_azure_uri": f"azure://jewelry-uploads/{batch_id}/original_1.jpg",
            "original_sas_url": "https://example.blob.core.windows.net/original_1.jpg?sas=token",
            "result_azure_uri": f"azure://jewelry-uploads/{batch_id}/result_1.jpg",
            "result_sas_url": "https://example.blob.core.windows.net/result_1.jpg?sas=token",
            "status": "completed",
            "is_flagged": False,
            "flag_reason": None,
            "processing_time_ms": 4523,
            "workflow_id": "generate-abc123",
        },
        {
            "id": "img-002",
            "sequence": 2,
            "original_azure_uri": f"azure://jewelry-uploads/{batch_id}/original_2.jpg",
            "original_sas_url": "https://example.blob.core.windows.net/original_2.jpg?sas=token",
            "result_azure_uri": f"azure://jewelry-uploads/{batch_id}/result_2.jpg",
            "result_sas_url": "https://example.blob.core.windows.net/result_2.jpg?sas=token",
            "status": "completed",
            "is_flagged": True,
            "flag_reason": "flatlay_detected",
            "processing_time_ms": 3891,
            "workflow_id": "generate-def456",
        },
        {
            "id": "img-003",
            "sequence": 3,
            "original_azure_uri": f"azure://jewelry-uploads/{batch_id}/original_3.jpg",
            "original_sas_url": None,
            "result_azure_uri": None,
            "result_sas_url": None,
            "status": "processing",
            "is_flagged": False,
            "flag_reason": None,
            "processing_time_ms": None,
            "workflow_id": "generate-ghi789",
        },
    ]


# -------------------------
# Admin Routes
# -------------------------

@router.get("", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    """Admin dashboard home page."""
    return templates.TemplateResponse("base.html", {
        "request": request,
    })


@router.get("/auth-logs", response_class=HTMLResponse)
async def auth_logs_page(
    request: Request,
    event_type: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    range: str = Query("24h"),
    page: int = Query(1, ge=1),
):
    """Authentication logs page."""
    filters = {
        "event_type": event_type,
        "email": email,
        "range": range,
    }
    
    logs, total_pages = get_mock_auth_logs(
        event_type=event_type,
        email=email,
        time_range=range,
        page=page,
    )
    stats = get_mock_auth_stats()
    
    # Build current query string for pagination
    query_parts = [f"{k}={v}" for k, v in filters.items() if v]
    current_query = "&".join(query_parts)
    
    return templates.TemplateResponse("auth_logs.html", {
        "request": request,
        "logs": logs,
        "stats": stats,
        "filters": filters,
        "current_page": page,
        "total_pages": total_pages,
        "current_query": current_query,
    })


@router.get("/batches", response_class=HTMLResponse)
async def batches_page(
    request: Request,
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    flagged: bool = Query(False),
    page: int = Query(1, ge=1),
):
    """Batch jobs dashboard page."""
    filters = {
        "status": status,
        "category": category,
        "email": email,
        "flagged": flagged,
    }
    
    batches, total_pages = get_mock_batches(
        status=status,
        category=category,
        email=email,
        flagged=flagged,
        page=page,
    )
    stats = get_mock_batch_stats()
    
    # Build current query string for pagination
    query_parts = [f"{k}={v}" for k, v in filters.items() if v]
    current_query = "&".join(query_parts)
    
    return templates.TemplateResponse("batches.html", {
        "request": request,
        "batches": batches,
        "stats": stats,
        "filters": filters,
        "current_page": page,
        "total_pages": total_pages,
        "current_query": current_query,
    })


@router.get("/batches/{batch_id}", response_class=HTMLResponse)
async def batch_detail_page(
    request: Request,
    batch_id: str,
):
    """Batch detail page."""
    batch = get_mock_batch_detail(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    images = get_mock_batch_images(batch_id)
    
    return templates.TemplateResponse("batch_detail.html", {
        "request": request,
        "batch": batch,
        "images": images,
    })


@router.get("/users", response_class=HTMLResponse)
async def users_page(request: Request):
    """Users management page (placeholder)."""
    return templates.TemplateResponse("base.html", {
        "request": request,
    })
