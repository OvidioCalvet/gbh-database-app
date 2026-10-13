from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from starlette.concurrency import run_in_threadpool
from werkzeug.security import check_password_hash

password_hasher = PasswordHasher()
_dummy_password_hash = password_hasher.hash("not-a-real-user-password")


async def hash_password(password: str) -> str:
    return await run_in_threadpool(password_hasher.hash, password)


async def verify_password(stored_hash: str, password: str) -> tuple[bool, str | None]:
    """Verify Argon2id or a legacy Werkzeug hash and return an optional upgraded hash."""
    if stored_hash.startswith(("pbkdf2:", "scrypt:")):
        try:
            verified = await run_in_threadpool(check_password_hash, stored_hash, password)
        except (TypeError, ValueError):
            return False, None
        return (True, await hash_password(password)) if verified else (False, None)

    try:
        verified = await run_in_threadpool(password_hasher.verify, stored_hash, password)
    except (VerificationError, ValueError):
        return False, None

    if verified and password_hasher.check_needs_rehash(stored_hash):
        return True, await hash_password(password)
    return verified, None


async def verify_unknown_user(password: str) -> None:
    """Spend a normal password-verification cost when the username does not exist."""
    try:
        await run_in_threadpool(password_hasher.verify, _dummy_password_hash, password)
    except (VerificationError, ValueError):
        pass
