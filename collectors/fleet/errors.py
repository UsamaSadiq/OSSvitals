from __future__ import annotations

import re

MESSAGE_LIMIT = 200
URL = re.compile(r"\b[a-zA-Z][a-zA-Z0-9+.-]*://\S+")
TOKEN = re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")
AUTH_HEADER = re.compile(r"(?i)authorization:\s*\S+(?:\s+\S+)?")


def public_message(error: BaseException) -> str:
    """First line of an error with URLs, tokens and auth headers removed, short enough to publish."""
    lines = str(error).strip().splitlines()
    text = lines[0] if lines else type(error).__name__
    for pattern, replacement in ((AUTH_HEADER, "[auth]"), (TOKEN, "[token]"), (URL, "[url]")):
        text = pattern.sub(replacement, text)
    return text[:MESSAGE_LIMIT]
