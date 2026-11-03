from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg
from fastapi import Depends, FastAPI

from app.auth import router as auth_router
from app.bootstrap import ensure_development_admin
from app.businesses import router as businesses_router
from app.config import Settings
from app.database import apply_migrations, create_pool, get_pool


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        config.validate()
        pool = await create_pool(config)
        application.state.db_pool = pool
        try:
            await apply_migrations(pool)
            await ensure_development_admin(pool, config)
            yield
        finally:
            await pool.close()

    application = FastAPI(
        title="Gainesville Business History API",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.state.settings = config
    application.include_router(auth_router)
    application.include_router(businesses_router)

    @application.get("/healthz", tags=["health"])
    async def health_check(pool: asyncpg.Pool = Depends(get_pool)) -> dict[str, str]:
        async with pool.acquire() as connection:
            await connection.fetchval("SELECT 1")
        return {"status": "ok"}

    return application

app = create_app()
