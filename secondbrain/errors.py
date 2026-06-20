"""Domain errors raised by the core layer.

Adapters map these to transport-specific responses (HTTP status codes,
structured MCP errors). The core never raises bare ``ValueError``/``KeyError``.
"""

from __future__ import annotations


class SecondBrainError(Exception):
    """Base class for all core-layer errors."""


class ValidationError(SecondBrainError):
    """Invalid input: bad enum value, broken invariant, malformed argument.

    Maps to HTTP 422.
    """


class NotFoundError(SecondBrainError):
    """A referenced entity (pillar/milestone/task/block) does not exist.

    Maps to HTTP 404.
    """


class ReadOnlyViolation(SecondBrainError):
    """A ``query(sql)`` call attempted something other than a single SELECT.

    Maps to HTTP 400.
    """
