"""Pillar time analytics.

Sums session minutes per pillar over a bucket (day/week/month/year). Driven off
v_pillar_time (voided sessions already excluded). Bucketing is done in the query
layer, per docs/02.
"""

from __future__ import annotations

import sqlite3

from ..errors import ValidationError

_BUCKETS = ("day", "week", "month", "year")

# strftime grouping expression per bucket (SQLite). week = ISO-ish year-week.
_GROUP_EXPR = {
    "day": "day",
    "week": "strftime('%Y-W%W', day)",
    "month": "strftime('%Y-%m', day)",
    "year": "strftime('%Y', day)",
}


def get_pillar_time(
    conn: sqlite3.Connection,
    bucket: str,
    start: str | None = None,
    end: str | None = None,
) -> list[dict]:
    """Minutes per pillar per bucket, optionally restricted to [start, end] days.

    Returns rows: {pillar_id, slug, name, bucket, minutes}.
    """
    if bucket not in _BUCKETS:
        raise ValidationError(f"bucket must be one of {', '.join(_BUCKETS)}; got {bucket!r}")
    group = _GROUP_EXPR[bucket]

    where, params = [], []
    if start is not None:
        where.append("vpt.day >= date(?)")
        params.append(start)
    if end is not None:
        where.append("vpt.day <= date(?)")
        params.append(end)
    clause = ("WHERE " + " AND ".join(where)) if where else ""

    rows = conn.execute(
        f"""
        SELECT
            p.id   AS pillar_id,
            p.slug AS slug,
            p.name AS name,
            {group} AS bucket,
            COALESCE(SUM(vpt.minutes), 0) AS minutes
        FROM pillars p
        LEFT JOIN v_pillar_time vpt ON vpt.pillar_id = p.id
            {('AND ' + ' AND '.join(where)) if where else ''}
        GROUP BY p.id, bucket
        ORDER BY p.sort_order, bucket
        """,
        params,
    ).fetchall()
    return [dict(r) for r in rows]
