import chromadb
import os

db_path = os.path.join(os.getcwd(), "backend", "memory_db")
client = chromadb.PersistentClient(path=db_path)

try:
    collection = client.get_collection(name="jarvis_conversations")
    results = collection.get(limit=10)
    
    print(f"Total memories found: {len(results['ids'])}")
    print("-" * 50)
    
    for i in range(len(results['ids'])):
        print(f"ID: {results['ids'][i]}")
        print(f"Content:\n{results['documents'][i]}")
        print(f"Metadata: {results['metadatas'][i]}")
        print("-" * 50)
except Exception as e:
    print(f"Error reading database: {e}")
