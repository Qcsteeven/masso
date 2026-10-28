"""scripts/llm_smoke.py must register every ORM model, or flushing llm_settings fails on its FK to users."""

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "llm_smoke.py"

CHECK = f"""
import importlib.util
spec = importlib.util.spec_from_file_location("llm_smoke", {str(SCRIPT)!r})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
from app.llm_gateway.models import LLMSettings
for fk in LLMSettings.__table__.foreign_keys:
    fk.column  # raises NoReferencedTableError when users is not registered
"""


def test_llm_smoke_resolves_foreign_keys() -> None:
    backend = Path(__file__).resolve().parents[2]
    res = subprocess.run([sys.executable, "-c", CHECK], cwd=backend, capture_output=True, text=True, timeout=60)
    assert res.returncode == 0, res.stderr[-1000:]
