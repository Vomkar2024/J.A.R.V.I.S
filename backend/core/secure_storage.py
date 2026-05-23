import datetime
import json
import logging
import os
import uuid

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from core.paths import VAULT_DIR
from core.security import redact

logger = logging.getLogger("jarvis.secure_storage")

class NexusSecureStorage:
    """
    NexusSecureStorage
    High-security zero-knowledge encrypted vault.
    Uses AES-256-GCM for file/index encryption and PBKDF2-HMAC-SHA256 for key derivation.
    """
    def __init__(self, vault_dir=None):
        # In dev, vault_dir defaults to <repo>/vault/. When the backend is
        # shipped as a PyInstaller sidecar, core.paths.VAULT_DIR points
        # at the per-user APPDATA location so blobs survive app updates.
        self.vault_dir = vault_dir or str(VAULT_DIR)
        os.makedirs(self.vault_dir, exist_ok=True)
        self.index_path = os.path.join(self.vault_dir, "index.enc")

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """Derive a 256-bit key from a password and salt using PBKDF2-HMAC-SHA256."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32, # 256 bits
            salt=salt,
            iterations=100000
        )
        return kdf.derive(password.encode("utf-8"))

    def is_initialized(self) -> bool:
        """Check if the secure vault has been initialized."""
        return os.path.exists(self.index_path)

    def initialize_vault(self, password: str):
        """Initialize the secure vault by creating an empty encrypted index registry."""
        if self.is_initialized():
            raise ValueError("Vault is already initialized.")

        empty_index = {"files": {}}
        self._save_index(password, empty_index)

    def _load_index(self, password: str) -> dict:
        """Decrypt and load the index file. Raises ValueError if decryption fails."""
        if not self.is_initialized():
            raise ValueError("Vault has not been initialized.")

        try:
            with open(self.index_path, "rb") as f:
                data = f.read()

            if len(data) < 28: # Salt (16 bytes) + IV (12 bytes)
                raise ValueError("Vault index is corrupted.")

            salt = data[:16]
            iv = data[16:28]
            ciphertext = data[28:]

            key = self._derive_key(password, salt)
            aesgcm = AESGCM(key)

            decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
            return json.loads(decrypted_bytes.decode("utf-8"))
        except (ValueError, OSError) as e:
            # Cryptographic failure (wrong password, tampered index) or
            # filesystem failure (index file disappeared mid-read).
            raise ValueError(
                "Authentication failed. Invalid master password or corrupted registry."
            ) from e

    def _save_index(self, password: str, index_data: dict):
        """Encrypt and save the index file."""
        salt = os.urandom(16)
        iv = os.urandom(12)

        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)

        serialized_json = json.dumps(index_data).encode("utf-8")
        ciphertext = aesgcm.encrypt(iv, serialized_json, None)

        # Format on disk: SALT (16) + IV (12) + CIPHERTEXT
        with open(self.index_path, "wb") as f:
            f.write(salt + iv + ciphertext)

    def unlock_vault(self, password: str) -> bool:
        """Verify the master password by attempting to load/decrypt the index."""
        try:
            self._load_index(password)
            return True
        except ValueError:
            return False

    def list_files(self, password: str) -> list:
        """List metadata for all files in the vault."""
        index = self._load_index(password)
        files_list = []
        for file_uuid, metadata in index.get("files", {}).items():
            files_list.append({
                "uuid": file_uuid,
                "name": metadata.get("name"),
                "size": metadata.get("size"),
                "mimeType": metadata.get("mimeType"),
                "createdAt": metadata.get("createdAt")
            })
        # Sort by creation date descending
        files_list.sort(key=lambda x: x["createdAt"], reverse=True)
        return files_list

    def encrypt_and_store_file(self, password: str, file_bytes: bytes, filename: str, mime_type: str) -> str:
        """
        Encrypt file bytes and store in the vault, updating the secure index.
        Returns the safe file UUID.
        """
        index = self._load_index(password)

        file_uuid = str(uuid.uuid4())
        salt = os.urandom(16)
        iv = os.urandom(12)

        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)

        ciphertext = aesgcm.encrypt(iv, file_bytes, None)

        # Save encrypted file to disk: SALT (16) + IV (12) + CIPHERTEXT
        file_path = os.path.join(self.vault_dir, f"{file_uuid}.enc")
        with open(file_path, "wb") as f:
            f.write(salt + iv + ciphertext)

        # Update metadata index
        index["files"][file_uuid] = {
            "name": filename,
            "size": len(file_bytes),
            "mimeType": mime_type,
            "createdAt": datetime.datetime.now().isoformat()
        }

        self._save_index(password, index)
        return file_uuid

    def decrypt_and_retrieve_file(self, password: str, file_uuid: str) -> tuple:
        """
        Decrypt and retrieve a file by its UUID.
        Returns a tuple: (file_bytes, filename, mime_type).
        """
        index = self._load_index(password)

        if file_uuid not in index.get("files", {}):
            raise FileNotFoundError("Requested file could not be found in the secure registry, sir.")

        metadata = index["files"][file_uuid]
        file_path = os.path.join(self.vault_dir, f"{file_uuid}.enc")

        if not os.path.exists(file_path):
            raise FileNotFoundError("The physical encrypted block was missing from disk, sir.")

        with open(file_path, "rb") as f:
            data = f.read()

        if len(data) < 28:
            raise ValueError("Encrypted file payload is corrupted.")

        salt = data[:16]
        iv = data[16:28]
        ciphertext = data[28:]

        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)

        decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
        return decrypted_bytes, metadata.get("name"), metadata.get("mimeType")

    def delete_file(self, password: str, file_uuid: str):
        """Securely shred and delete a file from the vault, wiping it from disk and updating the index."""
        index = self._load_index(password)

        if file_uuid not in index.get("files", {}):
            raise FileNotFoundError("Requested file could not be found in the secure registry, sir.")

        # Physical shred from disk: overwrite file with cryptographically secure random bytes
        file_path = os.path.join(self.vault_dir, f"{file_uuid}.enc")
        if os.path.exists(file_path):
            try:
                file_size = os.path.getsize(file_path)
                if file_size > 0:
                    with open(file_path, "wb") as f:
                        f.write(os.urandom(file_size))
                        f.flush()
                        os.fsync(f.fileno())  # Force block update to storage hardware
            except OSError as exc:
                logger.warning(
                    "Cryptographic shred warning: byte overwrite bypassed: %s",
                    redact(str(exc)),
                )
            os.remove(file_path)

        # Remove from index
        del index["files"][file_uuid]
        self._save_index(password, index)
