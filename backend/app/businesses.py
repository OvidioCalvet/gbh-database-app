from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from app.database import get_pool

router = APIRouter(prefix="/api/v1/businesses", tags=["businesses"])

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


class BusinessRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    biz_id: str = Field(alias="bizId")
    business_name: str = Field(alias="businessName")
    broad_industry: str | None = Field(default=None, alias="broadIndustry")
    specific_industry: str | None = Field(default=None, alias="specificIndustry")
    appearance_decade: str | None = Field(default=None, alias="appearanceDecade")
    source_year: int | None = Field(default=None, alias="sourceYear")
    race: str | None = None
    gender: str | None = None
    owner_name: str | None = Field(default=None, alias="ownerName")
    address: str | None = None


class BusinessPage(BaseModel):
    items: list[BusinessRecord]
    total: int
    offset: int
    limit: int


class IndustryCount(BaseModel):
    name: str
    count: int


class IndustryList(BaseModel):
    items: list[IndustryCount]


def _like_pattern(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("", response_model=BusinessPage)
async def list_businesses(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    q: str | None = Query(default=None, max_length=200),
    industry: str | None = Query(default=None, max_length=200),
    pool: asyncpg.Pool = Depends(get_pool),
) -> BusinessPage:
    conditions: list[str] = []
    parameters: list[object] = []

    query = (q or "").strip()
    if query:
        parameters.append(_like_pattern(query))
        placeholder = f"${len(parameters)}"
        searchable = ("biz_name", "owner_name", "address", "industry1", "broad_industry")
        conditions.append(
            "("
            + " OR ".join(
                f"{column} ILIKE {placeholder} ESCAPE '\\'" for column in searchable
            )
            + ")"
        )

    selected_industry = (industry or "").strip()
    if selected_industry:
        parameters.append(selected_industry)
        conditions.append(f"broad_industry = ${len(parameters)}")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    async with pool.acquire() as connection:
        total = await connection.fetchval(
            f"SELECT COUNT(*) FROM businesses {where_clause}", *parameters
        )

        parameters.extend([limit, offset])
        rows = await connection.fetch(
            f"""
            SELECT id, biz_id, biz_name, broad_industry, industry1, appearance_decade,
                   source_year, race, gender, owner_name, address
            FROM businesses
            {where_clause}
            ORDER BY id
            LIMIT ${len(parameters) - 1} OFFSET ${len(parameters)}
            """,
            *parameters,
        )

    items = [
        BusinessRecord(
            id=row["id"],
            biz_id=row["biz_id"],
            business_name=row["biz_name"],
            broad_industry=row["broad_industry"],
            specific_industry=row["industry1"],
            appearance_decade=row["appearance_decade"],
            source_year=row["source_year"],
            race=row["race"],
            gender=row["gender"],
            owner_name=row["owner_name"],
            address=row["address"],
        )
        for row in rows
    ]

    return BusinessPage(items=items, total=total, offset=offset, limit=limit)


@router.get("/industries", response_model=IndustryList)
async def list_industries(pool: asyncpg.Pool = Depends(get_pool)) -> IndustryList:
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            """
            SELECT broad_industry AS name, COUNT(*) AS count
            FROM businesses
            WHERE broad_industry IS NOT NULL
            GROUP BY broad_industry
            ORDER BY count DESC, name ASC
            """
        )

    return IndustryList(
        items=[IndustryCount(name=row["name"], count=row["count"]) for row in rows]
    )
