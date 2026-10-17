"""Detectors of suspicious terminal commands and prompt injection (spec §7)."""

import re

_SUSPICIOUS: list[tuple[str, re.Pattern[str]]] = [
    ("sandbox_escape", re.compile(r"docker\.sock|/proc/1/root|\bnsenter\b|\bchroot\b|\bmount\b|/var/run/docker")),
    ("privilege_escalation", re.compile(r"(^|[;&|\s])(sudo|su|doas|pkexec)(\s|$)")),
    ("network_scan", re.compile(r"\b(nmap|masscan|zmap)\b|\bnc\s+-[a-z]*z|\bping\s+-f\b")),
    ("forbidden_file", re.compile(r"/etc/shadow|/root/|\.ssh/")),
    # writes into system directories (the rootfs is read-only anyway; the attempt is still recorded)
    (
        "forbidden_file",
        re.compile(
            r"(>>?|\btee(\s+-a)?)\s*/(etc|usr|bin|sbin|lib|boot)/"
            r"|\b(touch|rm|chmod|chown|sed\s+-i\S*)\b[^;&|]*\s/(etc|usr|bin|sbin|lib|boot)/"
            r"|\b(cp|mv|ln)\b[^;&|]*\s/(etc|usr|bin|sbin|lib|boot)/\S*\s*($|[;&|])"
        ),
    ),
]

_INJECTION = re.compile(
    r"ignore (all |the )?(previous|prior|above) instructions|system prompt|системн\w* промпт|"
    r"игнорируй (все |предыдущие )?(инструкции|указания)|ты теперь|you are now|developer mode|"
    r"покажи (свои )?инструкции|reveal (your )?(prompt|instructions)|jailbreak|dan mode",
    re.IGNORECASE,
)


def classify_command(cmd: str) -> str | None:
    for kind, pattern in _SUSPICIOUS:
        if pattern.search(cmd):
            return kind
    return None


def is_prompt_injection(text: str) -> bool:
    return bool(_INJECTION.search(text or ""))
