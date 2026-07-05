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

ENV_TELEGRAM_BOT_TOKEN = "SECONDBRAIN_TELEGRAM_BOT_TOKEN"
ENV_TELEGRAM_ALLOWED_USER_ID = "SECONDBRAIN_TELEGRAM_ALLOWED_USER_ID"


def db_path() -> Path:
    """Resolve the active database path (env override wins)."""
    override = os.environ.get(ENV_DB_PATH)
    if override:
        return Path(override).expanduser()
    return DEFAULT_DB_PATH


def telegram_bot_token() -> str | None:
    """Bot token issued by @BotFather, or None if unset."""
    return os.environ.get(ENV_TELEGRAM_BOT_TOKEN)


def telegram_allowed_user_id() -> int | None:
    """The single Telegram user ID the bot will respond to, or None if unset."""
    value = os.environ.get(ENV_TELEGRAM_ALLOWED_USER_ID)
    return int(value) if value else None
