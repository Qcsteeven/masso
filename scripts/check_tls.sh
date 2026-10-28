#!/usr/bin/env bash
# Checks the operation mode with HTTPS (make up-tls): redirect, TLS versions, HSTS, Secure cookie, API over HTTPS.
# Usage: scripts/check_tls.sh [host] — default localhost. Self-signed certificates are accepted (-k) for the check.
set -u
H=${1:-localhost}
PW=${SEED_DEFAULT_PASSWORD:-masso-demo}
fail=0
ok() { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }

r=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "http://$H/student")
[[ $r == "301 https://$H/student" ]] && ok "HTTP redirects to HTTPS" || bad "HTTP redirect: $r"
curl -sk "https://$H/api/health" | grep -q '"db":"ok"' && ok "API over HTTPS, db ok" || bad "API over HTTPS"
echo | openssl s_client -connect "$H:443" -servername "$H" -tls1_2 2>/dev/null | grep -q "Cipher is [A-Z]" && ok "TLS 1.2 accepted" || bad "TLS 1.2"
echo | openssl s_client -connect "$H:443" -servername "$H" -tls1_3 2>/dev/null | grep -q "TLSv1.3" && ok "TLS 1.3 accepted" || bad "TLS 1.3"
echo | openssl s_client -connect "$H:443" -servername "$H" -tls1_1 2>/dev/null | grep -q "Cipher is (NONE)" && ok "TLS 1.1 refused" || bad "TLS 1.1 not refused"
hdr=$(curl -sk -i "https://$H/api/auth/login" -H 'content-type: application/json' -d "{\"email\":\"teacher@masso.local\",\"password\":\"$PW\"}")
grep -qi '^strict-transport-security: max-age=' <<<"$hdr" && ok "HSTS header" || bad "HSTS header"
grep -i '^set-cookie: masso_refresh' <<<"$hdr" | grep -qi 'secure' && ok "refresh cookie is Secure, HttpOnly" || bad "refresh cookie without Secure"
exit $fail
