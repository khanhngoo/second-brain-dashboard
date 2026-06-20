"""Typer CLI: init the DB, seed data, print the morning brief.

The brief command is the P0 "done when" check (docs/08) — pulling
get_today_brief entirely from the command line.
"""

from __future__ import annotations

import json

import typer

from . import clock, config, core
from .db.runtime import get_conn
from .seed import seed as seed_data

app = typer.Typer(add_completion=False, help="Second Brain backend CLI.")


@app.command("init-db")
def init_db() -> None:
    """Create the database and schema at the configured path."""
    get_conn()  # opening initializes the schema
    typer.echo(f"initialized {config.db_path()}")


@app.command()
def seed(reset: bool = typer.Option(False, "--reset", help="Wipe all tables first.")) -> None:
    """Seed the five pillars and a few sample milestones/tasks."""
    conn = get_conn()
    seed_data(conn, reset=reset)
    n = conn.execute("SELECT COUNT(*) FROM pillars").fetchone()[0]
    typer.echo(f"seeded {n} pillars at {config.db_path()}")


@app.command()
def brief(date: str | None = typer.Option(None, help="ISO date; default today.")) -> None:
    """Print the morning brief as JSON."""
    data = core.get_today_brief(get_conn(), date)
    typer.echo(json.dumps(data, indent=2))


@app.command()
def sweep() -> None:
    """Run the auto-log sweep (flip past-due planned blocks → done + log sessions)."""
    result = core.run_autolog_sweep(get_conn())
    typer.echo(json.dumps(result))


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", help="Bind host."),
    port: int = typer.Option(8000, help="Bind port."),
    reload: bool = typer.Option(False, "--reload/--no-reload", help="Auto-reload on code change."),
) -> None:
    """Run the HTTP API (the dashboard's backend)."""
    import uvicorn

    bootstrap_calendar(get_conn())  # register a provider if an account is connected
    uvicorn.run("secondbrain.api.app:app", host=host, port=port, reload=reload)


def bootstrap_calendar(conn) -> None:
    """Rebuild a calendar provider from a stored account + keychain token.

    No account (or the calendar extra isn't installed) → stays NullProvider, so
    the app runs fully offline.
    """
    try:
        from .calendar import set_provider
        from .calendar.oauth import build_google_provider

        for acc in core.list_calendar_accounts(conn):
            if acc["provider"] == "google":
                provider = build_google_provider(acc["account_email"])
                if provider is not None:
                    set_provider(provider)
                    return
    except Exception:
        # Missing optional deps or a bad token must not stop the server.
        pass


calendar_app = typer.Typer(help="Connect and sync external calendars (Google).")
app.add_typer(calendar_app, name="calendar")


@calendar_app.command("connect")
def calendar_connect() -> None:
    """Authorize a Google account (opens a browser) and store the token in the keychain."""
    from .calendar.oauth import run_google_oauth_flow, save_token

    email, token_json = run_google_oauth_flow()
    save_token("google", email, token_json)
    core.add_calendar_account(get_conn(), "google", email)
    typer.echo(f"connected google account {email}")


@calendar_app.command("status")
def calendar_status() -> None:
    """Show connected accounts and whether a provider is active."""
    bootstrap_calendar(get_conn())
    typer.echo(json.dumps(core.calendar_status(get_conn()), indent=2))


@calendar_app.command("sync")
def calendar_sync(
    start: str = typer.Option(None, help="ISO start; default yesterday."),
    end: str = typer.Option(None, help="ISO end; default +7 days."),
) -> None:
    """Pull external events into the DB and flush any queued pushes."""
    from datetime import timedelta

    conn = get_conn()
    bootstrap_calendar(conn)
    s = start or (clock.now_utc() - timedelta(days=1)).isoformat()
    e = end or (clock.now_utc() + timedelta(days=7)).isoformat()
    typer.echo(json.dumps(core.run_calendar_sync(conn, s, e), indent=2))


if __name__ == "__main__":
    app()
