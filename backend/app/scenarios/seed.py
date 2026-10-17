"""Seed scenario templates from backend/seed/templates/*.json (published, with a seed validation note)."""

import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.scenarios.models import ScenarioTemplate
from app.scenarios.service import _sync_skills
from app.scenarios.spec import parse_spec


async def seed_templates(db: AsyncSession, directory: Path) -> int:
    created = 0
    for f in sorted(directory.glob("*.json")):  # noqa: ASYNC240  (seed CLI, small local files)
        spec = parse_spec(json.loads(f.read_text("utf-8")))
        if await db.scalar(select(ScenarioTemplate.id).where(ScenarioTemplate.code == spec.code)):
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
            validation_report={
                "status": "published",
                "version": spec.version,
                "seeded": True,
                "steps": [
                    {
                        "step": "seed",
                        "ok": True,
                        "detail": "Опубликован сидом. Каждый сгенерированный вариант проходит валидацию прогоном.",
                    }
                ],
                "validated_at": now.isoformat(),
            },
        )
        db.add(t)
        await db.flush()
        await _sync_skills(db, t, spec)
        created += 1
    return created
