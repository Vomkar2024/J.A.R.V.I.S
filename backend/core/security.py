"""
core.security
=============
Defensive utilities shared across the J.A.R.V.I.S neural core.

This module centralises the primitives that touch an untrusted boundary
— allow-list validation, filesystem traversal, and outbound-error
sanitisation — so the rest of the codebase calls into a single, audited
surface. Subprocess execution itself lives in :mod:`core.sandbox`, which
selects between Docker / Windows Job Object / hardened-subprocess at
runtime and re-uses the validators here.

Public API
----------
- ``is_command_allowed(command)``    — allow-list filter for shell execution.
- ``resolve_within_sandbox(path)``   — path-traversal guard.
- ``redact(text)``                   — strips secrets from log/output strings.
"""

from __future__ import annotations

import os
import re
import shlex
from pathlib import Path
from typing import Final

# --- Sandbox configuration ----------------------------------------------------

_DEFAULT_SANDBOX: Final[Path] = Path(__file__).resolve().parents[2]
SANDBOX_ROOT: Final[Path] = Path(
    os.getenv("JARVIS_SANDBOX_ROOT") or _DEFAULT_SANDBOX
).resolve()

# --- Command allow-list -------------------------------------------------------
# An explicit allow-list is safer than a blocklist: anything unknown is denied
# by default. Each entry is the *first token* of a command line.
_ALLOWED_BINARIES: Final[frozenset[str]] = frozenset({
    "ls", "dir", "pwd", "cd", "echo", "cat", "type",
    "git", "node", "npm", "python", "pip",
    "whoami", "hostname", "date", "uptime", "uname",
    "ipconfig", "ifconfig", "ping",
    "tasklist", "ps",
    "where", "which",
})

# Shell metacharacters that enable command chaining / substitution.
_SHELL_METACHARS: Final[re.Pattern[str]] = re.compile(r"[;&|`$><\n\r]|\$\(|&&|\|\|")

# Patterns that leak secrets — used to redact log output before persistence.
_SECRET_PATTERNS: Final[tuple[re.Pattern[str], ...]] = (
    re.compile(r"gsk_[A-Za-z0-9]{20,}"),               # Groq keys
    re.compile(r"sk-[A-Za-z0-9]{20,}"),                # OpenAI / generic
    re.compile(r"(?i)(api[_-]?key|token|secret)[\"'\s:=]+([A-Za-z0-9\-_]{16,})"),
)


def is_command_allowed(command: str) -> tuple[bool, str]:
    """
    Validate a raw shell command against the J.A.R.V.I.S allow-list.

    @param command  Raw command line as proposed by the LLM tool call.
    @return         Tuple ``(allowed, reason)``. ``allowed`` is ``True`` only
                    when the command can be executed safely; ``reason``
                    explains the rejection for telemetry / logging.
    """
    if not command or not command.strip():
        return False, "empty command"

    if _SHELL_METACHARS.search(command):
        return False, "shell metacharacters are not permitted"

    try:
        tokens = shlex.split(command, posix=os.name != "nt")
    except ValueError as exc:
        return False, f"unparseable command: {exc}"

    if not tokens:
        return False, "no executable token"

    binary = Path(tokens[0]).name.lower()
    # Strip Windows extensions for comparison (e.g. python.exe -> python).
    binary = re.sub(r"\.(exe|bat|cmd|ps1)$", "", binary)

    if binary not in _ALLOWED_BINARIES:
        return False, f"binary '{binary}' is not on the allow-list"

    return True, "ok"


def resolve_within_sandbox(user_path: str) -> Path:
    """
    Resolve ``user_path`` and ensure it remains inside :data:`SANDBOX_ROOT`.

    @param user_path  A relative or absolute path supplied by an LLM tool call.
    @return           Fully-resolved :class:`pathlib.Path` inside the sandbox.
    @raises PermissionError  If the path escapes the sandbox via traversal,
                             symlinks, or absolute-path injection.
    @raises ValueError       If ``user_path`` is empty or malformed.
    """
    if not user_path or not user_path.strip():
        raise ValueError("path must not be empty")

    candidate = (SANDBOX_ROOT / user_path).resolve() if not os.path.isabs(user_path) \
        else Path(user_path).resolve()

    try:
        candidate.relative_to(SANDBOX_ROOT)
    except ValueError as exc:
        raise PermissionError(
            f"path '{user_path}' escapes the sandbox root"
        ) from exc

    return candidate


def redact(text: str) -> str:
    """
    Mask anything that looks like an API key or secret token.

    @param text  Untrusted string that may be sent to logs or to the user.
    @return      Same string with secret-shaped substrings replaced by
                 ``"***REDACTED***"``.
    """
    if not text:
        return text
    masked = text
    for pattern in _SECRET_PATTERNS:
        masked = pattern.sub("***REDACTED***", masked)
    return masked
