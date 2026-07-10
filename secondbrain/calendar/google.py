"""Google Calendar provider (Google Calendar API).

Pushed events carry an extended property marking them dashboard-owned so the
read-sync never re-imports them (echo-loop guard, docs/05). Authority is one
way: dashboard -> calendar.

Requires the optional `[calendar]` extra (google-api-python-client + google-auth).
"""

from __future__ import annotations

from .base import OWNED_PROPERTY, CalendarProvider


class GoogleCalendarProvider(CalendarProvider):
    def __init__(self, credentials, calendar_id: str = "primary"):
        # Imported lazily so the core install (and the test suite) need no Google
        # dependency unless a calendar is actually connected.
        from googleapiclient.discovery import build

        self._service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
        self._calendar_id = calendar_id

    def push_event(self, *, title: str, start_at: str, end_at: str) -> str:
        body = {
            "summary": title,
            "start": {"dateTime": start_at},
            "end": {"dateTime": end_at},
            "extendedProperties": {"private": {OWNED_PROPERTY: "1"}},
        }
        created = self._service.events().insert(
            calendarId=self._calendar_id, body=body
        ).execute()
        return created["id"]

    def update_event(self, event_id: str, *, start_at: str, end_at: str) -> None:
        self._service.events().patch(
            calendarId=self._calendar_id,
            eventId=event_id,
            body={"start": {"dateTime": start_at}, "end": {"dateTime": end_at}},
        ).execute()

    def delete_event(self, event_id: str) -> None:
        self._service.events().delete(
            calendarId=self._calendar_id, eventId=event_id
        ).execute()

    def list_events(self, *, start: str, end: str) -> list[dict]:
        resp = self._service.events().list(
            calendarId=self._calendar_id,
            timeMin=start,
            timeMax=end,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        out = []
        for ev in resp.get("items", []):
            # Skip our own pushed events (echo-loop guard).
            owned = ev.get("extendedProperties", {}).get("private", {}).get(OWNED_PROPERTY)
            if owned == "1":
                continue
            start_dt = ev["start"].get("dateTime") or ev["start"].get("date")
            end_dt = ev["end"].get("dateTime") or ev["end"].get("date")
            out.append({
                "provider": "google",
                "external_id": ev["id"],
                "title": ev.get("summary"),
                "start_at": start_dt,
                "end_at": end_dt,
            })
        return out
