"""Typer CLI: init the DB, seed data, print the morning brief.

The brief command is the P0 "done when" check (docs/08) — pulling
get_today_brief entirely from the command line.
"""

from __future__ import annotations

import json

import typer

from . import config, core
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

    uvicorn.run("secondbrain.api.app:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    app()
