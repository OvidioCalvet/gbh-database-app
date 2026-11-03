from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path

import asyncpg

CSV_HEADERS = [
    "Source Year",
    "Founding Year",
    "First Appearance",
    "Appearance Decade",
    "EndYear",
    "If_Closed",
    "Biz_Name",
    "Broad_Industry",
    "Industry1",
    "Race",
    "Gender",
    "Owner_Name",
    "Ownership_Type",
    "Ownership_Demographic",
    "Address",
    "Postal",
    "POINT_X",
    "POINT_Y",
    "Old_Address",
    "Phone_Number",
    "Website",
    "Social_Media",
    "FBurl",
    "Instaurl",
    "YTurl",
    "Xurl",
    "LnkdURL",
    "Source_ID",
    "Newspaper",
    "City_Directories",
    "Google_Modern_Business",
    "Link OH Interview",
    "Link GBH Story",
    "Biz_ID",
    "Notes",
]

DB_COLUMNS = [
    "source_row",
    "source_year",
    "founding_year",
    "first_appearance",
    "appearance_decade",
    "end_year",
    "if_closed",
    "biz_name",
    "broad_industry",
    "industry1",
    "race",
    "gender",
    "owner_name",
    "ownership_type",
    "ownership_demographic",
    "address",
    "postal",
    "point_x",
    "point_y",
    "old_address",
    "phone_number",
    "website",
    "social_media",
    "facebook_url",
    "instagram_url",
    "youtube_url",
    "x_url",
    "linkedin_url",
    "source_id",
    "newspaper",
    "city_directories",
    "google_modern_business",
    "link_oh_interview",
    "link_gbh_story",
    "biz_id",
    "notes",
]

_RACE_CANONICAL = {
    "black": "Black",
    "white": "White",
    "asian": "Asian",
    "latino": "Latino",
    "latina": "Latino",
    "hispanic": "Hispanic",
    "arab": "Arab",
}

_GENDER_CANONICAL = {
    "male": "Male",
    "man": "Male",
    "female": "Female",
    "woman": "Female",
    "male/female": "Male/Female",
}

_OWNERSHIP_TYPE_CANONICAL = {
    "franchise": "Franchise",
    "family-owned": "Family-Owned",
    "family owned": "Family-Owned",
    "non-profit": "Non-Profit",
    "nonprofit": "Non-Profit",
    "cooperatively-owned": "Cooperatively-Owned",
    "cooperatively owned": "Cooperatively-Owned",
    "university affiliated": "University Affiliated",
    "small business": "Small Business",
    "women-owned": "Women-Owned",
    "female-owned": "Women-Owned",
    "privately held": "Privately Held",
    "publicly traded": "Publicly Traded",
    "municipal": "Municipal",
    "social enterprise": "Social Enterprise",
    "black-owned": "Black-Owned",
}

_OWNERSHIP_DEMOGRAPHIC_CANONICAL = {
    "women-owned": "Women-Owned",
    "female-owned": "Women-Owned",
    "black-owned": "Black-Owned",
    "latino-owned": "Latino-Owned",
    "veteran-owned": "Veteran-Owned",
    "middle eastern-owned": "Middle Eastern-Owned",
    "asian-owned": "Asian-Owned",
}

_NULL_TOKENS = {"na", "n/a", "none", "unknown", "null"}
_TRUE_TOKENS = {"1", "true", "t", "y", "yes"}
_FALSE_TOKENS = {"0", "false", "f", "n", "no"}
_YEAR_PATTERN = re.compile(r"\d{4}")
_DECADE_PATTERN = re.compile(r"\d{4}s")
_POSTAL_PATTERN = re.compile(r"\d{5}")
_URL_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)


@dataclass(frozen=True)
class ImportSummary:
    rows_read: int
    rows_imported: int
    duplicates_removed: int
    rows_skipped: int
    values_normalized: int


def _text(value: str | None) -> str | None:
    if value is None:
        return None
    text = " ".join(value.split())
    return text or None


def _year(value: str | None) -> int | None:
    text = (value or "").strip()
    if not _YEAR_PATTERN.fullmatch(text):
        return None
    year = int(text)
    return year if 1800 <= year <= 2100 else None


def _decade(value: str | None) -> str | None:
    text = (value or "").strip()
    return text if _DECADE_PATTERN.fullmatch(text) else None


def _boolean(value: str | None) -> bool | None:
    text = (value or "").strip().casefold()
    if text in _TRUE_TOKENS:
        return True
    if text in _FALSE_TOKENS:
        return False
    return None


def _postal(value: str | None) -> str | None:
    text = (value or "").strip()
    if re.fullmatch(r"\d{4}", text):
        return text.zfill(5)
    return text if _POSTAL_PATTERN.fullmatch(text) else None


def _coordinate(value: str | None, minimum: float, maximum: float) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number if minimum <= number <= maximum else None


def _race(value: str | None) -> str | None:
    text = _text(value)
    if text is None or text.casefold() in _NULL_TOKENS:
        return None
    return _RACE_CANONICAL.get(text.casefold())


def _gender(value: str | None) -> str | None:
    text = _text(value)
    if text is None or text.casefold() in _NULL_TOKENS:
        return None
    return _GENDER_CANONICAL.get(text.casefold())


def _multi_value(value: str | None, canonical: dict[str, str]) -> str | None:
    text = _text(value)
    if text is None:
        return None

    normalized: list[str] = []
    for part in text.split(","):
        token = " ".join(part.split())
        if not token or token.casefold() in _NULL_TOKENS:
            continue
        label = canonical.get(token.casefold(), token)
        if label not in normalized:
            normalized.append(label)
    return ", ".join(normalized) if normalized else None


def _url(value: str | None) -> str | None:
    text = _text(value)
    return text if text is not None and _URL_PATTERN.fullmatch(text) else None


def _clean_row(row: dict[str, str], source_row: int) -> tuple[tuple[object, ...], int]:
    normalized = 0

    def track(raw: str | None, cleaned: object) -> object:
        nonlocal normalized
        if (raw or "").strip() and cleaned is None:
            normalized += 1
        return cleaned

    record = (
        source_row,
        track(row["Source Year"], _year(row["Source Year"])),
        track(row["Founding Year"], _year(row["Founding Year"])),
        track(row["First Appearance"], _year(row["First Appearance"])),
        track(row["Appearance Decade"], _decade(row["Appearance Decade"])),
        track(row["EndYear"], _year(row["EndYear"])),
        track(row["If_Closed"], _boolean(row["If_Closed"])),
        _text(row["Biz_Name"]),
        _text(row["Broad_Industry"]),
        _text(row["Industry1"]),
        track(row["Race"], _race(row["Race"])),
        track(row["Gender"], _gender(row["Gender"])),
        _text(row["Owner_Name"]),
        track(
            row["Ownership_Type"],
            _multi_value(row["Ownership_Type"], _OWNERSHIP_TYPE_CANONICAL),
        ),
        track(
            row["Ownership_Demographic"],
            _multi_value(row["Ownership_Demographic"], _OWNERSHIP_DEMOGRAPHIC_CANONICAL),
        ),
        _text(row["Address"]),
        track(row["Postal"], _postal(row["Postal"])),
        track(row["POINT_X"], _coordinate(row["POINT_X"], -180, 180)),
        track(row["POINT_Y"], _coordinate(row["POINT_Y"], -90, 90)),
        _text(row["Old_Address"]),
        _text(row["Phone_Number"]),
        track(row["Website"], _url(row["Website"])),
        track(row["Social_Media"], _boolean(row["Social_Media"])),
        track(row["FBurl"], _url(row["FBurl"])),
        track(row["Instaurl"], _url(row["Instaurl"])),
        track(row["YTurl"], _url(row["YTurl"])),
        track(row["Xurl"], _url(row["Xurl"])),
        track(row["LnkdURL"], _url(row["LnkdURL"])),
        _text(row["Source_ID"]),
        _text(row["Newspaper"]),
        track(row["City_Directories"], _boolean(row["City_Directories"])),
        track(row["Google_Modern_Business"], _boolean(row["Google_Modern_Business"])),
        track(row["Link OH Interview"], _url(row["Link OH Interview"])),
        track(row["Link GBH Story"], _url(row["Link GBH Story"])),
        (row["Biz_ID"] or "").strip() or None,
        _text(row["Notes"]),
    )
    return record, normalized


def parse_business_csv(source: Path) -> tuple[list[tuple[object, ...]], ImportSummary]:
    if not source.is_file():
        raise FileNotFoundError(f"Business CSV does not exist: {source}")

    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        missing = [header for header in CSV_HEADERS if header not in headers]
        unexpected = [header for header in headers if header not in CSV_HEADERS]
        if missing or unexpected:
            details = []
            if missing:
                details.append(f"missing columns: {', '.join(missing)}")
            if unexpected:
                details.append(f"unexpected columns: {', '.join(unexpected)}")
            raise ValueError("The CSV columns do not match the expected schema (" + "; ".join(details) + ").")

        records: list[tuple[object, ...]] = []
        seen: set[tuple[object, ...]] = set()
        rows_read = 0
        duplicates_removed = 0
        rows_skipped = 0
        values_normalized = 0

        for source_row, row in enumerate(reader, start=2):
            rows_read += 1
            record, normalized = _clean_row(row, source_row)
            values_normalized += normalized

            biz_name = record[7]
            biz_id = record[34]
            if biz_name is None or biz_id is None:
                rows_skipped += 1
                continue

            key = record[1:]
            if key in seen:
                duplicates_removed += 1
                continue
            seen.add(key)
            records.append(record)

    return records, ImportSummary(
        rows_read=rows_read,
        rows_imported=len(records),
        duplicates_removed=duplicates_removed,
        rows_skipped=rows_skipped,
        values_normalized=values_normalized,
    )


async def import_businesses(pool: asyncpg.Pool, source: Path) -> ImportSummary:
    """Replace the business table with a cleaned copy of the CSV export."""
    records, summary = parse_business_csv(source)

    async with pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute("TRUNCATE businesses RESTART IDENTITY")
            await connection.copy_records_to_table(
                "businesses",
                records=records,
                columns=DB_COLUMNS,
            )

    return summary
