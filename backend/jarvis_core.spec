# PyInstaller spec for the J.A.R.V.I.S FastAPI sidecar binary.
#
# Build:
#     pyinstaller jarvis_core.spec --clean --noconfirm
#
# Output:
#     dist/jarvis-core.exe  (single-file)
#
# Notes:
# * `--onefile` extracts to a temp dir on every launch (~1-2s cold start).
#   Switch to `--onedir` if you prefer warm startup and ship the unpacked
#   tree under Tauri's `resources/` instead.
# * Hidden imports cover libraries PyInstaller's analyser misses because
#   they're loaded by string (ChromaDB onnxruntime, edge-tts subprocess
#   helpers, vosk's native loader, FastAPI/uvicorn worker types).

from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_submodules,
    copy_metadata,
)

block_cipher = None

hiddenimports = [
    # FastAPI / uvicorn — string-loaded worker classes & lifespan helpers
    "uvicorn",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",

    # ChromaDB — vector DB with native deps loaded by string
    "chromadb",
    "chromadb.api",
    "chromadb.config",
    "chromadb.db",
    "chromadb.telemetry",
    "onnxruntime",
    "onnxruntime.capi._pybind_state",

    # Groq / pydantic / tokenizers — sometimes missed
    "groq",
    "pydantic",
    "pydantic_core",
    "tokenizers",

    # edge-tts uses ssl/certifi at runtime
    "certifi",

    # Vosk loader resolves model paths by string
    "vosk",

    # PIL / pyautogui for screen capture
    "PIL",
    "PIL.ImageGrab",
    "pyautogui",

    # cryptography backend
    "cryptography",
    "cryptography.hazmat.backends.openssl.backend",
]

# Many packages ship their version metadata via importlib.metadata and
# PyInstaller drops it unless explicitly told to keep it.
datas = []
for pkg in ("fastapi", "starlette", "pydantic", "groq", "chromadb",
            "edge_tts", "tokenizers", "huggingface_hub", "onnxruntime"):
    try:
        datas += copy_metadata(pkg)
    except Exception:
        pass

# Data files inside packages (templates, default configs, ONNX models).
for pkg in ("chromadb", "edge_tts", "certifi"):
    try:
        datas += collect_data_files(pkg)
    except Exception:
        pass

# ChromaDB has a deep submodule graph; PyInstaller's static analysis
# misses transitive `__init__` imports.
hiddenimports += collect_submodules("chromadb")

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Strip dev-only deps from the bundle to shave ~30 MB
        "pytest",
        "mypy",
        "ruff",
        "black",
        "pyflakes",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="jarvis-core",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,         # UPX trips Windows Defender false-positives — leave off
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,      # Tauri pipes stdout/stderr to its log — keep enabled
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
