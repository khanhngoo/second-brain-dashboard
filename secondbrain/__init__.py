"""Second Brain — local single-user dashboard backend.

Three layers (see docs/00):
  - data: a local SQLite database (single source of truth)
  - agentic: an MCP server exposing curated tools (the contract)
  - clients: Claude Code + the dashboard, both through the tool layer

This package's ``core`` module is the single implementation; the MCP server,
HTTP API, and CLI are thin front doors over it.
"""

__version__ = "0.1.0"
