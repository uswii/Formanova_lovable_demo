"""Database connection management."""
import os
import logging
from contextlib import asynccontextmanager
from typing import Optional, AsyncGenerator

try:
    import asyncpg
    HAS_ASYNCPG = True
except ImportError:
    HAS_ASYNCPG = False
    asyncpg = None

logger = logging.getLogger(__name__)


class DatabaseConfig:
    """Database configuration from environment."""
    
    def __init__(self):
        self.host = os.getenv("DB_HOST", "localhost")
        self.port = int(os.getenv("DB_PORT", "5432"))
        self.database = os.getenv("DB_NAME", "formanova")
        self.user = os.getenv("DB_USER", "postgres")
        self.password = os.getenv("DB_PASSWORD", "")
        self.min_pool_size = int(os.getenv("DB_POOL_MIN", "5"))
        self.max_pool_size = int(os.getenv("DB_POOL_MAX", "20"))
        
        # Full connection URL (overrides individual settings if set)
        self.database_url = os.getenv("DATABASE_URL", None)
    
    @property
    def connection_string(self) -> str:
        """Get connection string."""
        if self.database_url:
            return self.database_url
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


class DatabasePool:
    """Async database connection pool manager."""
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self._pool: Optional["asyncpg.Pool"] = None
    
    async def connect(self) -> None:
        """Initialize the connection pool."""
        if not HAS_ASYNCPG:
            raise ImportError("asyncpg is required. Install with: pip install asyncpg")
        
        if self._pool is not None:
            return
        
        try:
            self._pool = await asyncpg.create_pool(
                self.config.connection_string,
                min_size=self.config.min_pool_size,
                max_size=self.config.max_pool_size,
            )
            logger.info(f"✓ Database pool connected to {self.config.database}")
        except Exception as e:
            logger.error(f"✗ Database connection failed: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database pool closed")
    
    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator["asyncpg.Connection", None]:
        """Acquire a connection from the pool."""
        if not self._pool:
            await self.connect()
        
        async with self._pool.acquire() as conn:
            yield conn
    
    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator["asyncpg.Connection", None]:
        """Acquire a connection with transaction."""
        async with self.acquire() as conn:
            async with conn.transaction():
                yield conn
    
    async def execute(self, query: str, *args) -> str:
        """Execute a query."""
        async with self.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> list:
        """Fetch all rows."""
        async with self.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args) -> Optional[dict]:
        """Fetch a single row."""
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args)
    
    async def fetchval(self, query: str, *args):
        """Fetch a single value."""
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args)


# Global pool instance
_db_pool: Optional[DatabasePool] = None


async def get_database() -> DatabasePool:
    """Get the global database pool."""
    global _db_pool
    if _db_pool is None:
        _db_pool = DatabasePool()
        await _db_pool.connect()
    return _db_pool


async def init_database() -> DatabasePool:
    """Initialize and return the database pool."""
    return await get_database()


async def close_database() -> None:
    """Close the database pool."""
    global _db_pool
    if _db_pool:
        await _db_pool.disconnect()
        _db_pool = None
