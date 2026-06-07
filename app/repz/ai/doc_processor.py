"""Module for extracting text from document files (PDFs, images) for Hatchet worker tasks.

Provides pure functions that accept paths and return extracted text.
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(path: str | Path) -> str:
    """Extract text from a PDF file.

    Requires `pypdf` package to be installed.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")

    try:
        import pypdf
    except ImportError as e:
        msg = "The 'pypdf' package is required for PDF text extraction."
        logger.error(msg)
        raise ImportError(msg) from e

    logger.info("Extracting text from PDF: %s", path)
    text_content = []
    try:
        reader = pypdf.PdfReader(path)
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_content.append(page_text)
        return "\n".join(text_content).strip()
    except Exception as e:
        logger.exception("Failed to extract text from PDF: %s", path)
        raise RuntimeError(f"Failed to read PDF file: {e}") from e


def extract_text_from_image(path: str | Path) -> str:
    """Extract text from an image using pytesseract.

    Requires `pytesseract` and `pillow` (PIL) to be installed.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {path}")

    try:
        from PIL import Image
    except ImportError as e:
        msg = "The 'pillow' (PIL) package is required for image handling."
        logger.error(msg)
        raise ImportError(msg) from e

    try:
        import pytesseract
    except ImportError as e:
        msg = "The 'pytesseract' package is required for image OCR text extraction."
        logger.error(msg)
        raise ImportError(msg) from e

    logger.info("Extracting text from image: %s", path)
    try:
        with Image.open(path) as img:
            text = pytesseract.image_to_string(img)
            return text.strip()
    except Exception as e:
        logger.exception("Failed to run OCR on image: %s", path)
        raise RuntimeError(f"OCR failed for image: {e}") from e
