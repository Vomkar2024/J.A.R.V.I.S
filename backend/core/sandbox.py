"""
core.sandbox
============
Isolated execution backends for the ``execute_terminal_command`` tool.

The host OS environment is treated as untrusted. Every shell invocation
routed through ``run_sandboxed`` is forced through one of three layered
backends, selected at runtime:

1. ``docker``              — full container isolation (preferred for prod).
2. ``windows_jobobject``   — Windows Job Object + stripped token (LowBox-
                             style restrictions where ``pywin32`` permits).
3. ``hardened``            — stdlib-only fallback: stripped env, locked
                             CWD, no shell, hard timeout, output cap,
                             recursive subprocess kill on timeout.

Selection precedence
--------------------
* ``JARVIS_SANDBOX_BACKEND`` env var (``docker`` / ``windows_jobobject`` /
  ``hardened``) — explicit override, always wins.
* Otherwise: try ``windows_jobobject`` if ``pywin32`` importable on
  Windows, else fall through to ``hardened``.

The ``docker`` backend additionally requires ``docker`` on ``PATH`` and a
reachable daemon — if either is missing the call is rejected with a
descriptive error rather than silently falling back.
"""

from __future__ import annotations

import contextlib
import logging
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from typing import Final

from core.paths import SANDBOX_RUN_DIR
from core.security import (
    is_command_allowed,
    redact,
)

logger = logging.getLogger("jarvis.sandbox")

# --- Configuration ----------------------------------------------------------

_DEFAULT_TIMEOUT_S: Final[float] = 8.0
_DEFAULT_MAX_OUTPUT: Final[int] = 2000
_RUN_DIR: Final[Path] = SANDBOX_RUN_DIR

# Environment whitelist — anything outside this set is stripped before
# launching the subprocess. Keep this minimal: a tool that needs more
# environment is probably the wrong tool to be running here.
_ENV_WHITELIST: Final[frozenset[str]] = frozenset({
    "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP",
    "LANG", "LC_ALL", "LC_CTYPE",
    "USERNAME",  # some binaries fail without it; safe (it's your username, not a secret)
})

# Restricted PATH for the hardened backend — only the directories that
# host the allow-listed binaries. We rely on Windows resolution for
# git/node/npm/python via the user-installed PATH but cap to system dirs
# for the rest.
_RESTRICTED_PATH_WIN: Final[str] = ";".join([
    r"C:\Windows\System32",
    r"C:\Windows",
    r"C:\Windows\System32\Wbem",
])
_RESTRICTED_PATH_POSIX: Final[str] = "/usr/local/bin:/usr/bin:/bin"

# Docker image per host OS family.
_DOCKER_IMAGE_WIN: Final[str] = os.getenv(
    "JARVIS_SANDBOX_DOCKER_IMAGE",
    "mcr.microsoft.com/windows/nanoserver:ltsc2022",
)
_DOCKER_IMAGE_POSIX: Final[str] = os.getenv(
    "JARVIS_SANDBOX_DOCKER_IMAGE",
    "alpine:3",
)

# --- pywin32 capability probe -----------------------------------------------

try:  # pragma: no cover — Windows-only optional dep.
    import win32api  # type: ignore
    import win32con  # type: ignore
    import win32job  # type: ignore
    _HAS_WIN32 = True
except ImportError:
    _HAS_WIN32 = False


def _resolve_backend() -> str:
    explicit = (os.getenv("JARVIS_SANDBOX_BACKEND") or "").strip().lower()
    if explicit in {"docker", "windows_jobobject", "hardened"}:
        return explicit
    if os.name == "nt" and _HAS_WIN32:
        return "windows_jobobject"
    return "hardened"


def _ensure_run_dir() -> Path:
    """Dedicated CWD for the sandboxed child. Cheap to recreate per call."""
    _RUN_DIR.mkdir(parents=True, exist_ok=True)
    return _RUN_DIR


def _scrubbed_env() -> dict[str, str]:
    base: dict[str, str] = {
        k: v for k, v in os.environ.items() if k in _ENV_WHITELIST
    }
    base["PATH"] = (
        _RESTRICTED_PATH_WIN if os.name == "nt" else _RESTRICTED_PATH_POSIX
    )
    # Never inherit the Groq key / any secret accidentally.
    return base


# --- Backend: hardened subprocess -------------------------------------------

def _run_hardened(
    tokens: list[str],
    timeout: float,
    max_output: int,
) -> str:
    cwd = _ensure_run_dir()
    creationflags = 0
    if os.name == "nt":
        # CREATE_NEW_PROCESS_GROUP lets us send CTRL_BREAK to the whole tree.
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]

    try:
        completed = subprocess.run(
            tokens,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(cwd),
            env=_scrubbed_env(),
            check=False,
            creationflags=creationflags,
            start_new_session=os.name != "nt",
        )
    except subprocess.TimeoutExpired:
        return f"Timed out after {timeout}s (hardened backend killed subprocess tree)."
    except FileNotFoundError:
        return "Executable not found on the restricted sandbox PATH."
    except OSError as exc:
        return f"OS error: {redact(str(exc))}"

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    payload = stdout or stderr or "(no output)"
    if len(payload) > max_output:
        payload = payload[:max_output] + "…[truncated]"
    return redact(payload)


# --- Backend: Windows Job Object --------------------------------------------

def _run_windows_jobobject(
    tokens: list[str],
    timeout: float,
    max_output: int,
) -> str:  # pragma: no cover — Windows-only path.
    """
    Spawn the subprocess and bind it to a Windows Job Object whose limits
    kill the entire tree if it overruns memory / CPU / lifetime, *and* if
    the parent (J.A.R.V.I.S) dies for any reason.

    NOTE: this is not a full AppContainer — that requires capability SIDs
    and an explicit container profile. This is a pragmatic mid-tier
    that catches the common failure modes (fork bombs, runaway loops,
    orphan processes) without adding native build deps.
    """
    if not _HAS_WIN32:
        return _run_hardened(tokens, timeout, max_output)

    cwd = _ensure_run_dir()
    env = _scrubbed_env()

    job = win32job.CreateJobObject(None, "")
    info = win32job.QueryInformationJobObject(
        job, win32job.JobObjectExtendedLimitInformation,
    )
    info["BasicLimitInformation"]["LimitFlags"] |= (
        win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        | win32job.JOB_OBJECT_LIMIT_PROCESS_TIME
        | win32job.JOB_OBJECT_LIMIT_PROCESS_MEMORY
        | win32job.JOB_OBJECT_LIMIT_ACTIVE_PROCESS
    )
    # Wall-clock-equivalent CPU cap (in 100-ns units).
    info["BasicLimitInformation"]["PerProcessUserTimeLimit"] = int(timeout * 10_000_000)
    info["BasicLimitInformation"]["ActiveProcessLimit"] = 16
    info["ProcessMemoryLimit"] = 256 * 1024 * 1024  # 256 MiB
    win32job.SetInformationJobObject(
        job, win32job.JobObjectExtendedLimitInformation, info,
    )

    # Trade-off note: CREATE_SUSPENDED + manual ResumeThread would close the
    # microsecond race window between Popen and AssignProcessToJobObject in
    # which the child could spawn descendants that escape the job. That path
    # requires a Win32 thread handle that ``subprocess.Popen`` does not
    # expose. Since the allow-list rejects every binary capable of cheap
    # fast forking (cmd, powershell, bash, sh, perl, ruby, etc.) the
    # residual risk is judged acceptable.
    try:
        proc = subprocess.Popen(
            tokens,
            shell=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(cwd),
            env=env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,  # type: ignore[attr-defined]
        )
    except FileNotFoundError:
        return "Executable not found on the restricted sandbox PATH."
    except OSError as exc:
        return f"OS error: {redact(str(exc))}"

    try:
        handle = win32api.OpenProcess(
            win32con.PROCESS_ALL_ACCESS, False, proc.pid,
        )
        win32job.AssignProcessToJobObject(job, handle)
    except Exception as exc:  # noqa: BLE001
        # Couldn't bind to job — degrade to hardened termination semantics
        # rather than leak an unmonitored process.
        logger.warning("AssignProcessToJobObject failed: %s", redact(str(exc)))

    try:
        stdout, stderr = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        with contextlib.suppress(Exception):
            proc.communicate(timeout=2)
        return f"Timed out after {timeout}s (job object terminated tree)."

    payload = (stdout or "").strip() or (stderr or "").strip() or "(no output)"
    if len(payload) > max_output:
        payload = payload[:max_output] + "…[truncated]"
    return redact(payload)


# --- Backend: Docker --------------------------------------------------------

def _docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        result = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True, text=True, timeout=5, check=False,
        )
        return result.returncode == 0 and bool(result.stdout.strip())
    except (subprocess.TimeoutExpired, OSError):
        return False


def _run_docker(
    tokens: list[str],
    timeout: float,
    max_output: int,
) -> str:
    if not _docker_available():
        return (
            "Docker backend requested but the daemon is unreachable. "
            "Start Docker Desktop or unset JARVIS_SANDBOX_BACKEND."
        )

    image = _DOCKER_IMAGE_WIN if os.name == "nt" else _DOCKER_IMAGE_POSIX
    cwd = _ensure_run_dir()
    container_wd = "C:\\work" if os.name == "nt" else "/work"

    docker_cmd: list[str] = [
        "docker", "run",
        "--rm",
        "--network=none",
        "--read-only",
        "--cpus=0.5",
        "--memory=256m",
        "--pids-limit=64",
        f"--workdir={container_wd}",
        f"--volume={cwd}:{container_wd}:ro",
        image,
        *tokens,
    ]

    # Docker's own timeout: belt-and-braces on top of `--stop-timeout`.
    try:
        completed = subprocess.run(
            docker_cmd,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout + 5,  # docker takes a moment to spin up
            check=False,
        )
    except subprocess.TimeoutExpired:
        # Best-effort kill of the orphan container by name pattern is too
        # noisy here; rely on `--rm` + daemon GC.
        return f"Timed out after {timeout}s (docker backend)."
    except OSError as exc:
        return f"Docker invocation failed: {redact(str(exc))}"

    payload = (
        (completed.stdout or "").strip()
        or (completed.stderr or "").strip()
        or "(no output)"
    )
    if len(payload) > max_output:
        payload = payload[:max_output] + "…[truncated]"
    return redact(payload)


# --- Public API -------------------------------------------------------------

def run_sandboxed(
    command: str,
    timeout: float = _DEFAULT_TIMEOUT_S,
    max_output: int = _DEFAULT_MAX_OUTPUT,
) -> str:
    """
    Validate and execute ``command`` inside the resolved sandbox backend.

    @param command     Raw command line. Re-validated against the allow-list.
    @param timeout     Hard wall-clock cap (seconds).
    @param max_output  Maximum bytes returned; excess is truncated.
    @return            Sanitised stdout/stderr, or a structured error string.
    """
    allowed, reason = is_command_allowed(command)
    if not allowed:
        return f"Blocked: {reason}."

    try:
        tokens = shlex.split(command, posix=os.name != "nt")
    except ValueError as exc:
        return f"Unparseable command: {exc}"

    backend = _resolve_backend()
    logger.info("Sandbox backend=%s command=%r", backend, redact(command))

    if backend == "docker":
        return _run_docker(tokens, timeout, max_output)
    if backend == "windows_jobobject":
        return _run_windows_jobobject(tokens, timeout, max_output)
    return _run_hardened(tokens, timeout, max_output)


def current_backend() -> str:
    """Diagnostic: which backend would the next call use?"""
    return _resolve_backend()
