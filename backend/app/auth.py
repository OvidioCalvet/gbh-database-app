from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import Settings
from app.database import get_pool
from app.passwords import verify_password, verify_unknown_user

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip()


class PublicUser(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str
    display_name: str = Field(alias="displayName")


class UserEnvelope(BaseModel):
    user: PublicUser


class AuthenticatedUser(BaseModel):
    user_id: int
    username: str
    is_admin: bool


def _session_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _public_user(username: str) -> UserEnvelope:
    return UserEnvelope(user=PublicUser(username=username, display_name=username))


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def require_allowed_origin(request: Request) -> None:
    origin = request.headers.get("origin", "").rstrip("/")
    settings = _settings(request)
    if not origin or origin not in settings.allowed_origins:
        raise HTTPException(status_code=403, detail="Request origin is not allowed.")


async def require_current_user(
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
) -> AuthenticatedUser:
    settings = _settings(request)
    session_token = request.cookies.get(settings.session_cookie_name)
    if not session_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    token_hash = _session_digest(session_token)
    async with pool.acquire() as connection:
        row = await connection.fetchrow(
            """
            SELECT u.user_id, u.username, u.is_admin
            FROM auth_sessions AS s
            JOIN auth_users AS u ON u.user_id = s.user_id
            WHERE s.token_hash = $1
              AND s.expires_at > NOW()
              AND u.is_active = TRUE
            """,
            token_hash,
        )
        if row is None:
            await connection.execute(
                "DELETE FROM auth_sessions WHERE token_hash = $1", token_hash
            )

    if row is None:
        expired_cookie = Response()
        expired_cookie.delete_cookie(
            key=settings.session_cookie_name,
            path="/",
            secure=settings.session_cookie_secure,
            httponly=True,
            samesite="lax",
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
            headers={"Set-Cookie": expired_cookie.headers["set-cookie"]},
        )

    return AuthenticatedUser(
        user_id=row["user_id"], username=row["username"], is_admin=row["is_admin"]
    )


@router.post("/login", response_model=UserEnvelope)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    pool: asyncpg.Pool = Depends(get_pool),
) -> UserEnvelope:
    require_allowed_origin(request)
    settings = _settings(request)

    async with pool.acquire() as connection:
        account = await connection.fetchrow(
            """
            SELECT user_id, username, password_hash, is_active
            FROM auth_users
            WHERE LOWER(username) = LOWER($1)
            """,
            body.username,
        )

    if account is None:
        await verify_unknown_user(body.password)
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    verified, upgraded_hash = await verify_password(account["password_hash"], body.password)
    if not verified or not account["is_active"]:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    raw_token = secrets.token_urlsafe(32)
    token_hash = _session_digest(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds)

    async with pool.acquire() as connection:
        async with connection.transaction():
            updated_user = await connection.fetchrow(
                """
                UPDATE auth_users
                SET password_hash = COALESCE($2, password_hash), last_login_at = NOW()
                WHERE user_id = $1 AND is_active = TRUE
                RETURNING username
                """,
                account["user_id"],
                upgraded_hash,
            )
            if updated_user is None:
                raise HTTPException(status_code=401, detail="Incorrect username or password.")

            await connection.execute(
                "DELETE FROM auth_sessions WHERE expires_at <= NOW()"
            )
            await connection.execute(
                """
                INSERT INTO auth_sessions (token_hash, user_id, expires_at)
                VALUES ($1, $2, $3)
                """,
                token_hash,
                account["user_id"],
                expires_at,
            )

    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_ttl_seconds,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return _public_user(updated_user["username"])


@router.get("/me", response_model=UserEnvelope)
async def get_current_session_user(
    user: AuthenticatedUser = Depends(require_current_user),
) -> UserEnvelope:
    return _public_user(user.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
) -> Response:
    require_allowed_origin(request)
    settings = _settings(request)
    session_token = request.cookies.get(settings.session_cookie_name)

    if session_token:
        async with pool.acquire() as connection:
            await connection.execute(
                "DELETE FROM auth_sessions WHERE token_hash = $1", _session_digest(session_token)
            )

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return response
