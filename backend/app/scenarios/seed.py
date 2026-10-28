"""Seed scenario templates from backend/seed/templates/*.json (published, with a seed validation note)."""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.scenarios.models import ScenarioTemplate
from app.scenarios.service import _sync_skills
from app.scenarios.spec import parse_spec


def _seed_report(version: int, now: datetime) -> dict[str, Any]:
    return {
        "status": "published",
        "version": version,
        "seeded": True,
        "steps": [
            {
                "step": "seed",
                "ok": True,
                "detail": "Опубликован сидом. Каждый сгенерированный вариант проходит валидацию прогоном.",
            }
        ],
        "validated_at": now.isoformat(),
    }


async def seed_templates(db: AsyncSession, directory: Path) -> int:
    created = 0
    for f in sorted(directory.glob("*.json")):  # noqa: ASYNC240  (seed CLI, small local files)
        spec = parse_spec(json.loads(f.read_text("utf-8")))
        existing = await db.scalar(select(ScenarioTemplate).where(ScenarioTemplate.code == spec.code))
        if existing is not None:
            # a newer seed version upgrades the template; a methodist's edit bumps the version and is kept
            if spec.version > existing.version:
                existing.title, existing.version = spec.title, spec.version
                existing.spec = spec.model_dump(mode="json")
                existing.validation_report = _seed_report(spec.version, datetime.now(UTC))
                await _sync_skills(db, existing, spec)
            continue
        now = datetime.now(UTC)
        t = ScenarioTemplate(
            code=spec.code,
            domain_code=spec.domain,
            kind=spec.kind,
            title=spec.title,
            version=spec.version,
            status="published",
            spec=spec.model_dump(mode="json"),
            published_at=now,
            validation_report=_seed_report(spec.version, now),
        )
        db.add(t)
        await db.flush()
        await _sync_skills(db, t, spec)
        created += 1
    return created
