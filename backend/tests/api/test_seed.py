import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.seed import seed_core
from app.users.models import Role, User

pytestmark = pytest.mark.db


async def test_seed_idempotent(db: AsyncSession) -> None:
    users = await db.scalar(select(func.count()).select_from(User))
    await seed_core(db)
    await db.commit()
    assert await db.scalar(select(func.count()).select_from(User)) == users
    assert await db.scalar(select(func.count()).select_from(Role)) == 5
