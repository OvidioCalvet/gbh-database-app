from __future__ import annotations

import argparse
import asyncio
from getpass import getpass
from pathlib import Path

import asyncpg

from app.bootstrap import ensure_development_admin
from app.business_import import import_businesses
from app.config import Settings
from app.database import apply_migrations, create_pool
from app.legacy_import import import_legacy_users
from app.passwords import hash_password

MIN_PASSWORD_LENGTH = 12


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage Gainesville Business History researcher accounts.")
    commands = parser.add_subparsers(dest="command", required=True)

    create_user = commands.add_parser("create-user", help="Create a researcher account.")
    create_user.add_argument("username")
    create_user.add_argument("--admin", action="store_true", help="Grant administrative privileges.")

    reset_password = commands.add_parser("set-password", help="Set a user's password.")
    reset_password.add_argument("username")

    import_users = commands.add_parser(
        "import-legacy-users", help="Import accounts from the old SQLite users.db file."
    )
    import_users.add_argument("sqlite_path", type=Path)

    import_records = commands.add_parser(
        "import-businesses",
        help="Replace the business table from a CSV export.",
    )
    import_records.add_argument("csv_path", type=Path)

    return parser


def prompt_for_password() -> str:
    password = getpass("Password (minimum 12 characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        raise ValueError("Passwords do not match.")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError("Use a password with at least 12 characters.")
    return password


async def create_user(pool: asyncpg.Pool, username: str, password: str, is_admin: bool) -> None:
    normalized_username = username.strip()
    if not normalized_username or len(normalized_username) > 128:
        raise ValueError("Username must contain between 1 and 128 characters.")

    password_hash = await hash_password(password)
    async with pool.acquire() as connection:
        try:
            await connection.execute(
                """
                INSERT INTO auth_users (username, password_hash, is_admin)
                VALUES ($1, $2, $3)
                """,
                normalized_username,
                password_hash,
                is_admin,
            )
        except asyncpg.UniqueViolationError as error:
            raise ValueError("That username already exists.") from error


async def set_user_password(pool: asyncpg.Pool, username: str, password: str) -> None:
    password_hash = await hash_password(password)
    async with pool.acquire() as connection:
        async with connection.transaction():
            user_id = await connection.fetchval(
                """
                UPDATE auth_users
                SET password_hash = $1
                WHERE LOWER(username) = LOWER($2)
                RETURNING user_id
                """,
                password_hash,
                username.strip(),
            )
            if user_id is None:
                raise ValueError("No account exists with that username.")
            await connection.execute("DELETE FROM auth_sessions WHERE user_id = $1", user_id)


async def run_command(arguments: argparse.Namespace) -> None:
    settings = Settings.from_env()
    settings.validate()
    pool = await create_pool(settings)
    try:
        await apply_migrations(pool)
        await ensure_development_admin(pool, settings)

        if arguments.command == "create-user":
            password = prompt_for_password()
            await create_user(pool, arguments.username, password, arguments.admin)
            print("Researcher account created.")
        elif arguments.command == "set-password":
            password = prompt_for_password()
            await set_user_password(pool, arguments.username, password)
            print("Password updated.")
        elif arguments.command == "import-legacy-users":
            summary = await import_legacy_users(pool, arguments.sqlite_path, settings)
            print(
                "Legacy import complete: "
                f"{summary.imported} imported, "
                f"{summary.linked_to_dev_admin} linked to the local test admin, "
                f"{summary.skipped} skipped."
            )
        elif arguments.command == "import-businesses":
            summary = await import_businesses(pool, arguments.csv_path)
            print(
                "Business import complete: "
                f"{summary.rows_imported} of {summary.rows_read} rows imported, "
                f"{summary.duplicates_removed} duplicate rows removed, "
                f"{summary.rows_skipped} rows skipped, "
                f"{summary.values_normalized} invalid values set to NULL."
            )
    finally:
        await pool.close()


def main() -> None:
    parser = build_parser()
    arguments = parser.parse_args()
    try:
        asyncio.run(run_command(arguments))
    except (OSError, ValueError, asyncpg.PostgresError) as error:
        parser.exit(status=1, message=f"Error: {error}\n")


if __name__ == "__main__":
    main()
