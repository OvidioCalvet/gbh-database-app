from __future__ import annotations

from pathlib import Path

import asyncpg
from fastapi import Request

from app.config import Settings

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
MIGRATION_LOCK_KEY = 760_218_442


async def create_pool(settings: Settings) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        min_size=1,
        max_size=10,
        command_timeout=30,
    )


async def apply_migrations(pool: asyncpg.Pool) -> None:
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    async with pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute("SELECT pg_advisory_xact_lock($1)", MIGRATION_LOCK_KEY)
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

            for migration_file in migration_files:
                applied = await connection.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)",
                    migration_file.name,
                )
                if applied:
                    continue

                await connection.execute(migration_file.read_text(encoding="utf-8"))
                await connection.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)", migration_file.name
                )


def get_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.db_pool
