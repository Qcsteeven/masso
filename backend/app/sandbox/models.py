from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SandboxProfile(Base):
    __tablename__ = "sandbox_profiles"
    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    image: Mapped[str] = mapped_column(String(255), default="")
    cpu: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1.00"))
    mem_mb: Mapped[int] = mapped_column(default=1024)
    pids_limit: Mapped[int] = mapped_column(default=128)
    storage_mb: Mapped[int] = mapped_column(default=512)
    network_policy: Mapped[str] = mapped_column(String(32), default="deny_all")
