#!/bin/bash
# Build a Dockerfile inside a Claude Code cloud container: injects the agent-proxy CA and proxy settings
# after every FROM. Not for local machines — there use plain `docker build` / `make up`.
# Usage: scripts/dev/cloud-build.sh <context-dir> <tag> [Dockerfile]
set -euo pipefail
ctx=$1; tag=$2; df=${3:-$ctx/Dockerfile}
proxy=${HTTPS_PROXY:-http://127.0.0.1:38299}
ca_dir=/root/.ccr
tmp=$(mktemp)
awk -v P="$proxy" '{print} /^FROM /{
  print "COPY --from=ccr ca-bundle.crt /etc/ccr-ca.crt"
  print "ENV SSL_CERT_FILE=/etc/ccr-ca.crt REQUESTS_CA_BUNDLE=/etc/ccr-ca.crt NODE_EXTRA_CA_CERTS=/etc/ccr-ca.crt https_proxy=" P " HTTPS_PROXY=" P " no_proxy=localhost,127.0.0.1"
  print "RUN if [ -d /etc/apt ]; then sed -i \"s|http://|https://|g\" /etc/apt/sources.list.d/*.sources 2>/dev/null || true; printf \"Acquire::https::Proxy \\\"" P "\\\";\\nAcquire::https::CaInfo \\\"/etc/ccr-ca.crt\\\";\\n\" > /etc/apt/apt.conf.d/99ccr; fi; if [ -f /etc/apk/repositories ]; then sed -i \"s|http://|https://|g\" /etc/apk/repositories; fi"
}' "$df" > "$tmp"
docker build --network host --build-context ccr="$ca_dir" -f "$tmp" -t "$tag" "$ctx"
rm -f "$tmp"
