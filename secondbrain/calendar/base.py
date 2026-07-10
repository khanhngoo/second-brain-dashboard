"""Calendar provider abstraction.

This is the ONLY network-egress surface. Providers push/read events; they never
touch the database (core/ owns all DB writes). The default NullProvider makes
the whole push path a no-op so the offline product — and every P0/P1/P2 test —
behaves exactly as before.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

# Events pushed by us carry this extended property so the read-sync can exclude
# them (echo-loop guard, docs/05).
OWNED_PROPERTY = "secondbrain_owned"
OWNED_TITLE_PREFIX = "[SB] "


class CalendarProvider(ABC):
    """A connected calendar. Authority flows one way: dashboard -> calendar."""

    @abstractmethod
    def push_event(self, *, title: str, start_at: str, end_at: str) -> str:
        """Create an event; return its external id."""

    @abstractmethod
    def update_event(self, event_id: str, *, start_at: str, end_at: str) -> None:
        ...

    @abstractmethod
    def delete_event(self, event_id: str) -> None:
        ...

    @abstractmethod
    def list_events(self, *, start: str, end: str) -> list[dict]:
        """Return external (non-owned) events as
        {provider, external_id, title, start_at, end_at} dicts."""


class NullProvider(CalendarProvider):
    """No calendar connected — every operation is a no-op. The default."""

    def push_event(self, *, title: str, start_at: str, end_at: str) -> str:
        return ""

    def update_event(self, event_id: str, *, start_at: str, end_at: str) -> None:
        return None

    def delete_event(self, event_id: str) -> None:
        return None

    def list_events(self, *, start: str, end: str) -> list[dict]:
        return []
