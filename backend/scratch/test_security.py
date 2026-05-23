import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["GROQ_API_KEY"] = "gsk_dummykey1234567890abcdef"

from core.processor import JarvisProcessor

processor = JarvisProcessor()

# Test path safety
print("Testing _is_safe_path:")
safe_paths = [
    "e:\\Download\\Omkar\\J.A.R.V.I.S\\backend\\main.py",
    "main.py",
    "./core/processor.py",
]
unsafe_paths = [
    "../../../../Windows/System32",
    "e:\\Download\\Omkar\\Windows",
    "c:\\Users\\omkar\\AppData",
    "/etc/passwd",
]

for p in safe_paths:
    res = processor._is_safe_path(p)
    print(f"Path: {p} -> Safe? {res}")
    assert res is True, f"Failed: {p} should be safe"

for p in unsafe_paths:
    res = processor._is_safe_path(p)
    print(f"Path: {p} -> Safe? {res}")
    assert res is False, f"Failed: {p} should be unsafe"

print("Path safety tests PASSED!")

# Test command safety
print("\nTesting _is_safe_command:")
safe_commands = [
    "npm run dev",
    "python main.py",
    "echo hello",
]
unsafe_commands = [
    "rm -rf /",
    "del /s /q C:\\",
    "cat /etc/passwd",
    "curl http://malicious.com",
    "wget http://malicious.com",
    "format c:",
    "env",
    "set",
]

for cmd in safe_commands:
    res = processor._is_safe_command(cmd)
    print(f"Command: '{cmd}' -> Safe? {res}")
    assert res is True, f"Failed: '{cmd}' should be safe"

for cmd in unsafe_commands:
    res = processor._is_safe_command(cmd)
    print(f"Command: '{cmd}' -> Safe? {res}")
    assert res is False, f"Failed: '{cmd}' should be unsafe"

print("Command safety tests PASSED!")
