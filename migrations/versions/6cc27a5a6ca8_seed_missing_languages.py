"""seed missing languages

Revision ID: 6cc27a5a6ca8
Revises: de1c891cb8ed
Create Date: 2026-05-19 16:29:06.529689

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


LANGUAGE_CODES = [
    "en_US",
    "en_GB",
    "es_ES",
    "es_MX",
    "fr_FR",
    "de_DE",
    "it_IT",
    "pt_BR",
    "pt_PT",
    "nl_NL",
    "ru_RU",
    "ja_JP",
    "ko_KR",
    "zh_CN",
    "zh_TW",
    "ar_SA",
    "hi_IN",
    "tr_TR",
    "pl_PL",
    "sv_SE",
]


# revision identifiers, used by Alembic.
revision: str = "6cc27a5a6ca8"
down_revision: Union[str, Sequence[str], None] = "de1c891cb8ed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed missing language rows."""

    languages_table = sa.table(
        "languages",
        sa.column("language", sa.String(length=35)),
    )

    bind = op.get_bind()

    existing_languages = set(
        bind.execute(
            sa.select(languages_table.c.language)
        ).scalars()
    )

    rows_to_insert = [
        {"language": code}
        for code in LANGUAGE_CODES
        if code not in existing_languages
    ]

    if rows_to_insert:
        op.bulk_insert(languages_table, rows_to_insert)


def downgrade() -> None:
    """Remove seeded language rows."""

    languages_table = sa.table(
        "languages",
        sa.column("language", sa.String(length=35)),
    )

    bind = op.get_bind()

    bind.execute(
        sa.delete(languages_table).where(
            languages_table.c.language.in_(LANGUAGE_CODES)
        )
    )
