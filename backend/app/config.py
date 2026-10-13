from __future__ import annotations

import os
from dataclasses import dataclass


def _as_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _origins_from_env(value: str | None) -> frozenset[str]:
    if not value:
        return frozenset()
    return frozenset(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())


@dataclass(frozen=True)
class Settings:
    app_env: str
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    allowed_origins: frozenset[str]
    session_cookie_name: str
    session_ttl_seconds: int
    session_cookie_secure: bool
    enable_dev_seed_user: bool
    bootstrap_admin_username: str
    bootstrap_admin_password: str

    @classmethod
    def from_env(cls) -> Settings:
        app_env = os.getenv("APP_ENV", "production").strip().lower()
        return cls(
            app_env=app_env,
            db_host=os.getenv("DB_HOST", "127.0.0.1"),
            db_port=int(os.getenv("DB_PORT", "5432")),
            db_name=os.getenv("DB_NAME", "gbh"),
            db_user=os.getenv("DB_USER", "gbh_app"),
            db_password=os.getenv("DB_PASSWORD", ""),
            allowed_origins=_origins_from_env(os.getenv("ALLOWED_ORIGINS")),
            session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "gbh_session"),
            session_ttl_seconds=int(os.getenv("SESSION_TTL_SECONDS", "28800")),
            session_cookie_secure=_as_bool(
                os.getenv("SESSION_COOKIE_SECURE"), default=app_env == "production"
            ),
            enable_dev_seed_user=_as_bool(os.getenv("ENABLE_DEV_SEED_USER"), default=False),
            bootstrap_admin_username=os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin").strip(),
            bootstrap_admin_password=os.getenv("BOOTSTRAP_ADMIN_PASSWORD", ""),
        )

    def validate(self) -> None:
        if self.app_env not in {"development", "test", "production"}:
            raise ValueError("APP_ENV must be development, test, or production.")
        if not self.db_password:
            raise ValueError("DB_PASSWORD must be set.")
        if not self.allowed_origins:
            raise ValueError("ALLOWED_ORIGINS must contain the frontend origin.")
        if not 300 <= self.session_ttl_seconds <= 60 * 60 * 24 * 30:
            raise ValueError("SESSION_TTL_SECONDS must be between five minutes and thirty days.")
        if self.app_env == "production" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be enabled in production.")
        if self.enable_dev_seed_user and self.app_env != "development":
            raise ValueError("The bootstrap test account can only be enabled in development.")
        if self.app_env != "development" and self.bootstrap_admin_password:
            raise ValueError("A bootstrap admin password must not be configured outside development.")
        if self.enable_dev_seed_user and not self.bootstrap_admin_password:
            raise ValueError("Set BOOTSTRAP_ADMIN_PASSWORD when enabling the dev test account.")
