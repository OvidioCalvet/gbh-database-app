from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

import asyncpg

from app.config import Settings


@dataclass(frozen=True)
class ImportSummary:
    imported: int
    linked_to_dev_admin: int
    skipped: int


def _read_legacy_users(source: Path) -> list[tuple[int, str, str, bool]]:
    if not source.is_file():
        raise FileNotFoundError(f"Legacy user database does not exist: {source}")

    connection = sqlite3.connect(f"{source.resolve().as_uri()}?mode=ro", uri=True)
    try:
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        if "users" not in tables:
            raise ValueError("The legacy SQLite file does not contain a users table.")

        columns = {row[1] for row in connection.execute('PRAGMA table_info("users")')}
        required = {"id", "username", "password_hash", "is_admin"}
        if not required.issubset(columns):
            missing = ", ".join(sorted(required - columns))
            raise ValueError(f"The legacy users table is missing required columns: {missing}")

        rows = connection.execute(
            "SELECT id, username, password_hash, is_admin FROM users ORDER BY id"
        ).fetchall()
        return [
            (int(user_id), str(username or "").strip(), str(password_hash or ""), bool(is_admin))
            for user_id, username, password_hash, is_admin in rows
        ]
    finally:
        connection.close()


async def import_legacy_users(
    pool: asyncpg.Pool,
    source: Path,
    settings: Settings,
) -> ImportSummary:
    """Import the old SQLite accounts, preserving their password hashes and admin flags."""
    rows = _read_legacy_users(source)
    imported = 0
    linked_to_dev_admin = 0
    skipped = 0

    async with pool.acquire() as connection:
        async with connection.transaction():
            for legacy_id, username, password_hash, is_admin in rows:
                if not username or not password_hash:
                    skipped += 1
                    continue

                inserted = await connection.fetchrow(
                    """
                    INSERT INTO auth_users (username, password_hash, is_admin, legacy_user_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT DO NOTHING
                    RETURNING user_id
                    """,
                    username,
                    password_hash,
                    is_admin,
                    legacy_id,
                )
                if inserted is not None:
                    imported += 1
                    continue

                is_dev_bootstrap_collision = (
                    settings.app_env == "development"
                    and settings.enable_dev_seed_user
                    and username.casefold() == settings.bootstrap_admin_username.casefold()
                )
                if is_dev_bootstrap_collision:
                    linked = await connection.fetchrow(
                        """
                        UPDATE auth_users
                        SET legacy_user_id = $1, is_admin = is_admin OR $2
                        WHERE LOWER(username) = LOWER($3)
                          AND legacy_user_id IS NULL
                        RETURNING user_id
                        """,
                        legacy_id,
                        is_admin,
                        username,
                    )
                    if linked is not None:
                        linked_to_dev_admin += 1
                        continue

                skipped += 1

    return ImportSummary(
        imported=imported,
        linked_to_dev_admin=linked_to_dev_admin,
        skipped=skipped,
    )
