"""Pydantic input and output models for Hatchet question generation workflows."""

from typing import List, Optional
from pydantic import BaseModel, Field


class DocumentGenInput(BaseModel):
    """Input parameters for generating questions from a document file."""

    document_path: str = Field(..., description="S3 URI or local path to the document file.")
    document_type: str = Field(..., description="Document format: 'pdf' or 'image'.")
    categories: List[str] = Field(..., description="List of categories to tag the questions with.")
    qty_from: int = Field(..., description="Minimum number of questions to generate.")
    qty_to: int = Field(..., description="Maximum number of questions to generate.")
    user_id: int = Field(..., description="User ID for loading AI settings and saving ownership.")
    try_hints: bool = Field(default=False, description="Whether to also generate hints.")
    avoid_duplicates: bool = Field(default=False, description="Whether to avoid generating duplicate questions.")


class QuestionGenInput(BaseModel):
    """Input parameters for generating questions directly from source text."""

    text_content: str = Field(..., description="Raw text content to generate questions from.")
    categories: List[str] = Field(..., description="List of categories to tag the questions with.")
    qty_from: int = Field(..., description="Minimum number of questions to generate.")
    qty_to: int = Field(..., description="Maximum number of questions to generate.")
    user_id: int = Field(..., description="User ID for loading AI settings and saving ownership.")
    try_hints: bool = Field(default=False, description="Whether to also generate hints.")
    avoid_duplicates: bool = Field(default=False, description="Whether to avoid generating duplicate questions.")
