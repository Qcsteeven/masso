"""Parse DB tables from facts_api_db.md into ordered column labels."""

import re
from pathlib import Path

FACTS = Path(__file__).resolve().parent.parent / "facts_api_db.md"


def _type(t: str) -> str:
    t = t.strip()
    m = {"UUID": "uuid", "DATETIME": "timestamptz", "JSONB": "jsonb", "TEXT": "text", "INTEGER": "integer",
         "BOOLEAN": "boolean"}
    if t in m:
        return m[t]
    t = re.sub(r"VARCHAR\((\d+)\)", r"varchar(\1)", t)
    t = re.sub(r"NUMERIC\((\d+), (\d+)\)", r"numeric(\1,\2)", t)
    t = re.sub(r"VECTOR\((\d+)\)", r"vector(\1)", t)
    return t


def tables() -> dict[str, list[tuple[str, str, list[str], str | None]]]:
    out = {}
    for line in FACTS.read_text(encoding="utf-8").splitlines():
        m = re.match(r"- \*\*(\w+)\*\*: (.*)$", line)
        if not m:
            continue
        name, rest = m.groups()
        cols = []
        for part in rest.split("; "):
            col, spec = part.split(":", 1)
            fk = None
            mfk = re.search(r"FK→(\w+)\.(\w+)", spec)
            if mfk:
                fk = mfk.group(1)
                spec = spec.replace(mfk.group(0), "")
            flags = []
            for f in ("PK", "UQ"):
                if re.search(rf"\b{f}\b", spec):
                    flags.append(f)
                    spec = re.sub(rf"\b{f}\b", "", spec)
            cols.append((col.strip(), _type(spec), flags, fk))
        out[name] = cols
    return out


def labels(name: str) -> list[str]:
    cols = tables()[name]
    # surrogate key first, created_at last (as in the code's Base mixin), rest in model order
    ids = [c for c in cols if c[0] == "id"]
    tail = [c for c in cols if c[0] == "created_at"]
    mid = [c for c in cols if c[0] not in ("id", "created_at")]
    res = []
    for col, typ, flags, fk in ids + mid + tail:
        s = f"{col} {typ}"
        tags = []
        if "PK" in flags:
            tags.append("PK")
        if fk:
            tags.append(f"FK → {fk}")
        if "UQ" in flags:
            tags.append("UNIQUE")
        if tags:
            s += " " + ", ".join(tags)
        res.append(s)
    return res


if __name__ == "__main__":
    t = tables()
    print(len(t))
    for n in sorted(t):
        print(n, labels(n))
