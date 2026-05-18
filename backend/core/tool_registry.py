"""
core.tool_registry
==================
Single source of truth for J.A.R.V.I.S tool-calling.

Design
------
Each tool is registered as a :class:`Tool` dataclass coupling its OpenAI/Groq
function schema with its concrete handler. The dispatcher (``execute_tool``)
looks up the handler by name and invokes it — eliminating the prior pattern
of returning sentinel strings (``"VISION_REQUESTED"``, …) and re-dispatching
inside the processor.

Side-effecting handlers receive a :class:`ToolContext` so they can reach the
memory, vision, and document-export subsystems without import cycles.
"""

from __future__ import annotations

import datetime
import glob
import json
import platform
from dataclasses import dataclass
from typing import Any, Callable, Protocol

from core.security import (
    redact,
    resolve_within_sandbox,
    run_safe_command,
    SANDBOX_ROOT,
)

try:  # psutil is optional — system telemetry degrades gracefully without it.
    import psutil
    _HAS_PSUTIL = True
except ImportError:  # pragma: no cover
    _HAS_PSUTIL = False

try:
    from duckduckgo_search import DDGS
    _HAS_DDGS = True
except ImportError:  # pragma: no cover
    _HAS_DDGS = False


# --- Cross-module context ----------------------------------------------------

class _MemoryLike(Protocol):
    def clear_all_memories(self) -> None: ...


class _VisionLike(Protocol):
    def analyze_screen(self, query: str) -> str: ...


class _ExporterLike(Protocol):
    def __call__(self, fmt: str) -> str: ...


@dataclass
class ToolContext:
    """
    Shared, mutable context handed to every tool handler.

    @param memory    Live :class:`JarvisMemory` instance.
    @param vision    Live :class:`JarvisVision` instance.
    @param exporter  Callable that exports the running conversation to a
                     document (``fmt`` is ``"pdf"`` or ``"docx"``).
    """
    memory: _MemoryLike
    vision: _VisionLike
    exporter: _ExporterLike


# --- Tool definition ---------------------------------------------------------

Handler = Callable[[dict[str, Any], ToolContext], str]


@dataclass(frozen=True)
class Tool:
    """A single tool: its public schema and its private handler."""
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Handler

    def to_groq_schema(self) -> dict[str, Any]:
        """Render the OpenAI/Groq function-calling schema for this tool."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


# --- Handlers ----------------------------------------------------------------

def _h_system_status(_: dict[str, Any], __: ToolContext) -> str:
    """Return current CPU / RAM / disk usage."""
    if not _HAS_PSUTIL:
        return "Telemetry unavailable: psutil is not installed."
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent if platform.system() != "Windows" \
        else psutil.disk_usage("C:\\").percent
    return f"CPU {cpu}% · Memory {mem}% · Disk {disk}%."


def _h_time_and_date(_: dict[str, Any], __: ToolContext) -> str:
    """Return the local date and time."""
    now = datetime.datetime.now()
    return f"It is {now.strftime('%H:%M:%S')} on {now.strftime('%A, %d %B %Y')}."


def _h_platform_info(_: dict[str, Any], __: ToolContext) -> str:
    """Return host OS / architecture summary."""
    return (
        f"Running {platform.system()} {platform.release()} "
        f"on {platform.machine()} ({platform.python_version()})."
    )


def _h_purge_memory(_: dict[str, Any], ctx: ToolContext) -> str:
    """Wipe the entire long-term ChromaDB memory."""
    ctx.memory.clear_all_memories()
    return "Memory wiped successfully, sir."


def _h_analyze_screen(args: dict[str, Any], ctx: ToolContext) -> str:
    """Delegate vision analysis to the multimodal model."""
    query = args.get("query") or "What is on the screen?"
    return ctx.vision.analyze_screen(query)


def _h_execute_terminal(args: dict[str, Any], _: ToolContext) -> str:
    """Run an allow-listed shell command without invoking a shell."""
    command = args.get("command", "")
    return run_safe_command(command)


def _h_create_file(args: dict[str, Any], _: ToolContext) -> str:
    """Create a file inside the project sandbox."""
    path = args.get("path", "")
    content = args.get("content", "")
    try:
        target = resolve_within_sandbox(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"File created at {target.relative_to(SANDBOX_ROOT)}."
    except (PermissionError, ValueError) as exc:
        return f"Refused: {exc}"
    except OSError as exc:
        return f"I/O error: {redact(str(exc))}"


def _h_search_files(args: dict[str, Any], _: ToolContext) -> str:
    """Search the sandbox for files matching a glob pattern."""
    query = args.get("query", "")
    root = args.get("root_dir") or "."
    if not query:
        return "Refused: empty search pattern."
    try:
        root_path = resolve_within_sandbox(root)
    except (PermissionError, ValueError) as exc:
        return f"Refused: {exc}"

    # Disallow ``..`` segments inside the pattern itself.
    if ".." in query.split("/") or ".." in query.split("\\"):
        return "Refused: traversal in pattern."

    raw = glob.glob(str(root_path / "**" / query), recursive=True)
    matches: list[str] = []
    for entry in raw[:50]:
        try:
            resolved = resolve_within_sandbox(entry)
        except (PermissionError, ValueError):
            continue
        matches.append(str(resolved.relative_to(SANDBOX_ROOT)))
    if not matches:
        return "No matches."
    head = ", ".join(matches[:10])
    suffix = "…" if len(matches) > 10 else ""
    return f"Found {len(matches)} file(s): {head}{suffix}"


def _h_read_file(args: dict[str, Any], _: ToolContext) -> str:
    """Read a UTF-8 file from inside the sandbox (capped at 4 KB)."""
    path = args.get("path", "")
    try:
        target = resolve_within_sandbox(path)
        if not target.is_file():
            return "Refused: path is not a regular file."
        # Reject obviously oversized files to avoid OOM via tool call.
        if target.stat().st_size > 1_048_576:  # 1 MiB
            return "Refused: file exceeds 1 MiB."
        content = target.read_text(encoding="utf-8", errors="replace")
    except (PermissionError, ValueError) as exc:
        return f"Refused: {exc}"
    except OSError as exc:
        return f"I/O error: {redact(str(exc))}"
    return content[:4000] + ("…[truncated]" if len(content) > 4000 else "")


def _ddgs_text(query: str, max_results: int = 5) -> str:
    """Internal helper for DuckDuckGo text search with graceful failure."""
    if not _HAS_DDGS:
        return "Web search disabled: duckduckgo_search is not installed."
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
    except Exception as exc:  # network / parse errors
        return f"Search failed: {redact(str(exc))}"
    return json.dumps(results, ensure_ascii=False)


def _h_web_search(args: dict[str, Any], _: ToolContext) -> str:
    """Run a web search via DuckDuckGo."""
    return _ddgs_text(args.get("query", ""), max_results=5)


def _h_weather(args: dict[str, Any], _: ToolContext) -> str:
    """Resolve weather via web search (no paid weather API required)."""
    location = args.get("location", "")
    if not location:
        return "Refused: no location supplied."
    return _ddgs_text(f"current weather in {location}", max_results=3)


def _h_export_conversation(args: dict[str, Any], ctx: ToolContext) -> str:
    """Export the running conversation log to PDF or DOCX."""
    fmt = (args.get("format") or "pdf").lower()
    if fmt not in {"pdf", "docx"}:
        return "Refused: format must be 'pdf' or 'docx'."
    return ctx.exporter(fmt)


# --- Registry ----------------------------------------------------------------

_TOOLS: tuple[Tool, ...] = (
    Tool("get_system_status",
         "Get current CPU, RAM, and disk usage of the host.",
         {"type": "object", "properties": {}},
         _h_system_status),
    Tool("get_time_and_date",
         "Get the current local time and date.",
         {"type": "object", "properties": {}},
         _h_time_and_date),
    Tool("get_platform_info",
         "Get information about the host OS and architecture.",
         {"type": "object", "properties": {}},
         _h_platform_info),
    Tool("purge_memory",
         "Wipe all long-term conversation memory. Use with caution.",
         {"type": "object", "properties": {}},
         _h_purge_memory),
    Tool("analyze_screen",
         "Capture and analyse the user's screen to answer a question.",
         {"type": "object",
          "properties": {"query": {"type": "string",
                                   "description": "Question about the screen."}},
          "required": ["query"]},
         _h_analyze_screen),
    Tool("execute_terminal_command",
         "Execute a shell command from the security allow-list "
         "(read-only / inspection commands only).",
         {"type": "object",
          "properties": {"command": {"type": "string",
                                     "description": "Command to execute."}},
          "required": ["command"]},
         _h_execute_terminal),
    Tool("create_file",
         "Create a UTF-8 text file inside the project sandbox.",
         {"type": "object",
          "properties": {
              "path": {"type": "string",
                       "description": "Path relative to the sandbox root."},
              "content": {"type": "string",
                          "description": "Text content of the file."}},
          "required": ["path", "content"]},
         _h_create_file),
    Tool("search_files",
         "Search the sandbox for files matching a glob pattern.",
         {"type": "object",
          "properties": {
              "query": {"type": "string",
                        "description": "Glob pattern, e.g. '*.py'."},
              "root_dir": {"type": "string",
                           "description": "Search root (default: sandbox)."}},
          "required": ["query"]},
         _h_search_files),
    Tool("read_file",
         "Read a UTF-8 text file from inside the sandbox (≤ 1 MiB).",
         {"type": "object",
          "properties": {"path": {"type": "string",
                                  "description": "Path relative to sandbox."}},
          "required": ["path"]},
         _h_read_file),
    Tool("web_search",
         "Search the web for real-time information.",
         {"type": "object",
          "properties": {"query": {"type": "string",
                                   "description": "Search query."}},
          "required": ["query"]},
         _h_web_search),
    Tool("get_weather",
         "Get the current weather for a city / location.",
         {"type": "object",
          "properties": {"location": {"type": "string",
                                      "description": "City and country."}},
          "required": ["location"]},
         _h_weather),
    Tool("export_conversation",
         "Export the running conversation to PDF or DOCX.",
         {"type": "object",
          "properties": {"format": {"type": "string",
                                    "enum": ["pdf", "docx"]}}},
         _h_export_conversation),
)

_TOOLS_BY_NAME: dict[str, Tool] = {t.name: t for t in _TOOLS}

# Exposed for the Groq client's ``tools=`` kwarg.
TOOL_DEFINITIONS: list[dict[str, Any]] = [t.to_groq_schema() for t in _TOOLS]


def execute_tool(name: str, arguments: dict[str, Any], ctx: ToolContext) -> str:
    """
    Invoke a registered tool by name.

    @param name       Tool identifier matching one of :data:`TOOL_DEFINITIONS`.
    @param arguments  JSON-decoded arguments from the LLM tool call.
    @param ctx        Shared :class:`ToolContext` (memory, vision, exporter).
    @return           Human-readable result string ready to feed back into
                      the LLM as a ``"role": "tool"`` message.
    """
    tool = _TOOLS_BY_NAME.get(name)
    if tool is None:
        return f"Error: tool '{name}' is not registered."
    try:
        return tool.handler(arguments or {}, ctx)
    except Exception as exc:  # last-resort: never crash the dispatcher
        return f"Error executing tool {name}: {redact(str(exc))}"
