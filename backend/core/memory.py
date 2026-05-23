"""
core.memory
===========
Long-term semantic memory for J.A.R.V.I.S, backed by ChromaDB.

Each user / assistant exchange is persisted as a single document with a
timestamp; recall is performed via vector similarity at query time.
"""

from __future__ import annotations

import datetime
import logging
import os
import uuid

import chromadb

from core.security import redact

logger = logging.getLogger("jarvis.memory")

_COLLECTION_NAME: str = "jarvis_conversations"


class JarvisMemory:
    """Thin facade over a persistent ChromaDB collection."""

    def __init__(self, db_path: str | None = None) -> None:
        """
        @param db_path  Filesystem location for ChromaDB persistence. When
                        ``None``, defaults to ``<project>/backend/memory_db``.
        """
        self.db_path: str = db_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "memory_db"
        )
        os.makedirs(self.db_path, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=self.db_path,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )

    # ChromaDB collections can be invalidated (e.g. after a purge); resolve
    # them lazily so callers never hold a stale handle.
    def _collection(self):
        """Return a fresh, valid collection handle."""
        return self.client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"description": "Long-term memory for J.A.R.V.I.S."},
        )

    @property
    def collection(self):  # backwards compatibility with prior callers
        """Property alias for :meth:`_collection`."""
        return self._collection()

    def store_memory(self, user_text: str, ai_response: str) -> None:
        """
        Persist a single user → assistant exchange.

        @param user_text    The user's prompt.
        @param ai_response  The assistant's reply.
        """
        if not user_text or not ai_response:
            return
        try:
            self._collection().add(
                documents=[f"User: {user_text}\nJarvis: {ai_response}"],
                metadatas=[{
                    "timestamp": datetime.datetime.now().isoformat(),
                    "type": "conversation",
                }],
                ids=[str(uuid.uuid4())],
            )
        except Exception as exc:
            logger.warning("Store failed: %s", redact(str(exc)))

    def query_memory(self, query: str, n_results: int = 3) -> str:
        """
        Retrieve up to ``n_results`` semantically-relevant past exchanges.

        @param query      Free-text query (the current user prompt).
        @param n_results  Maximum number of matches.
        @return           A formatted recall block, or empty string when
                          nothing relevant is found / on error.
        """
        if not query or not query.strip():
            return ""
        try:
            results = self._collection().query(
                query_texts=[query],
                n_results=n_results,
            )
        except Exception as exc:
            logger.warning("Recall failed: %s", redact(str(exc)))
            return ""

        docs = (results.get("documents") or [[]])[0]
        metas = (results.get("metadatas") or [[]])[0]
        if not docs:
            return ""

        lines = ["[NEURAL MEMORY RECALL]"]
        for doc, meta in zip(docs, metas, strict=False):
            ts = (meta or {}).get("timestamp", "Unknown")[:16].replace("T", " ")
            lines.append(f"--- Entry ({ts}) ---\n{doc}")
        lines.append("[END MEMORY RECALL]")
        return "\n".join(lines)

    def clear_all_memories(self) -> None:
        """Delete the entire memory collection."""
        try:
            self.client.delete_collection(_COLLECTION_NAME)
            logger.info("Memory collection purged.")
        except Exception as exc:
            # ChromaDB raises if the collection doesn't exist — non-fatal.
            logger.info("Purge: %s", redact(str(exc)))
