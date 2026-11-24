from __future__ import annotations

import re
import uuid
from datetime import datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.auth import AuthenticatedUser, require_allowed_origin, require_current_user
from app.database import get_pool

router = APIRouter(prefix="/api/v1/businesses", tags=["businesses"])

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
YEAR_MIN = 1800
YEAR_MAX = 2100

_FIELD_TO_COLUMN = {
    "biz_id": "biz_id",
    "source_year": "source_year",
    "founding_year": "founding_year",
    "first_appearance": "first_appearance",
    "appearance_decade": "appearance_decade",
    "end_year": "end_year",
    "if_closed": "if_closed",
    "business_name": "biz_name",
    "broad_industry": "broad_industry",
    "specific_industry": "industry1",
    "race": "race",
    "gender": "gender",
    "owner_name": "owner_name",
    "ownership_type": "ownership_type",
    "ownership_demographic": "ownership_demographic",
    "address": "address",
    "postal": "postal",
    "point_x": "point_x",
    "point_y": "point_y",
    "old_address": "old_address",
    "phone_number": "phone_number",
    "website": "website",
    "social_media": "social_media",
    "facebook_url": "facebook_url",
    "instagram_url": "instagram_url",
    "youtube_url": "youtube_url",
    "x_url": "x_url",
    "linkedin_url": "linkedin_url",
    "source_id": "source_id",
    "newspaper": "newspaper",
    "city_directories": "city_directories",
    "google_modern_business": "google_modern_business",
    "link_oh_interview": "link_oh_interview",
    "link_gbh_story": "link_gbh_story",
    "notes": "notes",
}

_DETAIL_SELECT = """
    SELECT b.*, creator.username AS created_by_username, editor.username AS updated_by_username
    FROM businesses AS b
    LEFT JOIN auth_users AS creator ON creator.user_id = b.created_by
    LEFT JOIN auth_users AS editor ON editor.user_id = b.updated_by
    WHERE b.id = $1
"""


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


class BusinessDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: int
    version: int
    biz_id: str
    business_name: str
    source_year: int | None = None
    founding_year: int | None = None
    first_appearance: int | None = None
    appearance_decade: str | None = None
    end_year: int | None = None
    if_closed: bool | None = None
    broad_industry: str | None = None
    specific_industry: str | None = None
    race: str | None = None
    gender: str | None = None
    owner_name: str | None = None
    ownership_type: str | None = None
    ownership_demographic: str | None = None
    address: str | None = None
    postal: str | None = None
    point_x: float | None = None
    point_y: float | None = None
    old_address: str | None = None
    phone_number: str | None = None
    website: str | None = None
    social_media: bool | None = None
    facebook_url: str | None = None
    instagram_url: str | None = None
    youtube_url: str | None = None
    x_url: str | None = None
    linkedin_url: str | None = None
    source_id: str | None = None
    newspaper: str | None = None
    city_directories: bool | None = None
    google_modern_business: bool | None = None
    link_oh_interview: str | None = None
    link_gbh_story: str | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by: str | None = None
    updated_by: str | None = None


class BusinessFields(BaseModel):
    """Editable record fields. Aliases are camelCase for the React client."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        str_strip_whitespace=True,
    )

    biz_id: str | None = Field(default=None, max_length=128)
    business_name: str | None = Field(default=None, max_length=500)
    source_year: int | None = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
    founding_year: int | None = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
    first_appearance: int | None = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
    appearance_decade: str | None = Field(default=None, pattern=r"^[0-9]{4}s$")
    end_year: int | None = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
    if_closed: bool | None = None
    broad_industry: str | None = Field(default=None, max_length=500)
    specific_industry: str | None = Field(default=None, max_length=500)
    race: str | None = Field(default=None, max_length=200)
    gender: str | None = Field(default=None, max_length=200)
    owner_name: str | None = Field(default=None, max_length=500)
    ownership_type: str | None = Field(default=None, max_length=500)
    ownership_demographic: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=1000)
    postal: str | None = Field(default=None, pattern=r"^[0-9]{5}$")
    point_x: float | None = Field(default=None, ge=-180, le=180)
    point_y: float | None = Field(default=None, ge=-90, le=90)
    old_address: str | None = Field(default=None, max_length=1000)
    phone_number: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=2000)
    social_media: bool | None = None
    facebook_url: str | None = Field(default=None, max_length=2000)
    instagram_url: str | None = Field(default=None, max_length=2000)
    youtube_url: str | None = Field(default=None, max_length=2000)
    x_url: str | None = Field(default=None, max_length=2000)
    linkedin_url: str | None = Field(default=None, max_length=2000)
    source_id: str | None = Field(default=None, max_length=500)
    newspaper: str | None = Field(default=None, max_length=500)
    city_directories: bool | None = None
    google_modern_business: bool | None = None
    link_oh_interview: str | None = Field(default=None, max_length=2000)
    link_gbh_story: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=20000)


class BusinessCreate(BusinessFields):
    business_name: str = Field(min_length=1, max_length=500)


class BusinessUpdate(BusinessFields):
    """Partial update plus the version the client originally read."""

    expected_version: int = Field(alias="expectedVersion", ge=1)


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


def _word_pattern(value: str) -> str:
    """Whole-word regex for gender/race so "male" does not match "female"."""
    return rf"(^|[^[:alnum:]]){re.escape(value)}([^[:alnum:]]|$)"


def _clean_values(values: dict[str, object]) -> dict[str, object]:
    return {
        field: None if isinstance(value, str) and not value.strip() else value
        for field, value in values.items()
    }


def _detail_from_row(row: asyncpg.Record) -> BusinessDetail:
    return BusinessDetail(
        id=row["id"],
        version=row["version"],
        biz_id=row["biz_id"],
        business_name=row["biz_name"],
        source_year=row["source_year"],
        founding_year=row["founding_year"],
        first_appearance=row["first_appearance"],
        appearance_decade=row["appearance_decade"],
        end_year=row["end_year"],
        if_closed=row["if_closed"],
        broad_industry=row["broad_industry"],
        specific_industry=row["industry1"],
        race=row["race"],
        gender=row["gender"],
        owner_name=row["owner_name"],
        ownership_type=row["ownership_type"],
        ownership_demographic=row["ownership_demographic"],
        address=row["address"],
        postal=row["postal"],
        point_x=row["point_x"],
        point_y=row["point_y"],
        old_address=row["old_address"],
        phone_number=row["phone_number"],
        website=row["website"],
        social_media=row["social_media"],
        facebook_url=row["facebook_url"],
        instagram_url=row["instagram_url"],
        youtube_url=row["youtube_url"],
        x_url=row["x_url"],
        linkedin_url=row["linkedin_url"],
        source_id=row["source_id"],
        newspaper=row["newspaper"],
        city_directories=row["city_directories"],
        google_modern_business=row["google_modern_business"],
        link_oh_interview=row["link_oh_interview"],
        link_gbh_story=row["link_gbh_story"],
        notes=row["notes"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        created_by=row["created_by_username"],
        updated_by=row["updated_by_username"],
    )


def _generated_biz_id() -> str:
    return f"BIZ_MANUAL_{uuid.uuid4().hex[:12].upper()}"


@router.get("", response_model=BusinessPage)
async def list_businesses(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    q: str | None = Query(default=None, max_length=200),
    industry: str | None = Query(default=None, max_length=200),
    gender: str | None = Query(default=None, max_length=200),
    race: str | None = Query(default=None, max_length=200),
    pool: asyncpg.Pool = Depends(get_pool),
) -> BusinessPage:
    conditions: list[str] = []
    parameters: list[object] = []

    query = (q or "").strip()
    if query:
        parameters.append(_like_pattern(query))
        like_placeholder = f"${len(parameters)}"
        parameters.append(_word_pattern(query))
        word_placeholder = f"${len(parameters)}"
        searchable = ("biz_name", "owner_name", "address", "industry1", "broad_industry")
        text_condition = " OR ".join(
            f"{column} ILIKE {like_placeholder} ESCAPE '\\'" for column in searchable
        )
        demographic_condition = " OR ".join(
            f"{column} ~* {word_placeholder}" for column in ("gender", "race")
        )
        conditions.append(f"({text_condition} OR {demographic_condition})")

    selected_industry = (industry or "").strip()
    if selected_industry:
        parameters.append(selected_industry)
        conditions.append(f"broad_industry = ${len(parameters)}")

    selected_gender = (gender or "").strip()
    if selected_gender:
        parameters.append(selected_gender)
        conditions.append(f"LOWER(gender) = LOWER(${len(parameters)})")

    selected_race = (race or "").strip()
    if selected_race:
        parameters.append(selected_race)
        conditions.append(f"LOWER(race) = LOWER(${len(parameters)})")

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


async def _filter_values(column: str, pool: asyncpg.Pool) -> IndustryList:
    """Distinct non-null values and counts for a filter button group."""
    async with pool.acquire() as connection:
        rows = await connection.fetch(
            f"""
            SELECT {column} AS name, COUNT(*) AS count
            FROM businesses
            WHERE {column} IS NOT NULL
            GROUP BY {column}
            ORDER BY count DESC, name ASC
            """
        )

    return IndustryList(
        items=[IndustryCount(name=row["name"], count=row["count"]) for row in rows]
    )


@router.get("/industries", response_model=IndustryList)
async def list_industries(pool: asyncpg.Pool = Depends(get_pool)) -> IndustryList:
    return await _filter_values("broad_industry", pool)


@router.get("/genders", response_model=IndustryList)
async def list_genders(pool: asyncpg.Pool = Depends(get_pool)) -> IndustryList:
    return await _filter_values("gender", pool)


@router.get("/races", response_model=IndustryList)
async def list_races(pool: asyncpg.Pool = Depends(get_pool)) -> IndustryList:
    return await _filter_values("race", pool)


@router.get("/{record_id}", response_model=BusinessDetail)
async def get_business(
    record_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
) -> BusinessDetail:
    async with pool.acquire() as connection:
        row = await connection.fetchrow(_DETAIL_SELECT, record_id)

    if row is None:
        raise HTTPException(status_code=404, detail="Business record not found.")

    return _detail_from_row(row)


@router.post("", response_model=BusinessDetail, status_code=status.HTTP_201_CREATED)
async def create_business(
    body: BusinessCreate,
    request: Request,
    user: AuthenticatedUser = Depends(require_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
) -> BusinessDetail:
    require_allowed_origin(request)
    values = _clean_values(body.model_dump())
    values["biz_id"] = values["biz_id"] or _generated_biz_id()

    columns = list(_FIELD_TO_COLUMN.values()) + ["created_by", "updated_by"]
    parameters = [values.get(field) for field in _FIELD_TO_COLUMN] + [
        user.user_id,
        user.user_id,
    ]
    placeholders = ", ".join(f"${index}" for index in range(1, len(parameters) + 1))

    async with pool.acquire() as connection:
        record_id = await connection.fetchval(
            f"""
            INSERT INTO businesses ({", ".join(columns)})
            VALUES ({placeholders})
            RETURNING id
            """,
            *parameters,
        )
        row = await connection.fetchrow(_DETAIL_SELECT, record_id)

    return _detail_from_row(row)


@router.patch("/{record_id}", response_model=BusinessDetail)
async def update_business(
    record_id: int,
    body: BusinessUpdate,
    request: Request,
    user: AuthenticatedUser = Depends(require_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
) -> BusinessDetail:
    require_allowed_origin(request)
    values = _clean_values(body.model_dump(exclude_unset=True))
    expected_version = values.pop("expected_version")

    for required_field, label in (("business_name", "Business name"), ("biz_id", "Business ID")):
        if required_field in values and values[required_field] is None:
            raise HTTPException(status_code=422, detail=f"{label} cannot be empty.")

    async with pool.acquire() as connection:
        fields = [field for field in values if field in _FIELD_TO_COLUMN]
        parameters = [values[field] for field in fields]
        assignments = [
            f"{_FIELD_TO_COLUMN[field]} = ${index}"
            for index, field in enumerate(fields, start=1)
        ]
        assignments.extend(
            [
                "version = version + 1",
                "updated_at = NOW()",
                f"updated_by = ${len(parameters) + 1}",
            ]
        )
        parameters.extend([user.user_id, record_id, expected_version])

        updated_id = await connection.fetchval(
            f"""
            UPDATE businesses
            SET {", ".join(assignments)}
            WHERE id = ${len(parameters) - 1} AND version = ${len(parameters)}
            RETURNING id
            """,
            *parameters,
        )
        if updated_id is None:
            current_version = await connection.fetchval(
                "SELECT version FROM businesses WHERE id = $1", record_id
            )
            if current_version is None:
                raise HTTPException(status_code=404, detail="Business record not found.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This record was changed by someone else since you opened it. "
                    "Reload the record before saving again."
                ),
            )

        row = await connection.fetchrow(_DETAIL_SELECT, record_id)

    if row is None:
        raise HTTPException(status_code=404, detail="Business record not found.")

    return _detail_from_row(row)
