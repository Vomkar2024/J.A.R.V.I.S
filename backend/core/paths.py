"""
core.paths
==========
Single source of truth for runtime filesystem locations.

In **development** every persistent artefact (temp/, memory_db/, vault/)
lives under the repo's ``backend/`` directory — convenient for grep,
diff, and `rm -rf` resets between runs.

In **production** the backend is shipped as a PyInstaller sidecar inside
a Tauri MSI. ``__file__`` then resolves to ``sys._MEIPASS`` (a temp dir
that vanishes between launches) — useless for persistence. We detect
``sys.frozen`` and pivot to the platform-native user-data directory:

  * Windows  → ``%APPDATA%\\J.A.R.V.I.S\\``           (CSIDL_APPDATA)
  * macOS    → ``~/Library/Application Support/J.A.R.V.I.S/``
  * Linux    → ``$XDG_DATA_HOME/jarvis`` or ``~/.local/share/jarvis/``

Every module that needs a persistent path imports the constants from
here; nothing else should compute paths from ``__file__``.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Final

# ``backend/`` directory in source layout. When frozen this points into
# the PyInstaller extraction dir; never use it for *persistent* state.
_SOURCE_BACKEND_ROOT: Final[Path] = Path(__file__).resolve().parent.parent

IS_FROZEN: Final[bool] = bool(getattr(sys, "frozen", False))


def _platform_user_data_dir(app_name: str = "J.A.R.V.I.S") -> Path:
    """Return the OS-conventional per-user data directory for the app."""
    if sys.platform == "win32":
        base = os.getenv("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(base) / app_name
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / app_name
    # Linux / BSD
    base = os.getenv("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / app_name.lower()


def _resolve_data_root() -> Path:
    """
    Pick the right persistence root for the current process.

    Override with ``JARVIS_DATA_ROOT`` for tests / portable installs.
    """
    override = os.getenv("JARVIS_DATA_ROOT")
    if override:
        return Path(override).expanduser().resolve()
    if IS_FROZEN:
        return _platform_user_data_dir()
    return _SOURCE_BACKEND_ROOT


DATA_ROOT: Final[Path] = _resolve_data_root()

# In source/dev mode the historical layout split temp + memory_db under
# ``backend/`` while vault + .sandbox_run lived at the repo root. We keep
# that layout to avoid disturbing existing data on developers' machines.
# Frozen builds collapse everything under DATA_ROOT (APPDATA on Windows).
_REPO_ROOT: Final[Path] = _SOURCE_BACKEND_ROOT.parent

if IS_FROZEN or os.getenv("JARVIS_DATA_ROOT"):
    _BACKEND_DATA = DATA_ROOT
    _REPO_DATA = DATA_ROOT
else:
    _BACKEND_DATA = _SOURCE_BACKEND_ROOT
    _REPO_DATA = _REPO_ROOT

TEMP_DIR: Final[Path] = _BACKEND_DATA / "temp"
MEMORY_DB_DIR: Final[Path] = _BACKEND_DATA / "memory_db"
VAULT_DIR: Final[Path] = _REPO_DATA / "vault"
SANDBOX_RUN_DIR: Final[Path] = _REPO_DATA / ".sandbox_run"

# The Vosk STT model is bundled with the binary (or sits under
# ``backend/model/`` in source mode). It's READ-ONLY, so resolving from
# the source/extraction dir is fine even when frozen.
if IS_FROZEN:
    VOSK_MODEL_DIR: Final[Path] = Path(getattr(sys, "_MEIPASS", str(_SOURCE_BACKEND_ROOT))) / "model"
else:
    VOSK_MODEL_DIR = _SOURCE_BACKEND_ROOT / "model"


def ensure_data_root() -> Path:
    """Create the data root and all standard subdirectories. Idempotent."""
    for path in (DATA_ROOT, TEMP_DIR, MEMORY_DB_DIR, VAULT_DIR, SANDBOX_RUN_DIR):
        path.mkdir(parents=True, exist_ok=True)
    return DATA_ROOT
