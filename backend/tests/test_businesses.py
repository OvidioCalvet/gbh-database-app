from __future__ import annotations

import asyncio
import csv
import uuid
from pathlib import Path

import asyncpg
import pytest
from fastapi.testclient import TestClient

from app.business_import import CSV_HEADERS, parse_business_csv
from app.config import Settings
from app.database import create_pool
from app.main import create_app


def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writeheader()
        for row in rows:
            writer.writerow({header: row.get(header, "") for header in CSV_HEADERS})


def _base_row(**overrides: str) -> dict[str, str]:
    row = {header: "" for header in CSV_HEADERS}
    row.update(
        {
            "Source Year": "1903",
            "Biz_Name": "Johnson Brothers",
            "Biz_ID": "BIZ_TEST_0001",
        }
    )
    row.update(overrides)
    return row


def test_csv_import_cleans_values_and_removes_duplicates(tmp_path: Path) -> None:
    source = tmp_path / "businesses.csv"
    _write_csv(
        source,
        [
            _base_row(
                **{
                    "Biz_Name": "  Johnson \n Brothers  ",
                    "Postal": "0",
                    "First Appearance": "2000s",
                    "EndYear": "1006",
                    "Race": "NA",
                    "Gender": "Woman",
                    "Ownership_Type": "Family Owned, Privately Held",
                    "Social_Media": "Y",
                    "If_Closed": "1",
                    "POINT_X": "-82.32577241",
                    "POINT_Y": "29.65098369",
                }
            ),
            _base_row(
                **{
                    "Biz_ID": "BIZ_TEST_0002",
                    "Postal": "2609",
                    "Race": "Latina",
                    "Gender": "White",
                    "Ownership_Type": "Municipal , Non-Profit",
                    "Social_Media": "N/A",
                    "Website": "not a url",
                }
            ),
            _base_row(**{"Biz_ID": "BIZ_TEST_0003", "Postal": "32601"}),
            # Exact duplicate of the previous row (ignoring source position).
            _base_row(**{"Biz_ID": "BIZ_TEST_0003", "Postal": "32601"}),
            # Missing a business name: skipped.
            _base_row(**{"Biz_ID": "BIZ_TEST_0004", "Biz_Name": "   "}),
        ],
    )

    records, summary = parse_business_csv(source)

    assert summary.rows_read == 5
    assert summary.rows_imported == 3
    assert summary.duplicates_removed == 1
    assert summary.rows_skipped == 1
    assert summary.values_normalized >= 6

    first = records[0]
    assert first[7] == "Johnson Brothers"
    assert first[16] is None  # postal "0"
    assert first[3] is None  # "2000s" is not a year
    assert first[5] is None  # end year 1006 is out of range
    assert first[10] is None  # race "NA"
    assert first[11] == "Female"
    assert first[13] == "Family-Owned, Privately Held"
    assert first[22] is True
    assert first[6] is True
    assert first[17] == pytest.approx(-82.32577241)
    assert first[18] == pytest.approx(29.65098369)

    second = records[1]
    assert second[16] == "02609"
    assert second[10] == "Latino"
    assert second[11] is None  # "White" is not a gender
    assert second[13] == "Municipal, Non-Profit"
    assert second[22] is None  # "N/A" is unknown
    assert second[21] is None  # not a URL


def test_csv_import_rejects_a_changed_schema(tmp_path: Path) -> None:
    source = tmp_path / "businesses.csv"
    source.write_text("Biz_Name,Biz_ID\nTest,BIZ_1\n", encoding="utf-8")

    with pytest.raises(ValueError, match="do not match the expected schema"):
        parse_business_csv(source)


@pytest.fixture
def api_client() -> TestClient:
    app = create_app(Settings.from_env())
    with TestClient(app) as client:
        yield client


def test_business_api_paginates_by_offset(api_client: TestClient) -> None:
    settings = Settings.from_env()
    marker = f"pagination-{uuid.uuid4().hex[:10]}"
    total_rows = 30

    async def seed() -> None:
        pool = await create_pool(settings)
        try:
            async with pool.acquire() as connection:
                await connection.executemany(
                    """
                    INSERT INTO businesses (source_row, biz_name, biz_id)
                    VALUES ($1, $2, $3)
                    """,
                    [
                        (index, f"Test Business {marker} {index:02d}", f"BIZ_{marker}_{index:02d}")
                        for index in range(total_rows)
                    ],
                )
        finally:
            await pool.close()

    async def cleanup() -> None:
        pool = await create_pool(settings)
        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "DELETE FROM businesses WHERE biz_id LIKE $1", f"BIZ_{marker}_%"
                )
        finally:
            await pool.close()

    asyncio.run(seed())
    try:
        first_page = api_client.get(
            "/api/v1/businesses",
            params={"q": marker, "limit": 25, "offset": 0},
        )
        assert first_page.status_code == 200
        first_body = first_page.json()
        assert first_body["total"] == total_rows
        assert first_body["offset"] == 0
        assert first_body["limit"] == 25
        assert len(first_body["items"]) == 25
        assert first_body["items"][0]["businessName"] == f"Test Business {marker} 00"

        second_page = api_client.get(
            "/api/v1/businesses",
            params={"q": marker, "limit": 25, "offset": 25},
        )
        assert second_page.status_code == 200
        second_body = second_page.json()
        assert second_body["total"] == total_rows
        assert len(second_body["items"]) == 5
        assert second_body["items"][0]["businessName"] == f"Test Business {marker} 25"

        assert api_client.get("/api/v1/businesses", params={"limit": 0}).status_code == 422
        assert api_client.get("/api/v1/businesses", params={"limit": 101}).status_code == 422
    finally:
        asyncio.run(cleanup())


def test_industry_list_is_available(api_client: TestClient) -> None:
    response = api_client.get("/api/v1/businesses/industries")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["items"], list)
    for industry in body["items"]:
        assert set(industry) == {"name", "count"}
        assert industry["count"] >= 1
