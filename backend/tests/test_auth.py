from __future__ import annotations

import asyncio
import sqlite3
import uuid
from pathlib import Path

import asyncpg
import pytest
from fastapi.testclient import TestClient
from werkzeug.security import generate_password_hash

from app.config import Settings
from app.database import create_pool
from app.legacy_import import import_legacy_users
from app.main import create_app

ORIGIN = "http://localhost:8080"


@pytest.fixture
def auth_client() -> TestClient:
    settings = Settings.from_env()
    app = create_app(settings)
    with TestClient(app) as client:
        yield client


def test_login_restores_and_revokes_a_session(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "password"},
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    assert response.json() == {"user": {"username": "admin", "displayName": "admin"}}
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "password" not in response.text

    current_user = auth_client.get("/api/v1/auth/me")
    assert current_user.status_code == 200
    assert current_user.json()["user"]["username"] == "admin"

    logout = auth_client.post("/api/v1/auth/logout", headers={"Origin": ORIGIN})
    assert logout.status_code == 204
    assert auth_client.get("/api/v1/auth/me").status_code == 401


def test_invalid_credentials_and_untrusted_origins_are_rejected(
    auth_client: TestClient,
) -> None:
    wrong_password = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "not-the-password"},
        headers={"Origin": ORIGIN},
    )
    unknown_user = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "no-such-user", "password": "not-the-password"},
        headers={"Origin": ORIGIN},
    )
    untrusted_origin = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "password"},
        headers={"Origin": "https://untrusted.example"},
    )

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()
    assert untrusted_origin.status_code == 403


def test_legacy_sqlite_users_import_and_upgrade_password_hash(
    auth_client: TestClient, tmp_path: Path
) -> None:
    settings = Settings.from_env()
    username = f"legacy-test-{uuid.uuid4().hex[:10]}"
    password = "migrated researcher password"
    legacy_path = tmp_path / "users.db"
    legacy_db = sqlite3.connect(legacy_path)
    legacy_db.execute(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN NOT NULL DEFAULT 0
        )
        """
    )
    legacy_db.execute(
        "INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)",
        (
            100_000 + uuid.uuid4().int % 1_000_000,
            username,
            generate_password_hash(password, method="pbkdf2:sha256"),
            1,
        ),
    )
    legacy_db.commit()
    legacy_db.close()

    async def import_users() -> None:
        pool = await create_pool(settings)
        try:
            summary = await import_legacy_users(pool, legacy_path, settings)
            assert summary.imported == 1
            assert summary.skipped == 0
        finally:
            await pool.close()

    asyncio.run(import_users())

    login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
        headers={"Origin": ORIGIN},
    )
    assert login.status_code == 200
    assert login.json()["user"]["username"] == username

    async def confirm_upgrade_and_cleanup() -> None:
        pool = await create_pool(settings)
        try:
            async with pool.acquire() as connection:
                row = await connection.fetchrow(
                    "SELECT password_hash, is_admin FROM auth_users WHERE LOWER(username) = LOWER($1)",
                    username,
                )
                assert row["password_hash"].startswith("$argon2id$")
                assert row["is_admin"] is True
                await connection.execute(
                    "DELETE FROM auth_users WHERE LOWER(username) = LOWER($1)", username
                )
        finally:
            await pool.close()

    asyncio.run(confirm_upgrade_and_cleanup())
