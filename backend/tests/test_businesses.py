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

ORIGIN = "http://localhost:8080"


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


def _log_in(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "password"},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200


def _delete_record(record_id: int) -> None:
    settings = Settings.from_env()

    async def delete() -> None:
        pool = await create_pool(settings)
        try:
            async with pool.acquire() as connection:
                await connection.execute("DELETE FROM businesses WHERE id = $1", record_id)
        finally:
            await pool.close()

    asyncio.run(delete())


def test_researcher_can_create_and_update_a_record(api_client: TestClient) -> None:
    marker = f"manual-{uuid.uuid4().hex[:10]}"

    unauthenticated = api_client.post(
        "/api/v1/businesses",
        json={"businessName": f"Manual Test {marker}"},
        headers={"Origin": ORIGIN},
    )
    assert unauthenticated.status_code == 401

    _log_in(api_client)

    created = api_client.post(
        "/api/v1/businesses",
        json={
            "businessName": f"Manual Test {marker}",
            "sourceYear": 1955,
            "appearanceDecade": "1950s",
            "broadIndustry": "Test Industry",
            "specificIndustry": "Testing",
            "ifClosed": True,
            "address": "1 Test Way, Gainesville, Florida",
            "postal": "32601",
            "pointX": -82.3257,
            "pointY": 29.6516,
            "socialMedia": False,
            "notes": "Created through the researcher API.",
        },
        headers={"Origin": ORIGIN},
    )
    assert created.status_code == 201
    body = created.json()
    record_id = body["id"]

    try:
        assert body["bizId"].startswith("BIZ_MANUAL_")
        assert body["businessName"] == f"Manual Test {marker}"
        assert body["sourceYear"] == 1955
        assert body["ifClosed"] is True
        assert body["socialMedia"] is False
        assert body["createdBy"] == "admin"
        assert body["updatedBy"] == "admin"
        assert body["createdAt"]
        assert body["updatedAt"]

        detail = api_client.get(f"/api/v1/businesses/{record_id}")
        assert detail.status_code == 200
        assert detail.json()["notes"] == "Created through the researcher API."

        updated = api_client.patch(
            f"/api/v1/businesses/{record_id}",
            json={
                "businessName": f"Manual Test {marker} Renamed",
                "notes": "Updated through the researcher API.",
                "ifClosed": False,
                "address": None,
            },
            headers={"Origin": ORIGIN},
        )
        assert updated.status_code == 200
        updated_body = updated.json()
        assert updated_body["businessName"] == f"Manual Test {marker} Renamed"
        assert updated_body["notes"] == "Updated through the researcher API."
        assert updated_body["ifClosed"] is False
        assert updated_body["address"] is None
        assert updated_body["sourceYear"] == 1955
        assert updated_body["bizId"] == body["bizId"]
        assert updated_body["updatedBy"] == "admin"
    finally:
        _delete_record(record_id)


def test_record_writes_reject_invalid_values_and_origins(api_client: TestClient) -> None:
    _log_in(api_client)

    invalid_year = api_client.post(
        "/api/v1/businesses",
        json={"businessName": "Bad Year", "sourceYear": 1500},
        headers={"Origin": ORIGIN},
    )
    invalid_postal = api_client.post(
        "/api/v1/businesses",
        json={"businessName": "Bad Postal", "postal": "26-01"},
        headers={"Origin": ORIGIN},
    )
    invalid_decade = api_client.post(
        "/api/v1/businesses",
        json={"businessName": "Bad Decade", "appearanceDecade": "1955"},
        headers={"Origin": ORIGIN},
    )
    untrusted_origin = api_client.post(
        "/api/v1/businesses",
        json={"businessName": "Bad Origin"},
        headers={"Origin": "https://untrusted.example"},
    )
    missing_origin = api_client.post(
        "/api/v1/businesses",
        json={"businessName": "No Origin"},
    )
    missing_record = api_client.patch(
        "/api/v1/businesses/999999999",
        json={"notes": "Nobody home"},
        headers={"Origin": ORIGIN},
    )

    assert invalid_year.status_code == 422
    assert invalid_postal.status_code == 422
    assert invalid_decade.status_code == 422
    assert untrusted_origin.status_code == 403
    assert missing_origin.status_code == 403
    assert missing_record.status_code == 404
