"""Outlook (Microsoft Graph) provider — STUB.

Same interface as Google, deferred per the roadmap ("Google, then Outlook").
Wiring this up means implementing the four methods against Graph's calendar
endpoints; the seam (registry, push hook, sync) already supports it unchanged.
"""

from __future__ import annotations

from .base import CalendarProvider


class OutlookProvider(CalendarProvider):
    def __init__(self, *args, **kwargs):
        raise NotImplementedError("Outlook sync is not implemented yet (Google first).")

    def push_event(self, *, title: str, start_at: str, end_at: str) -> str:
        raise NotImplementedError

    def update_event(self, event_id: str, *, start_at: str, end_at: str) -> None:
        raise NotImplementedError

    def delete_event(self, event_id: str) -> None:
        raise NotImplementedError

    def list_events(self, *, start: str, end: str) -> list[dict]:
        raise NotImplementedError
