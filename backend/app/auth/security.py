"""Password hashing and JWT helpers."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

_hasher = PasswordHash.recommended()  # argon2id
ALGO = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password, password_hash)
    except Exception:  # malformed hash
        return False


def _encode(claims: dict[str, Any]) -> str:
    return jwt.encode(claims, get_settings().jwt_secret, algorithm=ALGO)


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    """Raises jwt.PyJWTError on invalid/expired token or wrong type."""
    claims: dict[str, Any] = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGO])
    if claims.get("typ") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return claims


def create_access_token(user_id: uuid.UUID, roles: list[str], now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    ttl = timedelta(minutes=get_settings().access_token_ttl_min)
    return _encode({"sub": str(user_id), "roles": roles, "typ": "access", "iat": now, "exp": now + ttl})


def create_ws_token(user_id: uuid.UUID, session_id: uuid.UUID, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    ttl = timedelta(seconds=get_settings().ws_token_ttl_sec)
    return _encode({"sub": str(user_id), "sid": str(session_id), "typ": "ws", "iat": now, "exp": now + ttl})


def new_refresh_token() -> tuple[str, str]:
    """Returns (plain token for cookie, sha256 hash for DB)."""
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
