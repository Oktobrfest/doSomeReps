from xmlrpc.client import Boolean
from sqlalchemy.types import Date, Integer, String, Boolean as Bool
from .database import Base
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base
import sqlalchemy as sa
from sqlalchemy import Identity, ForeignKey, Table, Column, PrimaryKeyConstraint
from sqlalchemy.orm import relationship, Mapped
from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

question_categories = Table(
    "association",
    Base.metadata,
    Column("category", ForeignKey("category.category_name"), primary_key=True),
    Column("question_id", ForeignKey("question.question_id"), primary_key=True),
)

class users(UserMixin, Base):
    __tablename__ = "users"  # <- must declare name for db table
    id = sa.Column(
        sa.Integer, Identity(start=1, cycle=True), primary_key=True, autoincrement=True
    )
    username = sa.Column(sa.String(255), nullable=False)
    last_login = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    email = sa.Column(sa.String(60), unique=True, nullable=False)
    created_on = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    password = sa.Column(
        sa.String(200), primary_key=False, unique=False, nullable=False
    )

    quizqs = relationship("quizq")

    def set_password(self, password):
        """Create hashed password."""
        self.password = generate_password_hash(password, method="sha256")

    def check_password(self, password):
        """Check hashed password."""
        return check_password_hash(self.password, password)

    # def __repr__(self):
    #     return f"User(id={self.id!r}, username={self.username!r}, pass={self.password}, created on={self.created_on}, email={self.email}, last_login={self.last_login})"
    # def is_active(self):
    #     return True
    # def is_authenticated(self):
    #     return True

class category(Base):
    __tablename__ = "category"
    category_name = sa.Column(
        sa.String(60), nullable=False, unique=True, primary_key=True
    )
    questions = relationship(
        "question", secondary=question_categories, back_populates="categories"
    )
    
class level(Base):
    __tablename__ = "level"
    level_no = sa.Column(
        sa.Integer, Identity(start=1, cycle=True), primary_key=True, autoincrement=True
    )
    days_hence = sa.Column(sa.Float, nullable=False)
    quizqs = relationship("quizq")

class question(Base):
    __tablename__ = "question"
    question_id = sa.Column(
        sa.Integer, Identity(start=1, cycle=True), primary_key=True, autoincrement=True
    )
    question_name = sa.Column(sa.String(255), nullable=True)
    created_on = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    question_text = sa.Column(
        sa.String(1500), primary_key=False, unique=False, nullable=True
    )
    hint = sa.Column(sa.String(255), primary_key=False, unique=False, nullable=True)
    answer = sa.Column(sa.String(600), primary_key=False, unique=False, nullable=False)
    created_by = sa.Column(Integer, ForeignKey("users.id"), nullable=True)
    privacy = sa.Column(sa.Boolean, server_default='false') 
    
    categories = relationship(
        "category", secondary=question_categories, back_populates="questions"
    )
    pics = relationship("q_pic", back_populates="parent_question", cascade="all, delete")
    quizqs = relationship("quizq", back_populates="referenced_question", cascade="all, delete")   
         
class q_pic(Base):
    __tablename__ = "q_pic"
    pic_id = sa.Column(
        sa.Integer, Identity(start=1, cycle=True), primary_key=True, autoincrement=True
    )
    pic_string = Column(sa.String(600))
    question_id = Column(Integer, ForeignKey("question.question_id", ondelete="CASCADE"))
    pic_type = Column(sa.String(25))
    
    parent_question = relationship("question", back_populates="pics", cascade="all, delete")
 
class quizq(Base):
    __tablename__ = "quizq"
    quizq_id = sa.Column(
        sa.Integer, Identity(start=1, cycle=True), primary_key=True, autoincrement=True
    )
    question_id = sa.Column(Integer, ForeignKey("question.question_id", ondelete="CASCADE"), nullable=False)
    user_id = sa.Column(Integer, ForeignKey("users.id"), nullable=False)
    level_no = sa.Column(Integer, ForeignKey("level.level_no"), nullable=False)
    answered_on = sa.Column(sa.DateTime, index=False, unique=False, nullable=True)
    correct = sa.Column(Bool, nullable=True)
    
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

class excluded_question(Base):
    __tablename__ = "excluded_question"
    user_id = sa.Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_id = sa.Column(Integer, ForeignKey("question.question_id", ondelete="CASCADE"), nullable=False)
    
    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'question_id'),
        {},
    )
    
class blocked_user(Base):
    __tablename__ = "blocked_user"
    user_id = sa.Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_user = sa.Column(Integer, ForeignKey("users.id"), nullable=False)
    
    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'blocked_user'),
        {},
    )    
    
class favorate_user(Base):
    __tablename__ = "favorate_user"
    user_id = sa.Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    favorate_user = sa.Column(Integer, ForeignKey("users.id"), nullable=False)
    
    __table_args__ = (
        PrimaryKeyConstraint('user_id', 'favorate_user'),
        {},
    )       
    
        