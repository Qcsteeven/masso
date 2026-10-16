#!/usr/bin/env python3
"""PostToolUse hook: format the file Claude just edited.

backend/**/*.py      -> ruff format + ruff import sort (via uv)
frontend/**/*.{ts,tsx,js,jsx,css,json} -> prettier (via pnpm)
Never blocks: always exits 0, prints nothing on success.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str], cwd: Path) -> None:
    try:
        subprocess.run(cmd, cwd=cwd, timeout=45, capture_output=True, check=False)
    except (OSError, subprocess.TimeoutExpired):
        pass


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return
    file_path = (data.get("tool_input") or {}).get("file_path")
    if not file_path:
        return

    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or ".").resolve()
    path = Path(file_path).resolve()
    try:
        rel = path.relative_to(root)
    except ValueError:
        return
    if not path.is_file():
        return

    top = rel.parts[0] if rel.parts else ""
    if top == "backend" and path.suffix == ".py" and shutil.which("uv"):
        backend = root / "backend"
        run(["uv", "run", "--quiet", "ruff", "check", "--select", "I", "--fix", str(path)], backend)
        run(["uv", "run", "--quiet", "ruff", "format", str(path)], backend)
    elif top == "frontend" and path.suffix in {".ts", ".tsx", ".js", ".jsx", ".css", ".json"} and shutil.which("pnpm"):
        frontend = root / "frontend"
        if (frontend / "node_modules" / ".bin" / "prettier").exists():
            run(["pnpm", "exec", "prettier", "--write", str(path)], frontend)


if __name__ == "__main__":
    main()
    sys.exit(0)
