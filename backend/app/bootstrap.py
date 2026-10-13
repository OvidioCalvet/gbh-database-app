from __future__ import annotations

import asyncpg

from app.config import Settings
from app.passwords import hash_password


async def ensure_development_admin(pool: asyncpg.Pool, settings: Settings) -> None:
    if not settings.enable_dev_seed_user:
        return

    password_hash = await hash_password(settings.bootstrap_admin_password)
    async with pool.acquire() as connection:
        await connection.execute(
            """
            INSERT INTO auth_users (username, password_hash, is_admin)
            VALUES ($1, $2, TRUE)
            ON CONFLICT DO NOTHING
            """,
            settings.bootstrap_admin_username,
            password_hash,
        )
