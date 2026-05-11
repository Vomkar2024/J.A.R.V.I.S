import psutil
import platform
import datetime
import subprocess
import os
from duckduckgo_search import DDGS

class JarvisTools:
    """
    Registry of tools that J.A.R.V.I.S can use.
    Each method should return a string representation of the result.
    """
    
    @staticmethod
    def get_system_status():
        """Returns the current CPU, Memory, and Disk usage of the system."""
        cpu = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent
        return (
            f"System Status: CPU Usage is at {cpu}%, "
            f"Memory Usage is at {memory}%, "
            f"and Disk space is {disk}% full."
        )

    @staticmethod
    def get_time_and_date():
        """Returns the current local time and date."""
        now = datetime.datetime.now()
        return f"The current time is {now.strftime('%H:%M:%S')} and the date is {now.strftime('%Y-%m-%d')}."

    @staticmethod
    def get_platform_info():
        """Returns information about the operating system and machine architecture."""
        os_info = platform.system()
        os_release = platform.release()
        arch = platform.machine()
        return f"System Information: Running {os_info} {os_release} on {arch} architecture."

    @staticmethod
    def purge_memory():
        """Wipes J.A.R.V.I.S's long-term conversation memory. Use only when explicitly asked."""
        # We need a reference to the processor or memory object
        # Since this is a static registry, we'll handle this in the processor dispatcher
        return "MEMORY_PURGE_REQUESTED"

    @staticmethod
    def analyze_screen(query: str):
        """Captures and analyzes the current screen to answer questions about what is visible."""
        return "VISION_REQUESTED"

    @staticmethod
    def execute_terminal_command(command: str):
        """Runs a terminal command on the system. Use for task automation or file operations."""
        return "TERMINAL_EXECUTION_REQUESTED"

    @staticmethod
    def create_file(path: str, content: str):
        """Creates a new file with specified content at the given path."""
        return "CREATE_FILE_REQUESTED"

    @staticmethod
    def search_files(query: str, root_dir: str = "."):
        """Searches for files matching a query in the specified directory."""
        return "SEARCH_FILES_REQUESTED"

    @staticmethod
    def read_file(path: str):
        """Reads the content of a file at the specified path."""
        return "READ_FILE_REQUESTED"

    @staticmethod
    def web_search(query: str):
        """Searches the web for information using DuckDuckGo."""
        return "WEB_SEARCH_REQUESTED"

    @staticmethod
    def get_weather(location: str):
        """Gets the current weather for a specified location."""
        # This will be handled by the processor using web search or a mock
        return "WEATHER_REQUESTED"

    @staticmethod
    def export_conversation(format: str = "pdf"):
        """Exports the full raw conversation history to a professional document (PDF or Word)."""
        return "EXPORT_CONVERSATION_REQUESTED"

# Tool Definitions for Groq API
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_system_status",
            "description": "Get the current system telemetry including CPU, RAM, and Disk usage.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_time_and_date",
            "description": "Get the current local time and date.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_platform_info",
            "description": "Get information about the computer's operating system and architecture.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "purge_memory",
            "description": "Wipe all long-term conversation history and memories. Use with extreme caution.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_screen",
            "description": "See what is currently on the screen. Use this if the user asks about their code, an error, or anything visible on their desktop.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Specific question about the screen content."
                    }
                },
                "required": ["query"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_terminal_command",
            "description": "Execute a shell command. Use for file management, directory creation, or running scripts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The command to run in the terminal."
                    }
                },
                "required": ["command"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create a new file with specific content. Useful for scaffolding code or saving notes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path (relative to project root)."
                    },
                    "content": {
                        "type": "string",
                        "description": "The text content of the file."
                    }
                },
                "required": ["path", "content"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search for files by name or extension in a directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Filename pattern to search for (e.g., *.js)."
                    },
                    "root_dir": {
                        "type": "string",
                        "description": "Directory to start searching from (defaults to project root)."
                    }
                },
                "required": ["query"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the text content of a file. Use this to examine code or data files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path (relative to project root)."
                    }
                },
                "required": ["path"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the internet for real-time information, news, or general knowledge.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query."
                    }
                },
                "required": ["query"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a specific city or location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and country (e.g., 'London, UK')."
                    }
                },
                "required": ["location"]
            },
        },
    }
]

def execute_tool(tool_name: str, arguments: dict):
    """Dispatcher to execute the tool by name."""
    try:
        if tool_name == "get_system_status":
            return JarvisTools.get_system_status()
        elif tool_name == "get_time_and_date":
            return JarvisTools.get_time_and_date()
        elif tool_name == "get_platform_info":
            return JarvisTools.get_platform_info()
        elif tool_name == "purge_memory":
            return JarvisTools.purge_memory()
        elif tool_name == "analyze_screen":
            return JarvisTools.analyze_screen(arguments.get("query"))
        elif tool_name == "execute_terminal_command":
            return JarvisTools.execute_terminal_command(arguments.get("command"))
        elif tool_name == "create_file":
            return JarvisTools.create_file(arguments.get("path"), arguments.get("content"))
        elif tool_name == "search_files":
            return JarvisTools.search_files(arguments.get("query"), arguments.get("root_dir", "."))
        elif tool_name == "read_file":
            return JarvisTools.read_file(arguments.get("path"))
        elif tool_name == "web_search":
            return JarvisTools.web_search(arguments.get("query"))
        elif tool_name == "get_weather":
            return JarvisTools.get_weather(arguments.get("location"))
        elif tool_name == "export_conversation":
            return JarvisTools.export_conversation(arguments.get("format", "pdf"))
        else:
            return f"Error: Tool '{tool_name}' not found."
    except Exception as e:
        return f"Error executing tool {tool_name}: {str(e)}"
