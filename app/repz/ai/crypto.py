"""Application-layer encryption for sensitive AI provider credentials.

Secrets (currently only the per-user ``ai_api_key``) are encrypted with
Fernet (AES-128-CBC + HMAC-SHA256) before being written to the
database, and decrypted transparently on read via the
``EncryptedString`` SQLAlchemy ``TypeDecorator``.

The Fernet master key is read from the ``AI_SECRETS_KEY`` environment
variable. Generate one with::

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

and store it in your ``.env`` file. Losing the key means losing the
ability to decrypt any previously-stored API keys, so back it up.
"""

from __future__ import annotations

import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import String, TypeDecorator


_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Lazily build the module-level Fernet instance from the env var.

    Done lazily (rather than at import time) so that simply importing
    ``repz.models`` doesn't require ``AI_SECRETS_KEY`` to be set - it's
    only needed when an encrypted column is actually read or written.
    """
    global _fernet
    if _fernet is None:
        key = os.environ.get("AI_SECRETS_KEY")
        if not key:
            raise RuntimeError(
                "AI_SECRETS_KEY environment variable is not set. Generate one "
                "with `python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\"` and add it to your "
                ".env file."
            )
        _fernet = Fernet(key.encode("ascii") if isinstance(key, str) else key)
    return _fernet


def encrypt_str(plaintext: str) -> str:
    """Encrypt a unicode string and return an ASCII Fernet token."""
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_str(token: str) -> str:
    """Decrypt a Fernet token back to its original unicode string."""
    return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")


class EncryptedString(TypeDecorator):
    """A SQLAlchemy ``String`` that is transparently Fernet-encrypted
    at rest.

    The underlying column still stores text (Fernet tokens are
    URL-safe base64 ASCII), so this can be applied to an existing
    ``String``-typed column without a schema migration as long as the
    column is wide enough to hold the ciphertext. As a rough guide,
    Fernet expands an ``N``-byte plaintext to roughly ``ceil((73 + N +
    padding) / 3) * 4`` ASCII characters, so a ``String(500)`` column
    comfortably holds plaintexts up to ~300 bytes - more than enough
    for any realistic API key.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):  # type: ignore[override]
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return encrypt_str(value)

    def process_result_value(self, value, dialect):  # type: ignore[override]
        if value is None:
            return None
        try:
            return decrypt_str(value)
        except InvalidToken:
            # Pre-encryption / legacy plaintext value still sitting in
            # the DB. Return it as-is rather than crash so the app
            # keeps working; the next save will overwrite it with a
            # proper ciphertext.
            return value
