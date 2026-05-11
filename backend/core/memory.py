import os
import chromadb
from chromadb.utils import embedding_functions
import uuid
import datetime

class JarvisMemory:
    """
    JarvisMemory
    Manages long-term storage and retrieval of conversation context.
    Uses ChromaDB for vector-based semantic search.
    """
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "memory_db")
        os.makedirs(self.db_path, exist_ok=True)
        
        # Initialize Chroma Client with telemetry disabled to suppress warnings
        self.client = chromadb.PersistentClient(
            path=self.db_path,
            settings=chromadb.Settings(anonymized_telemetry=False)
        )
        
        # Using default embedding function
        self.collection = self.client.get_or_create_collection(
            name="jarvis_conversations",
            metadata={"description": "Long-term memory for J.A.R.V.I.S conversations"}
        )

    def store_memory(self, user_text: str, ai_response: str):
        """Stores a conversation exchange into the vector database."""
        try:
            timestamp = datetime.datetime.now().isoformat()
            doc_id = str(uuid.uuid4())
            
            # We combine user input and AI response for a full contextual unit
            content = f"User: {user_text}\nJarvis: {ai_response}"
            
            self.collection.add(
                documents=[content],
                metadatas=[{"timestamp": timestamp, "type": "conversation"}],
                ids=[doc_id]
            )
            print(f"[Memory] Stored new memory unit: {doc_id}")
        except Exception as e:
            print(f"[Memory] Error storing memory: {e}")

    def query_memory(self, query: str, n_results: int = 3):
        """Retrieves semantically relevant past conversations."""
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            
            memories = results.get("documents", [[]])[0]
            if not memories:
                return ""
                
            context = "\n---\nRelevant Past Memories:\n" + "\n".join(memories)
            return context
        except Exception as e:
            print(f"[Memory] Error querying memory: {e}")
            return ""

    def clear_all_memories(self):
        """Wipes the entire memory database."""
        try:
            self.client.delete_collection("jarvis_conversations")
            self.collection = self.client.get_or_create_collection(name="jarvis_conversations")
            print("[Memory] All memories purged.")
        except Exception as e:
            print(f"[Memory] Error clearing memory: {e}")
