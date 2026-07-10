"""Calendar provider registry.

A process-level singleton. Defaults to NullProvider so the push path is inert
until an account is connected (calendar/oauth.py bootstraps a real provider on
server start when a token exists in the keychain).
"""

from __future__ import annotations

from .base import CalendarProvider, NullProvider

_provider: CalendarProvider = NullProvider()


def get_provider() -> CalendarProvider:
    return _provider


def set_provider(provider: CalendarProvider | None) -> None:
    global _provider
    _provider = provider or NullProvider()


def provider_enabled() -> bool:
    """True only when a real (non-null) provider is registered."""
    return not isinstance(_provider, NullProvider)
