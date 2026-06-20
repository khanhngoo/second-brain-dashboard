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


if __name__ == "__main__":
    app()
