import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.memory import JarvisMemory

def main():
    print("Purging J.A.R.V.I.S Memory Database to remove Tony Stark legacy references...")
    memory = JarvisMemory()
    memory.clear_all_memories()
    print("Memory purged successfully. New identity established.")

if __name__ == "__main__":
    main()
