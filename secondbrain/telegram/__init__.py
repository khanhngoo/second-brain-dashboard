"""Telegram bot gateway — a third front door onto the core layer.

Same pattern as the HTTP API and CLI: thin handlers call straight into
``secondbrain.core`` with a shared ``sqlite3.Connection``. Auth is a single
allowed user ID (see ``secondbrain.config.telegram_allowed_user_id``) — this
is a single-user local app, so there is no per-request session model.
"""
