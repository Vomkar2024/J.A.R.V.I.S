"""
nexus_routes
============
FastAPI router exposing the :class:`core.secure_storage.NexusSecureStorage`
zero-knowledge vault to the React HUD's ``NexusVault`` panel.

All endpoints sit under ``/api/nexus`` and accept the master password
either in JSON body (``{"password": "..."}``) or as a form field on
``/upload``. The password is never persisted server-side — it only
exists in the request scope long enough to derive the AES-256-GCM key.

Endpoint map
------------
GET  /api/nexus/status      → ``{"initialized": bool}``
POST /api/nexus/initialize  → create empty vault with master password
POST /api/nexus/files       → list files (authenticated)
POST /api/nexus/upload      → encrypt + store an uploaded file
POST /api/nexus/download    → decrypt and stream a file
POST /api/nexus/delete      → cryptographic shred + index removal
"""

from __future__ import annotations

import io
import logging
import urllib.parse
from typing import Annotated, Final

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.secure_storage import NexusSecureStorage

logger = logging.getLogger("jarvis.nexus")
router = APIRouter(prefix="/api/nexus", tags=["nexus"])

_MIN_PASSWORD: Final[int] = 6
_MAX_UPLOAD_BYTES: Final[int] = 100 * 1024 * 1024  # 100 MiB hard cap

_vault = NexusSecureStorage()


class _PasswordOnly(BaseModel):
    password: str = Field(..., min_length=_MIN_PASSWORD, max_length=512)


class _PasswordAndUuid(BaseModel):
    password: str = Field(..., min_length=_MIN_PASSWORD, max_length=512)
    uuid: str = Field(..., min_length=1, max_length=64)


@router.get("/status")
def status() -> dict:
    """Cheap probe: has the vault been initialised yet?"""
    return {"initialized": _vault.is_initialized()}


@router.post("/initialize")
def initialize(payload: _PasswordOnly) -> dict:
    """Create the encrypted index registry with a new master password."""
    try:
        _vault.initialize_vault(payload.password)
    except ValueError as exc:
        # Already initialised — refuse to clobber an existing vault.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"initialized": True}


@router.post("/files")
def list_files(payload: _PasswordOnly) -> dict:
    """Return file metadata. Doubles as the unlock check — wrong password raises 401."""
    try:
        return {"files": _vault.list_files(payload.password)}
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/upload")
async def upload(
    file: Annotated[UploadFile, File(...)],
    password: Annotated[str, Form(...)],
) -> dict:
    """Encrypt and store an uploaded file under the master password."""
    if len(password) < _MIN_PASSWORD:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {_MIN_PASSWORD} characters.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Upload exceeds {_MAX_UPLOAD_BYTES // (1024 * 1024)} MiB cap.",
        )

    try:
        file_uuid = _vault.encrypt_and_store_file(
            password=password,
            file_bytes=content,
            filename=file.filename or "unnamed",
            mime_type=file.content_type or "application/octet-stream",
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return {"uuid": file_uuid}


@router.post("/download")
def download(payload: _PasswordAndUuid) -> StreamingResponse:
    """Decrypt a file and stream it back with its original filename."""
    try:
        data, filename, mime = _vault.decrypt_and_retrieve_file(
            payload.password, payload.uuid,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    safe_name = urllib.parse.quote(filename or "decrypted_file")
    return StreamingResponse(
        io.BytesIO(data),
        media_type=mime or "application/octet-stream",
        headers={
            # Both `filename` and RFC-5987 `filename*` so non-ASCII names survive.
            "Content-Disposition": (
                f'attachment; filename="{safe_name}"; '
                f"filename*=UTF-8''{safe_name}"
            ),
        },
    )


@router.post("/delete")
def delete(payload: _PasswordAndUuid) -> dict:
    """Cryptographically shred the file and remove it from the index."""
    try:
        _vault.delete_file(payload.password, payload.uuid)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"deleted": payload.uuid}
