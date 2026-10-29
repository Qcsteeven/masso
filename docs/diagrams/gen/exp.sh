#!/bin/bash
# usage: exp.sh fig12_session [fig13 ...]  — export docs/diagrams/<name>.drawio to docs/diagrams/png/<name>.png
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
args=()
for f in "$@"; do args+=("$ROOT/docs/diagrams/$f.drawio"); done
cd "$ROOT/frontend" && node "$DIR/export.mjs" "$ROOT/docs/diagrams/png" "${args[@]}"
