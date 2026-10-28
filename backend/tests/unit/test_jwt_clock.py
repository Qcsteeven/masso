"""WSL2 steps the wall clock back by up to ~1 s when it syncs with Windows: a token issued just before
such a step has `iat` in the future and PyJWT rejected it (spurious 401 right after login)."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.auth.security import create_access_token, decode_token


def test_token_survives_small_backward_clock_step() -> None:
    import uuid

    token = create_access_token(uuid.uuid4(), ["student"], now=datetime.now(UTC) + timedelta(seconds=2))
    assert decode_token(token, "access")["typ"] == "access"


def test_token_from_the_future_is_still_rejected() -> None:
    import uuid

    token = create_access_token(uuid.uuid4(), ["student"], now=datetime.now(UTC) + timedelta(minutes=5))
    with pytest.raises(jwt.ImmatureSignatureError):
        decode_token(token, "access")
