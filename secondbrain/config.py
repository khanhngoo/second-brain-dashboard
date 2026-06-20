"""Configuration — database path resolution.

The DB is a single local file. Default ``~/.secondbrain/db.sqlite``; override
with the ``SECONDBRAIN_DB`` environment variable (used by tests to point at a
temp file).
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_DB_PATH = "SECONDBRAIN_DB"
DEFAULT_DB_DIR = Path.home() / ".secondbrain"
DEFAULT_DB_PATH = DEFAULT_DB_DIR / "db.sqlite"


def db_path() -> Path:
    """Resolve the active database path (env override wins)."""
    override = os.environ.get(ENV_DB_PATH)
    if override:
        return Path(override).expanduser()
    return DEFAULT_DB_PATH
