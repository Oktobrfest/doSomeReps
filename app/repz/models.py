import enum 
from xmlrpc.client import Boolean
from sqlalchemy.types import Date, Integer, String, Boolean as Bool
from sqlalchemy.orm import relationship, Mapped, declarative_base
import sqlalchemy as sa
from sqlalchemy import Identity, ForeignKey, Table, Column, PrimaryKeyConstraint, orm
from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from .ai.crypto import EncryptedString

Base = declarative_base()

question_categories = Table(
    "association",
    Base.metadata,
    Column("category", ForeignKey("category.category_name"), primary_key=True),
    Column("question_id", ForeignKey("question.question_id"), primary_key=True),
)

category_list_association = Table(
    "category_list_association",
    Base.metadata,
    Column("category_list_id", ForeignKey("category_lists.id", ondelete="CASCADE"), primary_key=True),
    Column("category", ForeignKey("category.category_name", onupdate="CASCADE", ondelete="CASCADE"), primary_key=True),
)

# favorate users association table
favorate_links = Table(
    'favorate_links',
    Base.metadata,
    Column('id', ForeignKey("users.id"), primary_key=True),
    Column('favorate_id',ForeignKey("users.id"), primary_key=True),
)

blocked_user = Table(
    'blocked_user',
    Base.metadata,
    Column('id', ForeignKey("users.id"), primary_key=True),
    Column('blocked_user_id',ForeignKey("users.id"), primary_key=True),
)

excluded_questions = Table(
    "excluded_questions",
    Base.metadata,
    Column("users", ForeignKey("users.id", onupdate="CASCADE", ondelete="CASCADE"), primary_key=True),
    Column("question_id", ForeignKey("question.question_id", onupdate="CASCADE", ondelete="CASCADE"), primary_key=True),
)

question_sources = Table(
    "question_sources",
    Base.metadata,
    Column("source", ForeignKey("source.source_id"), primary_key=True),
    Column("question_id", ForeignKey("question.question_id"), primary_key=True),
)

class question(Base):
    __tablename__ = "question"
    question_id = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    created_on = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    question_text = sa.Column(
        sa.String(1500), primary_key=False, unique=False, nullable=True
    )
    hint = sa.Column(sa.String(2000), primary_key=False, unique=False, nullable=True)
    answer = sa.Column(sa.String(4000), primary_key=False, unique=False, nullable=False)
    created_by = sa.Column(Integer, ForeignKey("users.id"), nullable=False)
    privacy = sa.Column(sa.Boolean, default=False)

    categories = relationship(
        "category", secondary=question_categories, back_populates="questions"
    )

    sources = relationship(
        "source", secondary=question_sources, back_populates="sources_questions"
    )

    pics = relationship("q_pic", back_populates="parent_question", cascade="all, delete")
    quizqs = relationship("quizq", back_populates="referenced_question", cascade="all, delete")

    audio_files = relationship(
        "audio",
        back_populates="question",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    flags = relationship(
        "flag",
        back_populates="question",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class source(Base):
    __tablename__ = "source"
    source_id = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    url_string = Column(sa.String(400), nullable=False, unique=True, primary_key=False)
    shortcut = sa.Column(
        sa.String(60), nullable=True, unique=False, primary_key=False
    )
    sources_questions = relationship(
        "question", secondary=question_sources, back_populates="sources"
    )

user_languages = Table(
    "user_languages_association",
    Base.metadata,
    Column("language", ForeignKey("languages.language"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)

class users(UserMixin, Base):
    __tablename__ = "users"
    id = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    username = sa.Column(sa.String(255), nullable=False)
    last_login = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    email = sa.Column(sa.String(60), unique=True, nullable=False)
    created_on = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    password = sa.Column(
        sa.String(200), primary_key=False, unique=False, nullable=True
    )
    role = sa.Column(sa.Integer, index=False, nullable=False, default=1)
    email_verified = sa.Column(sa.Boolean, index=False, nullable=False, default=False)
    token = sa.Column(sa.String(60), nullable=True)
    favorates = relationship(
        'users',
        secondary=favorate_links,
        primaryjoin=(favorate_links.c.id == id),
        secondaryjoin=(favorate_links.c.favorate_id == id),
       # lazy='dynamic'
    )

    blocked_users = relationship(
        'users',
        secondary=blocked_user,
        primaryjoin=(blocked_user.c.id == id),
        secondaryjoin=(blocked_user.c.blocked_user_id == id),
       # lazy='dynamic'
    )

    excluded_questions = relationship(
        "question",
        secondary=excluded_questions,
        primaryjoin=(excluded_questions.c.users == id),
        secondaryjoin=(excluded_questions.c.question_id == question.question_id),
        passive_deletes=True,
    )
    #   cascade="all, delete",

    quizqs = relationship("quizq")

    languages = relationship(
        "languages", secondary=user_languages, back_populates="users"
    )

    category_lists = relationship(
        "category_lists",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    ai_providers = relationship(
        "UserAIProvider",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    ai_integrations = relationship(
        "UserAIIntegration",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    flags = relationship(
        "flag",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class UserAIProvider(Base):
    __tablename__ = "user_ai_providers"

    id = sa.Column(sa.Integer, Identity(), primary_key=True, autoincrement=True)
    user_id = sa.Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = sa.Column(sa.String(60), nullable=False)  # e.g., 'openai', 'anthropic', 'custom'
    api_key = sa.Column(EncryptedString(500), nullable=True)
    api_base = sa.Column(sa.String(400), nullable=True)

    user = relationship("users", back_populates="ai_providers")
    integrations = relationship("UserAIIntegration", back_populates="provider_relation", cascade="all, delete-orphan")


class UserAIIntegration(Base):
    __tablename__ = "user_ai_integrations"

    id = sa.Column(sa.Integer, Identity(), primary_key=True, autoincrement=True)
    user_id = sa.Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    modality = sa.Column(sa.String(50), nullable=False)  # e.g., 'text', 'tts', 'stt', 'image'
    provider_id = sa.Column(Integer, ForeignKey("user_ai_providers.id", ondelete="SET NULL"), nullable=True)
    model = sa.Column(sa.String(120), nullable=True)

    user = relationship("users", back_populates="ai_integrations")
    provider_relation = relationship("UserAIProvider", back_populates="integrations")


class languages(Base):
    __tablename__ = "languages"
    language = sa.Column(
        sa.String(35), nullable=False, unique=True, primary_key=True
    )
    users = relationship(
        "users", secondary=user_languages, back_populates="languages"
    )

class category(Base):
    __tablename__ = "category"
    category_name = sa.Column(
        sa.String(60), nullable=False, unique=True, primary_key=True
    )
    created_by = sa.Column(Integer, ForeignKey("users.id"), nullable=True)

    questions = relationship(
        "question", secondary=question_categories, back_populates="categories"
    )

class category_lists(Base):
    __tablename__ = "category_lists"
    id = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    user_id = sa.Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_list_name = sa.Column(sa.String(255), nullable=False)
    is_default = sa.Column(sa.Boolean, nullable=True, default=False)

    user = relationship("users", back_populates="category_lists")
    categories = relationship(
        "category",
        secondary=category_list_association,
    )

class level(Base):
    __tablename__ = "level"
    level_no = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    days_hence = sa.Column(sa.Float, nullable=False)
    quizqs = relationship("quizq")

class q_pic(Base):
    __tablename__ = "q_pic"
    pic_id = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    pic_string = Column(sa.String(600))
    question_id = Column(Integer, ForeignKey("question.question_id", ondelete="CASCADE"))
    pic_type = Column(sa.String(25))

    # parent_question = relationship("question", back_populates="pics", cascade="all, delete-orphan", single_parent=True)
    parent_question = relationship("question", back_populates="pics", single_parent=True)

class quizq(Base):
    __tablename__ = "quizq"
    quizq_id = sa.Column(
        sa.Integer, Identity(), primary_key=True, autoincrement=True
    )
    question_id = sa.Column(Integer, ForeignKey("question.question_id", ondelete="CASCADE"), nullable=False)
    user_id = sa.Column(Integer, ForeignKey("users.id"), nullable=False)
    level_no = sa.Column(Integer, ForeignKey("level.level_no"), nullable=False)
    answered_on = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    correct = sa.Column(sa.Boolean, nullable=True)
    provided_answer = sa.Column(sa.String(600), primary_key=False, unique=False, nullable=True)

    referenced_question = relationship("question", back_populates="quizqs")

class rating(Base):
    __tablename__ = "rating"
    user_id = sa.Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = sa.Column(Integer, ForeignKey("question.question_id", ondelete="CASCADE"), nullable=False)
    rating = sa.Column(sa.Integer, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'question_id'),
        {},
    )

class FlagCategory(enum.Enum):
    NEEDS_CHANGES = "NEEDS_CHANGES"
    INAPPROPRIATE = "INAPPROPRIATE"
    STUDY_ME = "STUDY_ME"


class flag(Base):
    __tablename__ = "flag"

    user_id = sa.Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id = sa.Column(
        Integer,
        ForeignKey("question.question_id", ondelete="CASCADE"),
        nullable=False,
    )
    flag_category = sa.Column(
        sa.Enum(
            FlagCategory,
            name="flag_category",
            native_enum=False,
            create_constraint=True,
            length=30,
            validate_strings=True,
        ),
        nullable=False,
    )
    note = sa.Column(sa.String(2000), nullable=True)

    user = relationship("users", back_populates="flags")
    question = relationship("question", back_populates="flags")

    __table_args__ = (
        PrimaryKeyConstraint("user_id", "question_id"),
        sa.Index("ix_flag_user_category", "user_id", "flag_category"),
        {},
    )

class audio(Base):
    __tablename__ = "audio"

    audio_id = sa.Column(
        sa.Integer,
        Identity(),
        primary_key=True,
        autoincrement=True,
    )

    question_id = sa.Column(
        Integer,
        ForeignKey("question.question_id", ondelete="CASCADE"),
        nullable=False,
    )

    part = sa.Column(sa.String(40), nullable=False)
    # "question", "answer", "hint"

    audio_text = sa.Column(sa.Text, nullable=True)

    object_key = sa.Column(sa.String(1000), nullable=False)
    public_url = sa.Column(sa.String(1500), nullable=True)

    content_type = sa.Column(sa.String(100), nullable=False, default="audio/mpeg")
    size_bytes = sa.Column(sa.Integer, nullable=True)
    duration_ms = sa.Column(sa.Integer, nullable=True)

    tts_engine = sa.Column(sa.String(80), nullable=True, default="piper")
    tts_voice = sa.Column(sa.String(160), nullable=True)

    language = sa.Column(String(35), ForeignKey("languages.language"), nullable=False, default="en_US")

    question = relationship("question", back_populates="audio_files")

    __table_args__ = (
        sa.UniqueConstraint(
            "object_key",
            name="uq_audio_object_key",
        ),
        sa.Index(
            "ix_audio_lookup",
            "question_id",
            "part",
            "language",
        )
    )
