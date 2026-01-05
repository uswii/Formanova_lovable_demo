"""Database migration utilities."""
import os
import logging
from pathlib import Path
from typing import Optional

from .connection import DatabasePool

logger = logging.getLogger(__name__)

# Path to SQL schema file
SCHEMA_FILE = Path(__file__).parent / "schema.sql"


async def run_migrations(pool: DatabasePool) -> None:
    """Run database migrations (schema.sql)."""
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Schema file not found: {SCHEMA_FILE}")
    
    schema_sql = SCHEMA_FILE.read_text()
    
    try:
        async with pool.transaction() as conn:
            await conn.execute(schema_sql)
        logger.info("✓ Database migrations completed successfully")
    except Exception as e:
        logger.error(f"✗ Migration failed: {e}")
        raise


async def reset_database(pool: DatabasePool) -> None:
    """Drop and recreate all tables. USE WITH CAUTION!"""
    drop_sql = """
        DROP TABLE IF EXISTS generation_images CASCADE;
        DROP TABLE IF EXISTS generations CASCADE;
        DROP TABLE IF EXISTS payments CASCADE;
        DROP TABLE IF EXISTS user_roles CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        
        DROP TYPE IF EXISTS image_type CASCADE;
        DROP TYPE IF EXISTS jewelry_type CASCADE;
        DROP TYPE IF EXISTS user_role CASCADE;
        DROP TYPE IF EXISTS payment_status CASCADE;
        DROP TYPE IF EXISTS generation_status CASCADE;
        DROP TYPE IF EXISTS user_status CASCADE;
        
        DROP FUNCTION IF EXISTS has_role CASCADE;
        DROP FUNCTION IF EXISTS get_remaining_generations CASCADE;
        DROP FUNCTION IF EXISTS can_user_generate CASCADE;
        DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    """
    
    try:
        async with pool.transaction() as conn:
            await conn.execute(drop_sql)
        logger.info("✓ Database reset - all tables dropped")
        
        # Re-run migrations
        await run_migrations(pool)
    except Exception as e:
        logger.error(f"✗ Database reset failed: {e}")
        raise


async def check_schema_exists(pool: DatabasePool) -> bool:
    """Check if the schema has been applied."""
    query = """
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        )
    """
    return await pool.fetchval(query)


async def get_table_counts(pool: DatabasePool) -> dict:
    """Get row counts for all tables (useful for debugging)."""
    tables = ["users", "user_roles", "payments", "generations", "generation_images"]
    counts = {}
    
    for table in tables:
        try:
            count = await pool.fetchval(f"SELECT COUNT(*) FROM {table}")
            counts[table] = count
        except Exception:
            counts[table] = -1  # Table doesn't exist
    
    return counts


# CLI support
if __name__ == "__main__":
    import asyncio
    import argparse
    
    parser = argparse.ArgumentParser(description="Database migration tool")
    parser.add_argument("command", choices=["migrate", "reset", "status"], help="Command to run")
    args = parser.parse_args()
    
    async def main():
        from .connection import init_database, close_database
        
        pool = await init_database()
        
        try:
            if args.command == "migrate":
                await run_migrations(pool)
            elif args.command == "reset":
                confirm = input("This will DELETE ALL DATA. Type 'yes' to confirm: ")
                if confirm.lower() == "yes":
                    await reset_database(pool)
                else:
                    print("Aborted.")
            elif args.command == "status":
                exists = await check_schema_exists(pool)
                print(f"Schema exists: {exists}")
                if exists:
                    counts = await get_table_counts(pool)
                    print("Table counts:")
                    for table, count in counts.items():
                        print(f"  {table}: {count}")
        finally:
            await close_database()
    
    asyncio.run(main())
