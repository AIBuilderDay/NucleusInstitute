"""MCP server bindings for the agentic-filter matcher.

`build_mcp_server` is the only public entry point. It returns a per-request
FastMCP server bound to the focal entity + candidate pools. The
AgenticFilterMatcher in `app.provider.matching.agentic_filter` calls this
once per match request and connects an in-process FastMCP `Client`.

See PLAN.md §7 for the full spec.
"""

from app.mcp.server import build_mcp_server

__all__ = ["build_mcp_server"]
