"""Database module for the Temporal backend."""
from .models import (
    UserStatus,
    GenerationStatus,
    PaymentStatus,
    UserRole,
    JewelryType,
    ImageType,
    User,
    UserRoleAssignment,
    Payment,
    Generation,
    GenerationImage,
)
from .repository import DatabaseRepository
from .connection import get_database, init_database, close_database

__all__ = [
    # Enums
    "UserStatus",
    "GenerationStatus", 
    "PaymentStatus",
    "UserRole",
    "JewelryType",
    "ImageType",
    # Models
    "User",
    "UserRoleAssignment",
    "Payment",
    "Generation",
    "GenerationImage",
    # Repository & Connection
    "DatabaseRepository",
    "get_database",
    "init_database",
    "close_database",
]
