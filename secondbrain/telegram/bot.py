"""Telegram gateway: long-running polling process, one allowed user.

Mirrors ``sb serve``'s shape (open the DB connection once, run a blocking
call) but for a chat transport instead of HTTP.
"""

from __future__ import annotations

import sqlite3

from .. import config
from . import commands

NOT_AUTHORIZED = "not authorized"


def run_gateway(conn: sqlite3.Connection) -> None:
    token = config.telegram_bot_token()
    allowed_user_id = config.telegram_allowed_user_id()
    if not token:
        raise RuntimeError(f"set {config.ENV_TELEGRAM_BOT_TOKEN} to run the Telegram gateway")
    if allowed_user_id is None:
        raise RuntimeError(
            f"set {config.ENV_TELEGRAM_ALLOWED_USER_ID} to run the Telegram gateway"
        )

    from telegram import Update
    from telegram.ext import Application, CommandHandler, ContextTypes

    def _guarded(handler):
        async def wrapped(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
            if update.effective_user is None or update.effective_user.id != allowed_user_id:
                await update.message.reply_text(NOT_AUTHORIZED)
                return
            message_text = update.message.text or ""
            _, _, text = message_text.partition(" ")
            reply = handler(conn, text)
            await update.message.reply_text(reply)

        return wrapped

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", _guarded(commands.cmd_help)))
    app.add_handler(CommandHandler("help", _guarded(commands.cmd_help)))
    app.add_handler(CommandHandler("add", _guarded(commands.cmd_add)))
    app.add_handler(CommandHandler("list", _guarded(commands.cmd_list)))
    app.add_handler(CommandHandler("done", _guarded(commands.cmd_done)))

    app.run_polling()
