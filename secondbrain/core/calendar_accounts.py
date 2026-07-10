"""Calendar account references (DB rows only — tokens live in the keychain)."""

from __future__ import annotations

import sqlite3

from .. import clock
from .serialize import row_to_dict, rows_to_dicts


def add_calendar_account(conn: sqlite3.Connection, provider: str, account_email: str) -> dict:
    """Record a connected account. The OAuth token is stored in the keychain by
    the caller (calendar/oauth.save_token), never here."""
    now = clock.now_utc_iso()
    with conn:
        existing = conn.execute(
            "SELECT id FROM calendar_accounts WHERE provider = ? AND account_email = ?",
            (provider, account_email),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE calendar_accounts SET last_sync = ? WHERE id = ?",
                (now, existing["id"]),
            )
            acc_id = existing["id"]
        else:
            cur = conn.execute(
                """
                INSERT INTO calendar_accounts (provider, account_email, last_sync, created_at)
                VALUES (?, ?, NULL, ?)
                """,
                (provider, account_email, now),
            )
            acc_id = cur.lastrowid
    return row_to_dict(
        conn.execute("SELECT * FROM calendar_accounts WHERE id = ?", (acc_id,)).fetchone()
    )


def list_calendar_accounts(conn: sqlite3.Connection) -> list[dict]:
    return rows_to_dicts(
        conn.execute("SELECT * FROM calendar_accounts ORDER BY id").fetchall()
    )


def remove_calendar_account(conn: sqlite3.Connection, id: int) -> dict:
    with conn:
        conn.execute("DELETE FROM calendar_accounts WHERE id = ?", (id,))
    return {"deleted": True, "id": id}


def touch_last_sync(conn: sqlite3.Connection, provider: str) -> None:
    with conn:
        conn.execute(
            "UPDATE calendar_accounts SET last_sync = ? WHERE provider = ?",
            (clock.now_utc_iso(), provider),
        )
