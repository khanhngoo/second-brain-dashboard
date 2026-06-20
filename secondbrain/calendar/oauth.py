"""Google OAuth + token storage in the OS keychain.

Tokens live in the keychain (via `keyring`), NEVER in the database — the DB only
holds an account reference (calendar_accounts, docs/02:134). Requires the
optional `[calendar]` extra.
"""

from __future__ import annotations

import json
import os

KEYRING_SERVICE = "secondbrain"
# Google Calendar: read existing events + write events on the chosen calendar.
SCOPES = ["https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar.readonly"]

# Path to the OAuth client secrets JSON (downloaded from Google Cloud console).
CLIENT_SECRETS_ENV = "SECONDBRAIN_GOOGLE_CLIENT_SECRETS"


def _keyring():
    import keyring
    return keyring


def _key(provider: str, email: str) -> str:
    return f"{provider}:{email}"


def save_token(provider: str, email: str, token_json: str) -> None:
    _keyring().set_password(KEYRING_SERVICE, _key(provider, email), token_json)


def load_token(provider: str, email: str) -> str | None:
    return _keyring().get_password(KEYRING_SERVICE, _key(provider, email))


def delete_token(provider: str, email: str) -> None:
    try:
        _keyring().delete_password(KEYRING_SERVICE, _key(provider, email))
    except Exception:
        pass


def run_google_oauth_flow() -> tuple[str, str]:
    """Run the local loopback consent flow. Returns (email, token_json).

    Opens a browser for consent; on success the token is returned for the caller
    to persist via save_token + a calendar_accounts row.
    """
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    secrets = os.environ.get(CLIENT_SECRETS_ENV)
    if not secrets:
        raise RuntimeError(
            f"Set {CLIENT_SECRETS_ENV} to your Google OAuth client secrets JSON path."
        )
    flow = InstalledAppFlow.from_client_secrets_file(secrets, SCOPES)
    creds = flow.run_local_server(port=0)

    # Discover the account email so we can key the token + account row.
    info = build("oauth2", "v2", credentials=creds, cache_discovery=False)
    email = info.userinfo().get().execute()["email"]
    return email, creds.to_json()


def build_google_provider(email: str):
    """Rebuild a GoogleCalendarProvider from a stored token, or None if absent."""
    token_json = load_token("google", email)
    if not token_json:
        return None
    from google.oauth2.credentials import Credentials
    from .google import GoogleCalendarProvider

    creds = Credentials.from_authorized_user_info(json.loads(token_json), SCOPES)
    return GoogleCalendarProvider(creds)
